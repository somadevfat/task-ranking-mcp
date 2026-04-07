/**
 * クエリのテスト（インメモリDB使用）
 * @responsibility DB操作クエリの正確性をインメモリDBで検証する
 */

import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { SCHEMA_SQL } from "../../src/db/schema.ts";
import {
  getUserState,
  updateUserRank,
  incrementTasksCompleted,
  updateGachaTickets,
  addRestTicket,
  useRestTicket,
  addTask,
  getTaskById,
  completeTask,
  getActiveTasks,
  insertMatchHistory,
  getRecentHistory,
  getCurrentWinStreak,
  getActiveSeason,
  updateSeasonStats,
  finalizeSeason,
} from "../../src/db/queries.ts";

/**
 * テスト用のインメモリDBを作成・初期化するヘルパー
 * @responsibility 各テストケース用にクリーンなDBを提供する
 * @return 初期化済みのインメモリDB
 */
function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  /* user_stateの初期レコードを挿入 */
  db.query("INSERT INTO user_state (id, current_season_id) VALUES (1, '2026-Q2')").run();

  /* 初期シーズンを挿入 */
  db.query(
    "INSERT INTO seasons (id, start_date, end_date) VALUES ('2026-Q2', '2026-04-01', '2026-06-30')",
  ).run();

  return db;
}

describe("getUserState（ユーザー状態取得）", () => {
  test("初期状態が正しく返される", () => {
    const db = createTestDb();
    const state = getUserState(db);

    expect(state.id).toBe(1);
    expect(state.rank_tier).toBe("Iron");
    expect(state.rank_division).toBe(4);
    expect(state.current_lp).toBe(0);
    expect(state.gacha_tickets).toBe(0);
    expect(state.current_season_id).toBe("2026-Q2");
    db.close();
  });
});

describe("updateUserRank（ランク情報更新）", () => {
  test("ランク情報が正しく更新される", () => {
    const db = createTestDb();
    updateUserRank(db, "Gold", 3, 50, 1);

    const state = getUserState(db);
    expect(state.rank_tier).toBe("Gold");
    expect(state.rank_division).toBe(3);
    expect(state.current_lp).toBe(50);
    expect(state.demotion_shield).toBe(1);
    db.close();
  });
});

describe("incrementTasksCompleted（タスク完了数インクリメント）", () => {
  test("完了タスク数が1ずつ増加する", () => {
    const db = createTestDb();

    const first = incrementTasksCompleted(db);
    expect(first).toBe(1);

    const second = incrementTasksCompleted(db);
    expect(second).toBe(2);
    db.close();
  });
});

describe("updateGachaTickets（ガチャ券増減）", () => {
  test("ガチャ券が正しく増減する", () => {
    const db = createTestDb();

    updateGachaTickets(db, 3);
    expect(getUserState(db).gacha_tickets).toBe(3);

    updateGachaTickets(db, -1);
    expect(getUserState(db).gacha_tickets).toBe(2);
    db.close();
  });
});

describe("addRestTicket / useRestTicket（休憩券管理）", () => {
  test("5分券の追加と消費が正しい", () => {
    const db = createTestDb();

    addRestTicket(db, 5);
    expect(getUserState(db).rest_tickets_5).toBe(1);

    /* 消費時に5分が返る */
    const minutes = useRestTicket(db);
    expect(minutes).toBe(5);
    expect(getUserState(db).rest_tickets_5).toBe(0);
    db.close();
  });

  test("15分券の追加と消費が正しい", () => {
    const db = createTestDb();

    addRestTicket(db, 15);
    expect(getUserState(db).rest_tickets_15).toBe(1);

    /* 5分券がないので15分券が消費される */
    const minutes = useRestTicket(db);
    expect(minutes).toBe(15);
    db.close();
  });

  test("5分券優先で消費される", () => {
    const db = createTestDb();

    addRestTicket(db, 5);
    addRestTicket(db, 15);

    /* 5分券が優先される */
    const minutes = useRestTicket(db);
    expect(minutes).toBe(5);
    db.close();
  });

  test("休憩券がない場合はnullを返す", () => {
    const db = createTestDb();
    const minutes = useRestTicket(db);
    expect(minutes).toBeNull();
    db.close();
  });
});

describe("タスク操作", () => {
  test("タスクの追加と取得が正しい", () => {
    const db = createTestDb();
    const task = addTask(db, "テストタスク", "medium");

    expect(task.name).toBe("テストタスク");
    expect(task.difficulty).toBe("medium");
    expect(task.status).toBe("active");
    expect(task.is_penalty).toBe(0);

    /* IDで取得 */
    const fetched = getTaskById(db, task.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("テストタスク");
    db.close();
  });

  test("外れタスクの追加が正しい", () => {
    const db = createTestDb();
    const task = addTask(db, "スクワット10回", "low", 1);
    expect(task.is_penalty).toBe(1);
    db.close();
  });

  test("タスクの完了が正しい", () => {
    const db = createTestDb();
    const task = addTask(db, "完了テスト", "low");
    completeTask(db, task.id);

    const fetched = getTaskById(db, task.id);
    expect(fetched!.status).toBe("completed");
    expect(fetched!.completed_at).not.toBeNull();
    db.close();
  });

  test("アクティブタスク一覧は完了済みを含まない", () => {
    const db = createTestDb();
    addTask(db, "アクティブ1", "low");
    const task2 = addTask(db, "完了済み", "medium");
    addTask(db, "アクティブ2", "high");
    completeTask(db, task2.id);

    const active = getActiveTasks(db);
    expect(active.length).toBe(2);
    expect(active.map((t) => t.name)).toContain("アクティブ1");
    expect(active.map((t) => t.name)).toContain("アクティブ2");
    db.close();
  });
});

describe("試合履歴", () => {
  test("履歴の記録と取得が正しい", () => {
    const db = createTestDb();

    insertMatchHistory(db, {
      taskId: 1,
      taskName: "テストタスク",
      difficulty: "medium",
      result: "victory",
      lpChange: 23,
      lpAfter: 23,
      rankTierAfter: "Iron",
      rankDivisionAfter: 4,
      promotion: false,
      demotion: false,
      bonusTicket: false,
      penaltyTaskName: null,
      restMinutes: 10,
      seasonId: "2026-Q2",
    });

    const history = getRecentHistory(db, 10);
    expect(history.length).toBe(1);
    expect(history[0]!.task_name).toBe("テストタスク");
    expect(history[0]!.result).toBe("victory");
    expect(history[0]!.lp_change).toBe(23);
    db.close();
  });

  test("連勝数が正しく計算される", () => {
    const db = createTestDb();

    /* 連勝3の後にDefeat */
    const results = ["victory", "victory", "victory", "defeat"] as const;
    for (const result of results) {
      insertMatchHistory(db, {
        taskId: 1,
        taskName: "テスト",
        difficulty: "low",
        result,
        lpChange: result === "defeat" ? -10 : 15,
        lpAfter: 50,
        rankTierAfter: "Iron",
        rankDivisionAfter: 4,
        promotion: false,
        demotion: false,
        bonusTicket: false,
        penaltyTaskName: null,
        restMinutes: null,
        seasonId: "2026-Q2",
      });
    }

    /* 最新がdefeatなので連勝0 */
    const streak = getCurrentWinStreak(db);
    expect(streak).toBe(0);
    db.close();
  });
});

describe("シーズン操作", () => {
  test("アクティブシーズンが取得できる", () => {
    const db = createTestDb();
    const season = getActiveSeason(db);
    expect(season).not.toBeNull();
    expect(season!.id).toBe("2026-Q2");
    expect(season!.is_active).toBe(1);
    db.close();
  });

  test("シーズン戦績が正しく更新される", () => {
    const db = createTestDb();

    updateSeasonStats(db, "2026-Q2", "victory");
    updateSeasonStats(db, "2026-Q2", "defeat");
    updateSeasonStats(db, "2026-Q2", "critical_win");

    const season = getActiveSeason(db);
    expect(season!.total_matches).toBe(3);
    expect(season!.total_wins).toBe(2);
    expect(season!.total_defeats).toBe(1);
    expect(season!.total_critical_wins).toBe(1);
    db.close();
  });

  test("シーズン終了処理が正しい", () => {
    const db = createTestDb();

    finalizeSeason(db, "2026-Q2", "Gold", 3, 50);

    const season = db.query("SELECT * FROM seasons WHERE id = '2026-Q2'").get() as {
      is_active: number;
      final_rank_tier: string;
    };
    expect(season.is_active).toBe(0);
    expect(season.final_rank_tier).toBe("Gold");
    db.close();
  });
});
