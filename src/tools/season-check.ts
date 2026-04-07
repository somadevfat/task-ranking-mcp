/**
 * シーズン遷移チェッカー
 * @responsibility 全ツール呼び出し前にシーズン期限切れをチェックし、必要に応じてシーズンリセットを実行する
 */

import type { Database } from "bun:sqlite";
import {
  getActiveSeason,
  getUserState,
  finalizeSeason,
  insertSeason,
  updateCurrentSeasonId,
  updateUserRank,
} from "../db/queries.ts";
import { getCurrentSeasonId, getSeasonStartDate, getSeasonEndDate, isSeasonExpired } from "../domain/season.ts";
import { softReset } from "../domain/season.ts";
import { formatRankName } from "../domain/rank.ts";

/**
 * シーズン遷移が必要かチェックし、必要なら実行する
 * @responsibility シーズン終了日を過ぎている場合にソフトリセットを含むシーズン遷移を行う
 * @param db データベースインスタンス
 * @return シーズン遷移が発生した場合のメッセージ（なければnull）
 */
export function checkAndTransitionSeason(db: Database): string | null {
  /* アクティブシーズンを取得 */
  const activeSeason = getActiveSeason(db);
  if (!activeSeason) {
    return null;
  }

  /* シーズンが期限切れでなければ何もしない */
  if (!isSeasonExpired(activeSeason.end_date)) {
    return null;
  }

  /* 現在のユーザー状態を取得 */
  const state = getUserState(db);
  const oldRankName = formatRankName(state.rank_tier, state.rank_division);

  /* 現在のシーズンを終了処理 */
  finalizeSeason(db, activeSeason.id, state.rank_tier, state.rank_division, state.current_lp);

  /* 新しいシーズンIDを算出 */
  const newSeasonId = getCurrentSeasonId();
  const startDate = getSeasonStartDate(newSeasonId);
  const endDate = getSeasonEndDate(newSeasonId);

  /* 新シーズンをDBに挿入 */
  insertSeason(db, newSeasonId, startDate, endDate);

  /* ソフトリセットを実行 */
  const resetResult = softReset(state.rank_tier, state.rank_division);
  const newRankName = formatRankName(resetResult.tier, resetResult.division);

  /* ユーザー状態を更新 */
  updateUserRank(db, resetResult.tier, resetResult.division, resetResult.lp, 0);
  updateCurrentSeasonId(db, newSeasonId);

  /* シーズン遷移メッセージを生成 */
  return `🔄 シーズン遷移が発生しました！

📅 旧シーズン: ${activeSeason.id} → 新シーズン: ${newSeasonId}
📊 旧シーズン成績: ${activeSeason.total_matches}戦 ${activeSeason.total_wins}勝 ${activeSeason.total_defeats}敗
🏆 旧ランク: ${oldRankName} → 新ランク: ${newRankName} (LP: ${resetResult.lp})

ソフトリセットにより2ティア降格しました。新シーズン頑張りましょう！`;
}
