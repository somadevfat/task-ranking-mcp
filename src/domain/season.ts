/**
 * シーズン管理ロジック
 * @responsibility シーズンIDの算出、シーズン期間の計算、ソフトリセットの処理を行う
 */

import type { RankTier, SoftResetResult } from "../types/index.ts";
import { MASTER_PLUS_TIERS, TIER_ORDER } from "./constants.ts";

/**
 * 現在日時からシーズンIDを算出する
 * @responsibility 現在日時からシーズンIDを算出する
 * @return "YYYY-QN" 形式のシーズンID文字列
 */
export function getCurrentSeasonId(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${quarter}`;
}

/**
 * シーズンIDからシーズンの開始日を算出する
 * @responsibility シーズンIDパース → 四半期の初日を返す
 * @param seasonId "YYYY-QN" 形式のシーズンID
 * @return シーズン開始日（ISO文字列）
 */
export function getSeasonStartDate(seasonId: string): string {
  const [yearStr, quarterStr] = seasonId.split("-");
  const year = parseInt(yearStr!, 10);
  const quarter = parseInt(quarterStr!.replace("Q", ""), 10);

  /* 四半期の開始月を算出（Q1=1月, Q2=4月, Q3=7月, Q4=10月） */
  const startMonth = (quarter - 1) * 3;
  return new Date(year, startMonth, 1).toISOString().split("T")[0]!;
}

/**
 * シーズンIDからシーズンの終了日を算出する
 * @responsibility シーズンIDパース → 四半期の末日を返す
 * @param seasonId "YYYY-QN" 形式のシーズンID
 * @return シーズン終了日（ISO文字列）
 */
export function getSeasonEndDate(seasonId: string): string {
  const [yearStr, quarterStr] = seasonId.split("-");
  const year = parseInt(yearStr!, 10);
  const quarter = parseInt(quarterStr!.replace("Q", ""), 10);

  /* 四半期の終了日 = 次の四半期の初日 - 1日 */
  const endMonth = quarter * 3;
  const endDate = new Date(year, endMonth, 0);
  return endDate.toISOString().split("T")[0]!;
}

/**
 * シーズンの残り日数を計算する
 * @responsibility 現在日時からシーズン終了日までの日数を返す
 * @param endDate シーズン終了日（ISO文字列）
 * @return 残り日数（0以下ならシーズン終了済み）
 */
export function getSeasonRemainingDays(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate);

  /* ミリ秒の差分を日数に変換 */
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * シーズンが終了しているかを判定する
 * @responsibility 現在日時がシーズン終了日を超えているかを判定する
 * @param endDate シーズン終了日（ISO文字列）
 * @return 終了済みならtrue
 */
export function isSeasonExpired(endDate: string): boolean {
  return getSeasonRemainingDays(endDate) < 0;
}

/**
 * ソフトリセットを実行し、リセット後のランクを返す
 * @responsibility シーズン切替時に現在ランクをリセットする
 *   - Master以上（index >= 7）: Diamond IV へ降格
 *   - Diamond（index 6）: 2ティア下（Platinum IV）
 *   - Emerald〜Bronze（index 1-5）: 1ティア下、ディビジョン維持
 *   - Iron（index 0）: Iron IV（最低値に補正）
 *   要件定義書のソフトリセット例テーブルに完全準拠する。
 * @param currentTier 現在のティア
 * @param currentDivision 現在のディビジョン
 * @return ソフトリセット後のランク情報
 */
export function softReset(currentTier: RankTier, currentDivision: number): SoftResetResult {
  const currentIndex = TIER_ORDER.indexOf(currentTier);

  /* Master以上（index 7, 8, 9）: Diamond IV に固定降格 */
  if ((MASTER_PLUS_TIERS as readonly string[]).includes(currentTier)) {
    return { tier: "Diamond", division: 4, lp: 50 };
  }

  /* Diamond（index 6）: 2ティア下の Platinum IV */
  if (currentTier === "Diamond") {
    return { tier: "Platinum", division: 4, lp: 50 };
  }

  /* Iron（index 0）: これ以上下がれないので Iron IV に補正 */
  if (currentIndex === 0) {
    return { tier: "Iron", division: 4, lp: 50 };
  }

  /* Emerald〜Bronze（index 1-5）: 1ティア下、ディビジョン維持 */
  const resetTier = TIER_ORDER[currentIndex - 1]!;
  return { tier: resetTier, division: currentDivision, lp: 50 };
}
