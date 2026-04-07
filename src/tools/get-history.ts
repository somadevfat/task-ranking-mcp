/**
 * get_history ツール
 * @responsibility 直近の勝敗履歴を取得するMCPツール
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/connection.ts";
import {
  getRecentHistory,
  getTodayStats,
  getCurrentWinStreak,
} from "../db/queries.ts";
import { checkAndTransitionSeason } from "./season-check.ts";

/**
 * get_historyツールをMCPサーバーに登録する
 * @responsibility 戦績履歴取得ツールの定義・ハンドラーを登録する
 * @param server MCPサーバーインスタンス
 */
export function registerGetHistory(server: McpServer): void {
  server.tool(
    "get_history",
    "直近N件の勝敗履歴を表示する",
    {
      limit: z.number().optional().default(20).describe("取得件数（デフォルト20、最大50）"),
    },
    async ({ limit }) => {
      try {
        const db = getDatabase();

        /* シーズン遷移チェック */
        const seasonMsg = checkAndTransitionSeason(db);

        /* データを取得 */
        const history = getRecentHistory(db, limit);
        const todayStats = getTodayStats(db);
        const winStreak = getCurrentWinStreak(db);

        let response = "";
        if (seasonMsg) {
          response += seasonMsg + "\n\n---\n\n";
        }

        response += `📜 直近${limit}件の戦績\n\n`;

        if (history.length === 0) {
          response += "まだ戦績がありません。タスクを完了してガチャを回しましょう！\n";
        } else {
          /* テーブルヘッダー */
          response += ` # | 結果          | タスク                           | LP変動 | 日時\n`;
          response += `---|---------------|----------------------------------|--------|-------------\n`;

          /* 各履歴行を出力 */
          for (let i = 0; i < history.length; i++) {
            const entry = history[i]!;
            const num = String(i + 1).padStart(2, " ");

            /* 結果の表示文字列 */
            let resultStr: string;
            switch (entry.result) {
              case "victory":
                resultStr = "🏆 Victory   ";
                break;
              case "defeat":
                resultStr = "💀 Defeat    ";
                break;
              case "critical_win":
                resultStr = "⚡ Critical  ";
                break;
            }

            /* LP変動の表示 */
            const lpStr = entry.lp_change >= 0 ? `+${entry.lp_change}` : `${entry.lp_change}`;

            /* 日時の表示（MM/DD HH:MM形式） */
            const date = new Date(entry.created_at + "Z");
            const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

            /* タスク名を最大30文字に切り詰め */
            const taskName = entry.task_name.length > 30
              ? entry.task_name.substring(0, 27) + "..."
              : entry.task_name.padEnd(30, " ");

            response += `${num} | ${resultStr} | ${taskName} | ${lpStr.padStart(6, " ")} | ${dateStr}\n`;
          }
        }

        /* 統計情報 */
        const historyWins = history.filter(
          (h) => h.result === "victory" || h.result === "critical_win",
        ).length;
        const historyDefeats = history.filter((h) => h.result === "defeat").length;
        const historyWinRate = history.length > 0
          ? Math.round((historyWins / history.length) * 100)
          : 0;

        const todayWinRate = todayStats.total > 0
          ? Math.round((todayStats.wins / todayStats.total) * 100)
          : 0;

        response += `\n📊 統計:\n`;
        response += `  直近${history.length}戦: ${historyWins}勝 ${historyDefeats}敗 (勝率 ${historyWinRate}%)\n`;
        response += `  今日: ${todayStats.total}戦 ${todayStats.wins}勝 ${todayStats.defeats}敗 (勝率 ${todayWinRate}%)\n`;

        if (winStreak > 0) {
          response += `  連勝中: ${winStreak}連勝 🔥`;
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
