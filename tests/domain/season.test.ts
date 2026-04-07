/**
 * シーズン管理ロジックのテスト
 * @responsibility シーズンID算出、期間計算、ソフトリセットの正確性を検証する
 */

import { describe, test, expect } from "bun:test";
import {
  getCurrentSeasonId,
  getSeasonStartDate,
  getSeasonEndDate,
  isSeasonExpired,
  softReset,
} from "../../src/domain/season.ts";

describe("getCurrentSeasonId（シーズンID算出）", () => {
  test("YYYY-QN形式の文字列を返す", () => {
    const seasonId = getCurrentSeasonId();
    /* 正規表現で形式チェック */
    expect(seasonId).toMatch(/^\d{4}-Q[1-4]$/);
  });
});

describe("getSeasonStartDate（シーズン開始日）", () => {
  test("Q1の開始日は1月1日", () => {
    expect(getSeasonStartDate("2026-Q1")).toBe("2026-01-01");
  });

  test("Q2の開始日は4月1日", () => {
    expect(getSeasonStartDate("2026-Q2")).toBe("2026-04-01");
  });

  test("Q3の開始日は7月1日", () => {
    expect(getSeasonStartDate("2026-Q3")).toBe("2026-07-01");
  });

  test("Q4の開始日は10月1日", () => {
    expect(getSeasonStartDate("2026-Q4")).toBe("2026-10-01");
  });
});

describe("getSeasonEndDate（シーズン終了日）", () => {
  test("Q1の終了日は3月31日", () => {
    expect(getSeasonEndDate("2026-Q1")).toBe("2026-03-31");
  });

  test("Q2の終了日は6月30日", () => {
    expect(getSeasonEndDate("2026-Q2")).toBe("2026-06-30");
  });

  test("Q3の終了日は9月30日", () => {
    expect(getSeasonEndDate("2026-Q3")).toBe("2026-09-30");
  });

  test("Q4の終了日は12月31日", () => {
    expect(getSeasonEndDate("2026-Q4")).toBe("2026-12-31");
  });
});

describe("isSeasonExpired（シーズン期限判定）", () => {
  test("過去の日付はtrue", () => {
    expect(isSeasonExpired("2020-01-01")).toBe(true);
  });

  test("未来の日付はfalse", () => {
    expect(isSeasonExpired("2099-12-31")).toBe(false);
  });
});

describe("softReset（ソフトリセット）", () => {
  test("Challenger → Diamond IV（Master以上は一律Diamond IV）", () => {
    const result = softReset("Challenger", 0);
    expect(result.tier).toBe("Diamond");
    expect(result.division).toBe(4);
    expect(result.lp).toBe(50);
  });

  test("Diamond I → Platinum IV（Diamondは2ティア下のPlatinum IV）", () => {
    const result = softReset("Diamond", 1);
    expect(result.tier).toBe("Platinum");
    expect(result.division).toBe(4);
    expect(result.lp).toBe(50);
  });

  test("Gold III → Silver III（2ティア降格、ディビジョン維持）", () => {
    const result = softReset("Gold", 3);
    expect(result.tier).toBe("Silver");
    expect(result.division).toBe(3);
    expect(result.lp).toBe(50);
  });

  test("Silver II → Bronze II（2ティア降格、ディビジョン維持）", () => {
    const result = softReset("Silver", 2);
    expect(result.tier).toBe("Bronze");
    expect(result.division).toBe(2);
    expect(result.lp).toBe(50);
  });

  test("Bronze I → Iron（最低ティアに到達）", () => {
    const result = softReset("Bronze", 1);
    expect(result.tier).toBe("Iron");
    expect(result.lp).toBe(50);
  });

  test("Iron III → Iron IV（最低値に補正）", () => {
    const result = softReset("Iron", 3);
    expect(result.tier).toBe("Iron");
    expect(result.division).toBe(4);
    expect(result.lp).toBe(50);
  });

  test("LP は常に50で開始", () => {
    const result = softReset("Master", 0);
    expect(result.lp).toBe(50);
  });
});
