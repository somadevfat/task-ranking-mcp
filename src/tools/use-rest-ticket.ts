/**
 * use_rest_ticket ツール
 * @responsibility 休憩券を1枚消費するMCPツール
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/connection.ts";
import { getUserState, useRestTicket } from "../db/queries.ts";
import { checkAndTransitionSeason } from "./season-check.ts";

/**
 * use_rest_ticketツールをMCPサーバーに登録する
 * @responsibility 休憩券使用ツールの定義・ハンドラーを登録する
 * @param server MCPサーバーインスタンス
 */
export function registerUseRestTicket(server: McpServer): void {
  server.tool(
    "use_rest_ticket",
    "休憩券を1枚消費する",
    {},
    async () => {
      try {
        const db = getDatabase();

        /* シーズン遷移チェック */
        const seasonMsg = checkAndTransitionSeason(db);

        /* 休憩券を消費（5分券優先） */
        const minutes = useRestTicket(db);
        if (minutes === null) {
          return {
            content: [{ type: "text" as const, text: "❌ エラー: 休憩券を所持していません" }],
            isError: true,
          };
        }

        /* 更新後の状態を取得 */
        const state = getUserState(db);

        let response = "";
        if (seasonMsg) {
          response += seasonMsg + "\n\n---\n\n";
        }

        response += `☕ 休憩券を使用しました\n\n`;
        response += `休憩時間: ${minutes}分\n`;
        response += `残り休憩券: 5分×${state.rest_tickets_5}枚, 15分×${state.rest_tickets_15}枚\n`;

        /* 5分券の合成ヒントを表示 */
        if (state.rest_tickets_5 >= 2) {
          response += `💡 ヒント: 5分券があと${3 - state.rest_tickets_5 >= 0 ? 3 - state.rest_tickets_5 : 0}枚で20分の自由時間に合成できます！`;
        } else if (state.rest_tickets_5 > 0) {
          response += `💡 ヒント: 5分券があと${3 - state.rest_tickets_5}枚で20分の自由時間に合成できます！`;
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
