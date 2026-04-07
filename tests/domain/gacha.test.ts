/**
 * ガチャ判定ロジックのテスト
 * @responsibility ガチャの確率判定、LP変動計算、天井システムの正確性を検証する
 */

import { describe, test, expect } from "bun:test";
import { rollGacha, rollSafeGacha, shouldGrantBonusTicket, weightedRandom } from "../../src/domain/gacha.ts";

describe("weightedRandom（重み付きランダム抽選）", () => {
  test("ランダム値0に近い場合、最初の要素が選ばれる", () => {
    const result = weightedRandom([60, 30, 10], 0.0);
    expect(result).toBe(0);
  });

  test("ランダム値が2番目の要素の範囲にある場合、2番目が選ばれる", () => {
    /* 60/100 = 0.6 が1番目の境界。0.7は2番目の範囲 */
    const result = weightedRandom([60, 30, 10], 0.7);
    expect(result).toBe(1);
  });

  test("ランダム値が3番目の要素の範囲にある場合、3番目が選ばれる", () => {
    /* 90/100 = 0.9 が2番目の境界。0.95は3番目の範囲 */
    const result = weightedRandom([60, 30, 10], 0.95);
    expect(result).toBe(2);
  });

  test("ランダム値が1.0の場合、最後の要素が選ばれる（フォールバック）", () => {
    const result = weightedRandom([60, 30, 10], 1.0);
    expect(result).toBe(2);
  });
});

describe("rollGacha（通常ガチャ判定）", () => {
  test("Victory判定: 基本LP +15が返される", () => {
    /* random=0.0 → 最初の要素（Victory、weight=60） */
    const result = rollGacha("low", 0.0, 0.5, 0.5);
    expect(result.result).toBe("victory");
    expect(result.baseLpChange).toBe(15);
    expect(result.finalLpChange).toBe(15);
  });

  test("Defeat判定: 基本LP -10が返される", () => {
    /* random=0.7 → 2番目の要素（Defeat、weight=30） */
    const result = rollGacha("low", 0.7, 0.5, 0.5);
    expect(result.result).toBe("defeat");
    expect(result.baseLpChange).toBe(-10);
    expect(result.finalLpChange).toBe(-10);
  });

  test("Critical Win判定: 基本LP +30が返される", () => {
    /* random=0.95 → 3番目の要素（Critical Win、weight=10） */
    const result = rollGacha("low", 0.95, 0.5, 0.5);
    expect(result.result).toBe("critical_win");
    expect(result.baseLpChange).toBe(30);
    expect(result.finalLpChange).toBe(30);
  });

  test("難易度medium: LP変動倍率×1.5が適用される", () => {
    const result = rollGacha("medium", 0.0, 0.5, 0.5);
    expect(result.result).toBe("victory");
    /* 15 × 1.5 = 22.5 → Math.round = 23 */
    expect(result.finalLpChange).toBe(23);
  });

  test("難易度high: LP変動倍率×2.0が適用される", () => {
    const result = rollGacha("high", 0.0, 0.5, 0.5);
    expect(result.result).toBe("victory");
    /* 15 × 2.0 = 30 */
    expect(result.finalLpChange).toBe(30);
  });

  test("難易度high + Defeat: LP変動倍率×2.0が適用される", () => {
    const result = rollGacha("high", 0.7, 0.5, 0.5);
    expect(result.result).toBe("defeat");
    /* -10 × 2.0 = -20 */
    expect(result.finalLpChange).toBe(-20);
  });

  test("Victory時: 休憩時間が5〜15分の範囲で付与される", () => {
    const result = rollGacha("low", 0.0, 0.0, 0.5);
    expect(result.result).toBe("victory");
    expect(result.restMinutes).toBeGreaterThanOrEqual(5);
    expect(result.restMinutes).toBeLessThanOrEqual(15);
  });

  test("Victory時: restRandom=0.0で最小値(5分)が返される", () => {
    const result = rollGacha("low", 0.0, 0.0, 0.5);
    expect(result.restMinutes).toBe(5);
  });

  test("Defeat時: 外れタスク名が返される", () => {
    const result = rollGacha("low", 0.7, 0.5, 0.0);
    expect(result.result).toBe("defeat");
    expect(result.penaltyTaskName).toBeTruthy();
    expect(typeof result.penaltyTaskName).toBe("string");
  });

  test("Critical Win時: 休憩時間と外れタスクはnull", () => {
    const result = rollGacha("low", 0.95, 0.5, 0.5);
    expect(result.result).toBe("critical_win");
    expect(result.restMinutes).toBeNull();
    expect(result.penaltyTaskName).toBeNull();
  });
});

describe("rollSafeGacha（安全ガチャ）", () => {
  test("LP小ブースト: +10 LPが返される", () => {
    /* random=0.0 → LP小ブースト（weight=50） */
    const result = rollSafeGacha(0.0);
    expect(result.result).toBe("lp_small_boost");
    expect(result.lpChange).toBe(10);
    expect(result.restMinutes).toBeNull();
  });

  test("LP大ブースト: +25 LPが返される", () => {
    /* random=0.55 → LP大ブースト（weight=20、累積50-70） */
    const result = rollSafeGacha(0.55);
    expect(result.result).toBe("lp_large_boost");
    expect(result.lpChange).toBe(25);
  });

  test("休憩券5分: 0 LPと5分が返される", () => {
    /* random=0.75 → 休憩5分（weight=20、累積70-90） */
    const result = rollSafeGacha(0.75);
    expect(result.result).toBe("rest_5");
    expect(result.lpChange).toBe(0);
    expect(result.restMinutes).toBe(5);
  });

  test("休憩券15分: 0 LPと15分が返される", () => {
    /* random=0.95 → 休憩15分（weight=10、累積90-100） */
    const result = rollSafeGacha(0.95);
    expect(result.result).toBe("rest_15");
    expect(result.lpChange).toBe(0);
    expect(result.restMinutes).toBe(15);
  });
});

describe("shouldGrantBonusTicket（天井システム）", () => {
  test("5タスク目でガチャ券が付与される", () => {
    expect(shouldGrantBonusTicket(5)).toBe(true);
  });

  test("10タスク目でガチャ券が付与される", () => {
    expect(shouldGrantBonusTicket(10)).toBe(true);
  });

  test("3タスク目ではガチャ券は付与されない", () => {
    expect(shouldGrantBonusTicket(3)).toBe(false);
  });

  test("0タスクではガチャ券は付与されない", () => {
    expect(shouldGrantBonusTicket(0)).toBe(false);
  });

  test("1タスク目ではガチャ券は付与されない", () => {
    expect(shouldGrantBonusTicket(1)).toBe(false);
  });
});
