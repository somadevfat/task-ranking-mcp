/**
 * recent_history リソース
 * @responsibility 直近10件の勝敗履歴をMCPリソースとして提供する
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/connection.ts";
import { getRecentHistory } from "../db/queries.ts";

/**
 * recent_historyリソースをMCPサーバーに登録する
 * @responsibility 直近履歴リソースの定義・ハンドラーを登録する
 * @param server MCPサーバーインスタンス
 */
export function registerRecentHistoryResource(server: McpServer): void {
  server.resource(
    "recent_history",
    "gacha://history/recent",
    { description: "直近10件の勝敗履歴" },
    async () => {
      const db = getDatabase();
      const history = getRecentHistory(db, 10);

      let text = `📜 直近10件の戦績\n\n`;

      if (history.length === 0) {
        text += "まだ戦績がありません。\n";
      } else {
        for (let i = 0; i < history.length; i++) {
          const entry = history[i]!;

          /* 結果の絵文字 */
          let resultIcon: string;
          switch (entry.result) {
            case "victory":
              resultIcon = "🏆";
              break;
            case "defeat":
              resultIcon = "💀";
              break;
            case "critical_win":
              resultIcon = "⚡";
              break;
          }

          const lpStr = entry.lp_change >= 0 ? `+${entry.lp_change}` : `${entry.lp_change}`;
          text += `${i + 1}. ${resultIcon} ${entry.task_name} (${lpStr} LP) - ${entry.created_at}\n`;
        }
      }

      return {
        contents: [
          {
            uri: "gacha://history/recent",
            mimeType: "text/plain",
            text,
          },
        ],
      };
    },
  );
}
