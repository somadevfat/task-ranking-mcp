/**
 * season_stats リソース
 * @responsibility 現在シーズンの統計情報をMCPリソースとして提供する
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/connection.ts";
import { getActiveSeason } from "../db/queries.ts";
import { getSeasonRemainingDays } from "../domain/season.ts";

/**
 * season_statsリソースをMCPサーバーに登録する
 * @responsibility シーズン統計リソースの定義・ハンドラーを登録する
 * @param server MCPサーバーインスタンス
 */
export function registerSeasonStatsResource(server: McpServer): void {
  server.resource(
    "season_stats",
    "gacha://season/current",
    { description: "現在シーズンの統計情報" },
    async () => {
      const db = getDatabase();
      const season = getActiveSeason(db);

      let text: string;
      if (!season) {
        text = "アクティブなシーズンがありません。";
      } else {
        const remainingDays = getSeasonRemainingDays(season.end_date);
        const winRate = season.total_matches > 0
          ? Math.round((season.total_wins / season.total_matches) * 100)
          : 0;

        text = `📅 シーズン: ${season.id}
📆 期間: ${season.start_date} 〜 ${season.end_date}
⏳ 残り: ${Math.max(remainingDays, 0)}日
🏆 戦績: ${season.total_matches}戦 ${season.total_wins}勝 ${season.total_defeats}敗 (勝率 ${winRate}%)
⚡ クリティカル勝利: ${season.total_critical_wins}回`;
      }

      return {
        contents: [
          {
            uri: "gacha://season/current",
            mimeType: "text/plain",
            text,
          },
        ],
      };
    },
  );
}
