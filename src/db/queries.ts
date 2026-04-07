/**
 * 全クエリ関数（読み書き）
 * @responsibility データベースの読み書き操作をすべて一元管理する
 */

import type { Database } from "bun:sqlite";
import type {
  Difficulty,
  GachaResult,
  MatchHistory,
  RankTier,
  Season,
  Task,
  UserState,
} from "../types/index.ts";

/* ===========================================================
 * ユーザー状態 (user_state)
 * =========================================================== */

/**
 * ユーザー状態を取得する
 * @responsibility user_stateテーブルからid=1のレコードを取得する
 * @param db データベースインスタンス
 * @return ユーザー状態
 */
export function getUserState(db: Database): UserState {
  const row = db.query("SELECT * FROM user_state WHERE id = 1").get() as UserState | null;
  if (!row) {
    throw new Error("ユーザー状態が見つかりません。データベースを初期化してください。");
  }
  return row;
}

/**
 * ユーザー状態のランク情報を更新する
 * @responsibility ランクティア、ディビジョン、LP、降格保護を一括更新する
 * @param db データベースインスタンス
 * @param tier ランクティア
 * @param division ディビジョン
 * @param lp LP
 * @param demotionShield 降格保護の残り回数
 */
export function updateUserRank(
  db: Database,
  tier: RankTier,
  division: number,
  lp: number,
  demotionShield: number,
): void {
  db.query(
    `UPDATE user_state 
     SET rank_tier = ?, rank_division = ?, current_lp = ?, demotion_shield = ?, 
         updated_at = datetime('now')
     WHERE id = 1`,
  ).run(tier, division, lp, demotionShield);
}

/**
 * 通算完了タスク数をインクリメントする
 * @responsibility tasks_completed_totalを1増やして更新後の値を返す
 * @param db データベースインスタンス
 * @return インクリメント後の通算完了タスク数
 */
export function incrementTasksCompleted(db: Database): number {
  db.query(
    `UPDATE user_state 
     SET tasks_completed_total = tasks_completed_total + 1, updated_at = datetime('now') 
     WHERE id = 1`,
  ).run();

  /* 更新後の値を取得 */
  const state = getUserState(db);
  return state.tasks_completed_total;
}

/**
 * ガチャ券を増減する
 * @responsibility gacha_ticketsの枚数を変更する
 * @param db データベースインスタンス
 * @param delta 増減値（正: 追加、負: 消費）
 */
export function updateGachaTickets(db: Database, delta: number): void {
  db.query(
    `UPDATE user_state 
     SET gacha_tickets = gacha_tickets + ?, updated_at = datetime('now') 
     WHERE id = 1`,
  ).run(delta);
}

/**
 * 休憩券を増やす
 * @responsibility 5分券または15分券の枚数を増やす
 * @param db データベースインスタンス
 * @param minutes 5または15
 */
export function addRestTicket(db: Database, minutes: 5 | 15): void {
  const column = minutes === 5 ? "rest_tickets_5" : "rest_tickets_15";
  db.query(
    `UPDATE user_state 
     SET ${column} = ${column} + 1, updated_at = datetime('now') 
     WHERE id = 1`,
  ).run();
}

/**
 * 休憩券を消費する
 * @responsibility 5分券または15分券から使用可能な1枚を消費する
 * @param db データベースインスタンス
 * @return 使用した休憩券の分数（null: 所持なし）
 */
export function useRestTicket(db: Database): number | null {
  const state = getUserState(db);

  /* 5分券を優先して消費する */
  if (state.rest_tickets_5 > 0) {
    db.query(
      `UPDATE user_state 
       SET rest_tickets_5 = rest_tickets_5 - 1, updated_at = datetime('now') 
       WHERE id = 1`,
    ).run();
    return 5;
  }

  /* 5分券がなければ15分券を消費 */
  if (state.rest_tickets_15 > 0) {
    db.query(
      `UPDATE user_state 
       SET rest_tickets_15 = rest_tickets_15 - 1, updated_at = datetime('now') 
       WHERE id = 1`,
    ).run();
    return 15;
  }

  return null;
}

/**
 * シーズンIDを更新する
 * @responsibility user_stateのcurrent_season_idを更新する
 * @param db データベースインスタンス
 * @param seasonId 新しいシーズンID
 */
export function updateCurrentSeasonId(db: Database, seasonId: string): void {
  db.query(
    `UPDATE user_state 
     SET current_season_id = ?, updated_at = datetime('now') 
     WHERE id = 1`,
  ).run(seasonId);
}

/* ===========================================================
 * タスク (tasks)
 * =========================================================== */

/**
 * タスクを追加する
 * @responsibility tasksテーブルに新しいタスクを挿入する
 * @param db データベースインスタンス
 * @param name タスク名
 * @param difficulty 難易度
 * @param isPenalty 外れタスクなら1
 * @return 追加されたタスク
 */
export function addTask(
  db: Database,
  name: string,
  difficulty: Difficulty,
  isPenalty: number = 0,
): Task {
  const result = db.query(
    `INSERT INTO tasks (name, difficulty, is_penalty) VALUES (?, ?, ?) RETURNING *`,
  ).get(name, difficulty, isPenalty) as Task;
  return result;
}

/**
 * タスクをIDで取得する
 * @responsibility 指定IDのタスクを取得する
 * @param db データベースインスタンス
 * @param taskId タスクID
 * @return タスク（存在しなければnull）
 */
export function getTaskById(db: Database, taskId: number): Task | null {
  return db.query("SELECT * FROM tasks WHERE id = ?").get(taskId) as Task | null;
}

/**
 * タスクを完了状態にする
 * @responsibility 指定IDのタスクのstatusをcompletedに変更する
 * @param db データベースインスタンス
 * @param taskId タスクID
 */
export function completeTask(db: Database, taskId: number): void {
  db.query(
    `UPDATE tasks 
     SET status = 'completed', completed_at = datetime('now') 
     WHERE id = ?`,
  ).run(taskId);
}

/**
 * アクティブ（未完了）タスク一覧を取得する
 * @responsibility statusがactiveのタスクを作成日順で返す
 * @param db データベースインスタンス
 * @return アクティブタスクの配列
 */
export function getActiveTasks(db: Database): Task[] {
  return db.query(
    "SELECT * FROM tasks WHERE status = 'active' ORDER BY created_at ASC",
  ).all() as Task[];
}

/* ===========================================================
 * 試合履歴 (match_history)
 * =========================================================== */

/**
 * 試合履歴を記録する
 * @responsibility match_historyテーブルに結果を挿入する
 * @param db データベースインスタンス
 * @param params 試合履歴のパラメータ
 * @return 記録された試合履歴
 */
export function insertMatchHistory(
  db: Database,
  params: {
    taskId: number;
    taskName: string;
    difficulty: Difficulty;
    result: GachaResult;
    lpChange: number;
    lpAfter: number;
    rankTierAfter: RankTier;
    rankDivisionAfter: number;
    promotion: boolean;
    demotion: boolean;
    bonusTicket: boolean;
    penaltyTaskName: string | null;
    restMinutes: number | null;
    seasonId: string;
  },
): MatchHistory {
  return db.query(
    `INSERT INTO match_history 
     (task_id, task_name, difficulty, result, lp_change, lp_after, 
      rank_tier_after, rank_division_after, promotion, demotion, 
      bonus_ticket, penalty_task_name, rest_minutes, season_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  ).get(
    params.taskId, params.taskName, params.difficulty, params.result,
    params.lpChange, params.lpAfter, params.rankTierAfter, params.rankDivisionAfter,
    params.promotion ? 1 : 0, params.demotion ? 1 : 0,
    params.bonusTicket ? 1 : 0, params.penaltyTaskName, params.restMinutes,
    params.seasonId,
  ) as MatchHistory;
}

/**
 * 直近N件の試合履歴を取得する
 * @responsibility match_historyテーブルから最新N件を返す
 * @param db データベースインスタンス
 * @param limit 取得件数（デフォルト20、最大50）
 * @return 試合履歴の配列
 */
export function getRecentHistory(db: Database, limit: number = 20): MatchHistory[] {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  return db.query(
    "SELECT * FROM match_history ORDER BY created_at DESC, id DESC LIMIT ?",
  ).all(safeLimit) as MatchHistory[];
}

/**
 * 今日の戦績を取得する
 * @responsibility 今日の勝敗数を集計する
 * @param db データベースインスタンス
 * @return 今日の戦績（勝ち数、負け数、合計）
 */
export function getTodayStats(db: Database): { wins: number; defeats: number; total: number } {
  const rows = db.query(
    `SELECT result, COUNT(*) as count 
     FROM match_history 
     WHERE date(created_at) = date('now') 
     GROUP BY result`,
  ).all() as { result: GachaResult; count: number }[];

  let wins = 0;
  let defeats = 0;
  for (const row of rows) {
    if (row.result === "victory" || row.result === "critical_win") {
      wins += row.count;
    } else {
      defeats += row.count;
    }
  }

  return { wins, defeats, total: wins + defeats };
}

/**
 * 連勝数を計算する
 * @responsibility 直近の連続勝利数を返す（Defeatで途切れる）
 * @param db データベースインスタンス
 * @return 連勝数（0以上）
 */
export function getCurrentWinStreak(db: Database): number {
  const history = db.query(
    "SELECT result FROM match_history ORDER BY created_at DESC, id DESC",
  ).all() as { result: GachaResult }[];

  let streak = 0;
  for (const row of history) {
    if (row.result === "victory" || row.result === "critical_win") {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/* ===========================================================
 * シーズン (seasons)
 * =========================================================== */

/**
 * アクティブなシーズンを取得する
 * @responsibility is_active=1のシーズンを返す
 * @param db データベースインスタンス
 * @return アクティブシーズン（存在しなければnull）
 */
export function getActiveSeason(db: Database): Season | null {
  return db.query(
    "SELECT * FROM seasons WHERE is_active = 1",
  ).get() as Season | null;
}

/**
 * シーズンの戦績を更新する（結果に応じてカウンターをインクリメント）
 * @responsibility seasonsテーブルの戦績カウンターを更新する
 * @param db データベースインスタンス
 * @param seasonId シーズンID
 * @param result ガチャ結果
 */
export function updateSeasonStats(db: Database, seasonId: string, result: GachaResult): void {
  /* 結果に応じた列名を決定 */
  const winsIncrement = result === "victory" || result === "critical_win" ? 1 : 0;
  const defeatsIncrement = result === "defeat" ? 1 : 0;
  const criticalIncrement = result === "critical_win" ? 1 : 0;

  db.query(
    `UPDATE seasons 
     SET total_matches = total_matches + 1, 
         total_wins = total_wins + ?, 
         total_defeats = total_defeats + ?, 
         total_critical_wins = total_critical_wins + ?
     WHERE id = ?`,
  ).run(winsIncrement, defeatsIncrement, criticalIncrement, seasonId);
}

/**
 * シーズンを終了する
 * @responsibility アクティブシーズンの最終成績を記録しis_activeを0にする
 * @param db データベースインスタンス
 * @param seasonId シーズンID
 * @param finalTier 最終ティア
 * @param finalDivision 最終ディビジョン
 * @param finalLp 最終LP
 */
export function finalizeSeason(
  db: Database,
  seasonId: string,
  finalTier: RankTier,
  finalDivision: number,
  finalLp: number,
): void {
  db.query(
    `UPDATE seasons 
     SET is_active = 0, final_rank_tier = ?, final_rank_division = ?, final_lp = ? 
     WHERE id = ?`,
  ).run(finalTier, finalDivision, finalLp, seasonId);
}

/**
 * 新しいシーズンを開始する
 * @responsibility seasonsテーブルに新しいシーズンレコードを挿入する
 * @param db データベースインスタンス
 * @param seasonId シーズンID
 * @param startDate 開始日
 * @param endDate 終了日
 */
export function insertSeason(
  db: Database,
  seasonId: string,
  startDate: string,
  endDate: string,
): void {
  db.query(
    "INSERT OR IGNORE INTO seasons (id, start_date, end_date) VALUES (?, ?, ?)",
  ).run(seasonId, startDate, endDate);
}
