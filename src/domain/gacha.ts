/**
 * ガチャ判定ロジック
 * @responsibility 確率に基づくガチャ抽選、難易度によるLP変動計算、外れタスクの選出を行う
 */

import type { Difficulty, GachaOutcome, SafeGachaOutcome } from "../types/index.ts";
import {
  DIFFICULTY_MULTIPLIER,
  GACHA_PROBABILITY_TABLE,
  PENALTY_TASKS,
  REST_MINUTES_MAX,
  REST_MINUTES_MIN,
  SAFE_GACHA_PROBABILITY_TABLE,
} from "./constants.ts";

/**
 * 重み付きランダム抽選を実行する汎用関数
 * @responsibility 重みの配列から確率に基づいて1つのインデックスを選出する
 * @param weights 各要素の重み配列
 * @param random 0〜1のランダム値（テスト用に外部注入可能）
 * @return 選出されたインデックス
 */
export function weightedRandom(weights: readonly number[], random: number): number {
  /* 重みの合計値を計算 */
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  /* ランダム値をスケーリングして閾値とする */
  let threshold = random * totalWeight;

  /* 各重みを順に減算し、閾値を下回ったインデックスを返す */
  for (let i = 0; i < weights.length; i++) {
    threshold -= weights[i]!;
    if (threshold < 0) {
      return i;
    }
  }

  /* フォールバック：浮動小数点誤差対策として最後の要素を返す */
  return weights.length - 1;
}

/**
 * ガチャ判定を実行する（通常ガチャ）
 * @responsibility タスク完了時のガチャ抽選を行い、結果とLP変動を返す
 * @param difficulty タスクの難易度
 * @param random ガチャ抽選用のランダム値（0〜1）
 * @param restRandom 休憩時間決定用のランダム値（0〜1）
 * @param penaltyRandom 外れタスク選出用のランダム値（0〜1）
 * @return ガチャ判定結果の詳細
 */
export function rollGacha(
  difficulty: Difficulty,
  random: number,
  restRandom: number,
  penaltyRandom: number,
): GachaOutcome {
  /* 確率テーブルから重みを抽出し、抽選を実行 */
  const weights = GACHA_PROBABILITY_TABLE.map((entry) => entry.weight);
  const index = weightedRandom(weights, random);
  const entry = GACHA_PROBABILITY_TABLE[index]!;

  /* 難易度倍率を適用してLP変動を算出 */
  const multiplier = DIFFICULTY_MULTIPLIER[difficulty];
  const baseLpChange = entry.baseLp;
  const finalLpChange = Math.round(baseLpChange * multiplier);

  /* Victory時は休憩時間をランダムに付与 */
  let restMinutes: number | null = null;
  if (entry.result === "victory") {
    restMinutes =
      Math.floor(restRandom * (REST_MINUTES_MAX - REST_MINUTES_MIN + 1)) + REST_MINUTES_MIN;
  }

  /* Defeat時は外れタスクをランダムに選出 */
  let penaltyTaskName: string | null = null;
  if (entry.result === "defeat") {
    const penaltyIndex = Math.floor(penaltyRandom * PENALTY_TASKS.length);
    penaltyTaskName = PENALTY_TASKS[penaltyIndex]!;
  }

  return {
    result: entry.result,
    baseLpChange,
    finalLpChange,
    restMinutes,
    penaltyTaskName,
  };
}

/**
 * 安全ガチャを実行する（ガチャ券消費時）
 * @responsibility Defeatが存在しない安全なガチャ抽選を行う
 * @param random 抽選用のランダム値（0〜1）
 * @return 安全ガチャの判定結果
 */
export function rollSafeGacha(random: number): SafeGachaOutcome {
  /* 安全ガチャの確率テーブルから重みを抽出し抽選 */
  const weights = SAFE_GACHA_PROBABILITY_TABLE.map((entry) => entry.weight);
  const index = weightedRandom(weights, random);
  const entry = SAFE_GACHA_PROBABILITY_TABLE[index]!;

  return {
    result: entry.result,
    lpChange: entry.lpChange,
    restMinutes: entry.restMinutes,
  };
}

/**
 * ガチャ券天井判定を行う
 * @responsibility 完了タスク数が5の倍数かどうかを判定する
 * @param tasksCompletedTotal インクリメント済みの通算完了タスク数
 * @return ガチャ券ボーナスが発生するならtrue
 */
export function shouldGrantBonusTicket(tasksCompletedTotal: number): boolean {
  return tasksCompletedTotal > 0 && tasksCompletedTotal % 5 === 0;
}
