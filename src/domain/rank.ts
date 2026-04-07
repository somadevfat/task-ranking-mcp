/**
 * ランク昇降格ロジック
 * @responsibility LP変動後のランク（ティア＋ディビジョン）の昇格・降格処理を行う
 */

import type { RankChangeResult, RankTier } from "../types/index.ts";
import { LP_AFTER_DEMOTION, LP_MAX, MASTER_PLUS_TIERS, TIER_ORDER } from "./constants.ts";

/**
 * ティアのインデックスを取得する
 * @responsibility ティア名から順序インデックスを取得する
 * @param tier ランクティア
 * @return ティアのインデックス（0起点）
 */
function getTierIndex(tier: RankTier): number {
  return TIER_ORDER.indexOf(tier);
}

/**
 * Master以上のティアかどうかを判定する
 * @responsibility ディビジョンなし・LP上限なしのティアかを判定する
 * @param tier ランクティア
 * @return Master以上ならtrue
 */
function isMasterPlus(tier: RankTier): boolean {
  return (MASTER_PLUS_TIERS as readonly string[]).includes(tier);
}

/**
 * LP変動後のランクを計算する
 * @responsibility 現在のランク状態とLP変動値から、昇格・降格処理を含む新しいランク状態を算出する
 * @param currentTier 現在のティア
 * @param currentDivision 現在のディビジョン（4〜1、Master以上は0）
 * @param currentLp 現在のLP
 * @param lpChange LP変動値（正: 増加、負: 減少）
 * @param demotionShield 降格保護の残り回数
 * @return ランク変動結果
 */
export function calculateRankChange(
  currentTier: RankTier,
  currentDivision: number,
  currentLp: number,
  lpChange: number,
  demotionShield: number,
): RankChangeResult {
  let newLp = currentLp + lpChange;
  let newTier = currentTier;
  let newDivision = currentDivision;
  let promoted = false;
  let demoted = false;
  let shield = demotionShield;

  /* Master以上はLP上限なし。昇格処理のみ（ティア間昇格はLP累積で判定しない） */
  if (isMasterPlus(newTier)) {
    /* LP減少で0未満のケースを処理 */
    if (newLp < 0) {
      if (shield > 0) {
        /* 降格保護を消費してLPを0に補正 */
        newLp = 0;
        shield -= 1;
      } else {
        /* Master以上から降格する場合、1つ下のティアのI（最高ディビジョン）へ */
        const tierIndex = getTierIndex(newTier);
        if (tierIndex > 0) {
          newTier = TIER_ORDER[tierIndex - 1]!;
          newDivision = isMasterPlus(newTier) ? 0 : 1;
          newLp = LP_AFTER_DEMOTION;
          demoted = true;
        } else {
          newLp = 0;
        }
      }
    }
    return { newTier, newDivision, newLp, promoted, demoted, demotionShield: shield };
  }

  /* 昇格処理: LPがLP_MAX以上に到達した場合 */
  while (newLp >= LP_MAX) {
    const tierIndex = getTierIndex(newTier);

    if (newDivision === 1) {
      /* ディビジョンI（最高）→ 次のティアのIVに昇格 */
      if (tierIndex < TIER_ORDER.length - 1) {
        const nextTier = TIER_ORDER[tierIndex + 1]!;
        newTier = nextTier;

        /* Master以上に昇格した場合はディビジョンなし */
        if (isMasterPlus(nextTier)) {
          newDivision = 0;
          newLp = newLp - LP_MAX;
          promoted = true;
          shield = 1;
          /* Master以上はLP累積するのでループを抜ける */
          break;
        }

        newDivision = 4;
        newLp = newLp - LP_MAX;
        promoted = true;
        shield = 1;
      } else {
        /* 最高ティア（Challenger）ではLP上限なし */
        break;
      }
    } else {
      /* ディビジョンII〜IV → 1つ上のディビジョンへ */
      newDivision -= 1;
      newLp = newLp - LP_MAX;
      promoted = true;
      shield = 1;
    }
  }

  /* 降格処理: LPが0未満に到達した場合 */
  if (newLp < 0) {
    if (shield > 0) {
      /* 降格保護が有効: LPを0に補正し、保護を1消費 */
      newLp = 0;
      shield -= 1;
    } else {
      const tierIndex = getTierIndex(newTier);

      if (newDivision === 4) {
        /* ディビジョンIV（最低）→ 1つ下のティアのIに降格 */
        if (tierIndex > 0) {
          newTier = TIER_ORDER[tierIndex - 1]!;
          newDivision = 1;
          newLp = LP_AFTER_DEMOTION;
          demoted = true;
        } else {
          /* Iron IVが最低ランク: LP 0で停止 */
          newLp = 0;
        }
      } else {
        /* ディビジョンI〜III → 1つ下のディビジョンへ */
        newDivision += 1;
        newLp = LP_AFTER_DEMOTION;
        demoted = true;
      }
    }
  }

  return { newTier, newDivision, newLp, promoted, demoted, demotionShield: shield };
}

/**
 * ランクの表示名を取得する
 * @responsibility ティアとディビジョンから人間が読めるランク名を生成する
 * @param tier ランクティア
 * @param division ディビジョン（Master以上は0）
 * @return ランク表示名（例: "Gold III", "Master"）
 */
export function formatRankName(tier: RankTier, division: number): string {
  /* Master以上はディビジョン表示なし */
  if (isMasterPlus(tier)) {
    return tier;
  }

  /* ディビジョンをローマ数字に変換 */
  const romanNumerals: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };
  return `${tier} ${romanNumerals[division] ?? division}`;
}
