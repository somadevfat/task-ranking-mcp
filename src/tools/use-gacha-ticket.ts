/**
 * use_gacha_ticket ツール
 * @responsibility ガチャ券を1枚消費し、安全ガチャを回すMCPツール
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/connection.ts";
import {
  getUserState,
  updateGachaTickets,
  updateUserRank,
  addRestTicket,
} from "../db/queries.ts";
import { rollSafeGacha } from "../domain/gacha.ts";
import { calculateRankChange, formatRankName } from "../domain/rank.ts";
import { checkAndTransitionSeason } from "./season-check.ts";

/**
 * use_gacha_ticketツールをMCPサーバーに登録する
 * @responsibility 安全ガチャツールの定義・ハンドラーを登録する
 * @param server MCPサーバーインスタンス
 */
export function registerUseGachaTicket(server: McpServer): void {
  server.tool(
    "use_gacha_ticket",
    "ガチャ券を1枚消費し、安全ガチャを回す",
    {},
    async () => {
      try {
        const db = getDatabase();

        /* シーズン遷移チェック */
        const seasonMsg = checkAndTransitionSeason(db);

        /* ガチャ券の所持チェック */
        const state = getUserState(db);
        if (state.gacha_tickets <= 0) {
          return {
            content: [{ type: "text" as const, text: "❌ エラー: ガチャ券を所持していません" }],
            isError: true,
          };
        }

        /* ガチャ券を1枚消費 */
        updateGachaTickets(db, -1);

        /* 安全ガチャを実行 */
        const outcome = rollSafeGacha(Math.random());

        let response = "";
        if (seasonMsg) {
          response += seasonMsg + "\n\n---\n\n";
        }

        response += "🎰 安全ガチャ結果\n\n";

        /* LP変動がある場合はランク計算 */
        if (outcome.lpChange > 0) {
          const currentState = getUserState(db);
          const rankChange = calculateRankChange(
            currentState.rank_tier,
            currentState.rank_division,
            currentState.current_lp,
            outcome.lpChange,
            currentState.demotion_shield,
          );

          /* ランク情報を更新 */
          updateUserRank(
            db,
            rankChange.newTier,
            rankChange.newDivision,
            rankChange.newLp,
            rankChange.demotionShield,
          );

          const rankName = formatRankName(rankChange.newTier, rankChange.newDivision);

          if (outcome.result === "lp_small_boost") {
            response += `🎉 LP小ブースト! +${outcome.lpChange} LP\n`;
          } else {
            response += `🎉 LP大ブースト! +${outcome.lpChange} LP\n`;
          }
          response += `現在のLP: ${rankChange.newLp} / 100\n`;
          response += `ランク: ${rankName}\n`;

          if (rankChange.promoted) {
            response += `\n🎉 昇格しました！\n`;
          }
        }

        /* 休憩券を獲得した場合 */
        if (outcome.restMinutes !== null) {
          addRestTicket(db, outcome.restMinutes as 5 | 15);
          response += `☕ ${outcome.restMinutes}分の休憩券を獲得！\n`;
        }

        /* 残りガチャ券数を表示 */
        const updatedState = getUserState(db);
        response += `\n🎫 残りガチャ券: ${updatedState.gacha_tickets}枚`;

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
