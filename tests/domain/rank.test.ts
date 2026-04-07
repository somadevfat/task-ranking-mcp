/**
 * ランク昇降格ロジックのテスト
 * @responsibility ランクの昇格・降格・保護ロジックの正確性を検証する
 */

import { describe, test, expect } from "bun:test";
import { calculateRankChange, formatRankName } from "../../src/domain/rank.ts";

describe("calculateRankChange（ランク変動計算）", () => {
  /* === 昇格テスト === */

  test("LP 100到達時: ディビジョンが1つ上がる", () => {
    /* Silver III (LP:90) + 15LP = 105LP → Silver II (LP:5) */
    const result = calculateRankChange("Silver", 3, 90, 15, 0);
    expect(result.newTier).toBe("Silver");
    expect(result.newDivision).toBe(2);
    expect(result.newLp).toBe(5);
    expect(result.promoted).toBe(true);
  });

  test("ディビジョンI → 次ティアIVへの昇格", () => {
    /* Silver I (LP:90) + 15LP = 105LP → Gold IV (LP:5) */
    const result = calculateRankChange("Silver", 1, 90, 15, 0);
    expect(result.newTier).toBe("Gold");
    expect(result.newDivision).toBe(4);
    expect(result.newLp).toBe(5);
    expect(result.promoted).toBe(true);
  });

  test("昇格発生時: 降格保護が1に設定される", () => {
    const result = calculateRankChange("Silver", 3, 90, 15, 0);
    expect(result.demotionShield).toBe(1);
  });

  test("Diamond I → Master への昇格: ディビジョンなしになる", () => {
    const result = calculateRankChange("Diamond", 1, 90, 15, 0);
    expect(result.newTier).toBe("Master");
    expect(result.newDivision).toBe(0);
    expect(result.promoted).toBe(true);
  });

  test("LP100未達: 昇格しない", () => {
    const result = calculateRankChange("Silver", 3, 50, 15, 0);
    expect(result.newTier).toBe("Silver");
    expect(result.newDivision).toBe(3);
    expect(result.newLp).toBe(65);
    expect(result.promoted).toBe(false);
  });

  /* === 降格テスト === */

  test("LP 0未満で降格: LP 75に設定される", () => {
    /* Gold II (LP:5) - 10LP = -5LP → Gold III (LP:75) */
    const result = calculateRankChange("Gold", 2, 5, -10, 0);
    expect(result.newTier).toBe("Gold");
    expect(result.newDivision).toBe(3);
    expect(result.newLp).toBe(75);
    expect(result.demoted).toBe(true);
  });

  test("ディビジョンIV → 前ティアIへの降格", () => {
    /* Gold IV (LP:5) - 10LP = -5LP → Silver I (LP:75) */
    const result = calculateRankChange("Gold", 4, 5, -10, 0);
    expect(result.newTier).toBe("Silver");
    expect(result.newDivision).toBe(1);
    expect(result.newLp).toBe(75);
    expect(result.demoted).toBe(true);
  });

  test("降格保護が機能する: 保護あり時はLP 0で止まる", () => {
    const result = calculateRankChange("Gold", 2, 5, -10, 1);
    expect(result.newTier).toBe("Gold");
    expect(result.newDivision).toBe(2);
    expect(result.newLp).toBe(0);
    expect(result.demoted).toBe(false);
    expect(result.demotionShield).toBe(0);
  });

  test("Iron IVでLP 0未満: LP 0で止まる（最低ランクから降格しない）", () => {
    const result = calculateRankChange("Iron", 4, 5, -10, 0);
    expect(result.newTier).toBe("Iron");
    expect(result.newDivision).toBe(4);
    expect(result.newLp).toBe(0);
    expect(result.demoted).toBe(false);
  });

  /* === Master以上のテスト === */

  test("Master以上: LPが100を超えて累積する", () => {
    const result = calculateRankChange("Master", 0, 150, 30, 0);
    expect(result.newTier).toBe("Master");
    expect(result.newDivision).toBe(0);
    expect(result.newLp).toBe(180);
  });

  test("Master以上: LP 0未満で降格保護なし→ Diamond I へ降格", () => {
    const result = calculateRankChange("Master", 0, 5, -10, 0);
    expect(result.newTier).toBe("Diamond");
    expect(result.newDivision).toBe(1);
    expect(result.newLp).toBe(75);
    expect(result.demoted).toBe(true);
  });

  test("Master以上: LP 0未満で降格保護あり→ LP 0で止まる", () => {
    const result = calculateRankChange("Master", 0, 5, -10, 1);
    expect(result.newTier).toBe("Master");
    expect(result.newDivision).toBe(0);
    expect(result.newLp).toBe(0);
    expect(result.demoted).toBe(false);
    expect(result.demotionShield).toBe(0);
  });
});

describe("formatRankName（ランク表示名）", () => {
  test("通常ティア: ティア名 + ローマ数字", () => {
    expect(formatRankName("Gold", 3)).toBe("Gold III");
    expect(formatRankName("Silver", 1)).toBe("Silver I");
    expect(formatRankName("Iron", 4)).toBe("Iron IV");
  });

  test("Master以上: ティア名のみ", () => {
    expect(formatRankName("Master", 0)).toBe("Master");
    expect(formatRankName("Grandmaster", 0)).toBe("Grandmaster");
    expect(formatRankName("Challenger", 0)).toBe("Challenger");
  });
});
