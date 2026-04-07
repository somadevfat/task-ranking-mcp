/**
 * rank_info リソース
 * @responsibility 現在のランク・LP情報をMCPリソースとして提供する
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/connection.ts";
import { getUserState } from "../db/queries.ts";
import { formatRankName } from "../domain/rank.ts";

/**
 * rank_infoリソースをMCPサーバーに登録する
 * @responsibility ランク情報リソースの定義・ハンドラーを登録する
 * @param server MCPサーバーインスタンス
 */
export function registerRankInfoResource(server: McpServer): void {
  server.resource(
    "rank_info",
    "gacha://rank/current",
    { description: "現在のランク・LP情報" },
    async () => {
      const db = getDatabase();
      const state = getUserState(db);
      const rankName = formatRankName(state.rank_tier, state.rank_division);

      const shieldText = state.demotion_shield > 0
        ? `あり (残り${state.demotion_shield}タスク)`
        : "なし";

      const text = `👤 ランク: ${rankName}
⭐ LP: ${state.current_lp} / 100
🛡️ 降格保護: ${shieldText}`;

      return {
        contents: [
          {
            uri: "gacha://rank/current",
            mimeType: "text/plain",
            text,
          },
        ],
      };
    },
  );
}
