/**
 * complete_task ツール
 * @responsibility タスクを完了し、ガチャ判定を実行するMCPツール（システムの中核）
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/connection.ts";
import {
  getTaskById,
  completeTask,
  getUserState,
  incrementTasksCompleted,
  updateUserRank,
  updateGachaTickets,
  addRestTicket,
  addTask,
  insertMatchHistory,
  updateSeasonStats,
  getTodayStats,
} from "../db/queries.ts";
import { rollGacha, shouldGrantBonusTicket } from "../domain/gacha.ts";
import { calculateRankChange, formatRankName } from "../domain/rank.ts";
import { DIFFICULTY_LABEL } from "../domain/constants.ts";
import { checkAndTransitionSeason } from "./season-check.ts";

/**
 * complete_taskツールをMCPサーバーに登録する
 * @responsibility タスク完了＋ガチャ判定ツールの定義・ハンドラーを登録する
 * @param server MCPサーバーインスタンス
 */
export function registerCompleteTask(server: McpServer): void {
  server.tool(
    "complete_task",
    "指定したタスクを完了し、ガチャ（リザルト判定）を実行する",
    {
      task_id: z.number().describe("完了するタスクのID"),
    },
    async ({ task_id }) => {
      try {
        const db = getDatabase();

        /* シーズン遷移チェック */
        const seasonMsg = checkAndTransitionSeason(db);

        /* タスクの存在チェック */
        const task = getTaskById(db, task_id);
        if (!task) {
          return {
            content: [{ type: "text" as const, text: `❌ エラー: ID ${task_id} のタスクが見つかりません` }],
            isError: true,
          };
        }

        /* タスクが既に完了済みかチェック */
        if (task.status === "completed") {
          return {
            content: [{ type: "text" as const, text: `❌ エラー: ID ${task_id} のタスクは既に完了しています` }],
            isError: true,
          };
        }

        /* タスクを完了状態にする */
        completeTask(db, task_id);

        /* 通算完了タスク数をインクリメント */
        const totalCompleted = incrementTasksCompleted(db);

        /* ガチャ判定を実行（ランダム値はMath.randomで生成） */
        const gachaOutcome = rollGacha(
          task.difficulty,
          Math.random(),
          Math.random(),
          Math.random(),
        );

        /* 現在のユーザー状態を取得 */
        const state = getUserState(db);

        /* ランク変動を計算 */
        const rankChange = calculateRankChange(
          state.rank_tier,
          state.rank_division,
          state.current_lp,
          gachaOutcome.finalLpChange,
          state.demotion_shield,
        );

        /* ユーザーのランク情報を更新 */
        updateUserRank(
          db,
          rankChange.newTier,
          rankChange.newDivision,
          rankChange.newLp,
          rankChange.demotionShield,
        );

        /* ガチャ券天井判定 */
        const bonusTicket = shouldGrantBonusTicket(totalCompleted);
        if (bonusTicket) {
          updateGachaTickets(db, 1);
        }

        /* Critical Win時: ガチャ券を1枚付与 */
        if (gachaOutcome.result === "critical_win") {
          updateGachaTickets(db, 1);
        }

        /* Victory時: 休憩券を付与（5分〜15分のランダム） */
        if (gachaOutcome.restMinutes !== null) {
          const restType: 5 | 15 = gachaOutcome.restMinutes >= 10 ? 15 : 5;
          addRestTicket(db, restType);
        }

        /* Defeat時: 外れタスクを自動生成 */
        if (gachaOutcome.penaltyTaskName) {
          addTask(db, gachaOutcome.penaltyTaskName, "low", 1);
        }

        /* シーズン戦績を更新 */
        updateSeasonStats(db, state.current_season_id, gachaOutcome.result);

        /* 試合履歴を記録 */
        insertMatchHistory(db, {
          taskId: task.id,
          taskName: task.name,
          difficulty: task.difficulty,
          result: gachaOutcome.result,
          lpChange: gachaOutcome.finalLpChange,
          lpAfter: rankChange.newLp,
          rankTierAfter: rankChange.newTier,
          rankDivisionAfter: rankChange.newDivision,
          promotion: rankChange.promoted,
          demotion: rankChange.demoted,
          bonusTicket,
          penaltyTaskName: gachaOutcome.penaltyTaskName,
          restMinutes: gachaOutcome.restMinutes,
          seasonId: state.current_season_id,
        });

        /* レスポンスメッセージの構築 */
        const rankName = formatRankName(rankChange.newTier, rankChange.newDivision);
        const diffLabel = DIFFICULTY_LABEL[task.difficulty];
        const todayStats = getTodayStats(db);
        const winRate = todayStats.total > 0 ? Math.round((todayStats.wins / todayStats.total) * 100) : 0;

        let response = "";
        if (seasonMsg) {
          response += seasonMsg + "\n\n---\n\n";
        }

        /* ガチャ結果別のメッセージ */
        switch (gachaOutcome.result) {
          case "victory":
            response += `🏆 Victory!\n\n`;
            break;
          case "defeat":
            response += `💀 Defeat...\n\n`;
            break;
          case "critical_win":
            response += `⚡⚡⚡ CRITICAL WIN! ⚡⚡⚡\n\n`;
            break;
        }

        /* タスク情報とLP変動 */
        const lpSign = gachaOutcome.finalLpChange >= 0 ? "+" : "";
        response += `タスク: 「${task.name}」(難易度: ${diffLabel})\n`;
        response += `LP変動: ${lpSign}${gachaOutcome.finalLpChange} LP  (${Math.abs(gachaOutcome.baseLpChange)} × ${DIFFICULTY_LABEL[task.difficulty] === "低" ? "1.0" : DIFFICULTY_LABEL[task.difficulty] === "中" ? "1.5" : "2.0"})\n`;
        response += `現在のLP: ${rankChange.newLp} / 100\n`;
        response += `ランク: ${rankName}\n`;

        /* 昇格・降格の通知 */
        if (rankChange.promoted) {
          response += `\n🎉 昇格しました！\n`;
        }
        if (rankChange.demoted) {
          response += `\n💥 降格しました...\n`;
        }

        /* 結果ごとの追加情報 */
        if (gachaOutcome.result === "victory" && gachaOutcome.restMinutes !== null) {
          response += `\n🎁 ボーナス: ${gachaOutcome.restMinutes}分の休憩時間を獲得！\n`;
        }
        if (gachaOutcome.result === "defeat" && gachaOutcome.penaltyTaskName) {
          response += `\n⚡ 追加タスク発生: 「${gachaOutcome.penaltyTaskName}」\n→ 完了してリベンジだ！\n`;
        }
        if (gachaOutcome.result === "critical_win") {
          const updatedState = getUserState(db);
          response += `\n🎫 ガチャ券を獲得！ (所持数: ${updatedState.gacha_tickets}枚)\n`;
        }

        /* 天井ボーナス通知 */
        if (bonusTicket) {
          const updatedState = getUserState(db);
          response += `\n🎫 天井ボーナス！ ガチャ券を獲得！ (所持数: ${updatedState.gacha_tickets}枚)\n`;
        }

        /* 本日の戦績 */
        response += `\n📊 本日の戦績: ${todayStats.total}戦 ${todayStats.wins}勝 ${todayStats.defeats}敗 (勝率 ${winRate}%)`;

        return {
          content: [{ type: "text" as const, text: response }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `❌ エラー: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
