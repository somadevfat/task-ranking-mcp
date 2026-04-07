/**
 * get_status ツール
 * @responsibility 現在の全ステータスを一括取得するMCPツール
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/connection.ts";
import {
  getUserState,
  getActiveTasks,
  getActiveSeason,
} from "../db/queries.ts";
import { formatRankName } from "../domain/rank.ts";
import { getSeasonRemainingDays } from "../domain/season.ts";
import { DIFFICULTY_LABEL, TICKET_CEILING_INTERVAL } from "../domain/constants.ts";
import { checkAndTransitionSeason } from "./season-check.ts";

/**
 * get_statusツールをMCPサーバーに登録する
 * @responsibility ステータス一括取得ツールの定義・ハンドラーを登録する
 * @param server MCPサーバーインスタンス
 */
export function registerGetStatus(server: McpServer): void {
  server.tool(
    "get_status",
    "現在のLP、ランク、勝率、タスク一覧、券の所持数、シーズン情報を一括取得する",
    {},
    async () => {
      try {
        const db = getDatabase();

        /* シーズン遷移チェック */
        const seasonMsg = checkAndTransitionSeason(db);

        /* 各種データを取得 */
        const state = getUserState(db);
        const activeTasks = getActiveTasks(db);
        const season = getActiveSeason(db);

        /* ランク表示名 */
        const rankName = formatRankName(state.rank_tier, state.rank_division);

        /* 降格保護の表示 */
        const shieldText = state.demotion_shield > 0
          ? `あり (残り${state.demotion_shield}タスク)`
          : "なし";

        /* 次のガチャ券天井までのタスク数 */
        const tasksUntilTicket = TICKET_CEILING_INTERVAL - (state.tasks_completed_total % TICKET_CEILING_INTERVAL);

        let response = "";
        if (seasonMsg) {
          response += seasonMsg + "\n\n---\n\n";
        }

        response += `📊 ステータス\n\n`;
        response += `👤 ランク: ${rankName}\n`;
        response += `⭐ LP: ${state.current_lp} / 100\n`;
        response += `🛡️ 降格保護: ${shieldText}\n\n`;

        /* 未完了タスク一覧 */
        response += `📋 未完了タスク (${activeTasks.length}件):\n`;
        if (activeTasks.length === 0) {
          response += `  タスクがありません。add_taskで追加しましょう！\n`;
        } else {
          for (let i = 0; i < activeTasks.length; i++) {
            const task = activeTasks[i]!;
            const diffLabel = DIFFICULTY_LABEL[task.difficulty];
            const penaltyMark = task.is_penalty ? " ⚡外れタスク" : "";
            response += `  ${i + 1}. [ID:${task.id}] ${task.name} (${diffLabel})${penaltyMark}\n`;
          }
        }

        /* 所持アイテム */
        response += `\n🎫 ガチャ券: ${state.gacha_tickets}枚\n`;
        response += `☕ 休憩券: 5分×${state.rest_tickets_5}枚, 15分×${state.rest_tickets_15}枚\n`;
        response += `📈 次のガチャ券まで: あと${tasksUntilTicket}タスク\n`;

        /* シーズン情報 */
        if (season) {
          const remainingDays = getSeasonRemainingDays(season.end_date);
          const seasonWinRate = season.total_matches > 0
            ? Math.round((season.total_wins / season.total_matches) * 100)
            : 0;

          response += `\n📅 シーズン: ${season.id} (残り${Math.max(remainingDays, 0)}日)\n`;
          response += `🏆 シーズン戦績: ${season.total_matches}戦 ${season.total_wins}勝 ${season.total_defeats}敗 (勝率 ${seasonWinRate}%)`;
        }

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
