/**
 * テーブル作成SQL定数
 * @responsibility 全テーブルのCREATE TABLE文を文字列定数として保持する
 */

export const SCHEMA_SQL = `
-- ユーザー状態テーブル（1レコード固定）
CREATE TABLE IF NOT EXISTS user_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),

  -- ランク情報
  rank_tier TEXT NOT NULL DEFAULT 'Iron',
  rank_division INTEGER NOT NULL DEFAULT 4,
  current_lp INTEGER NOT NULL DEFAULT 0,
  demotion_shield INTEGER NOT NULL DEFAULT 0,

  -- 所持アイテム
  gacha_tickets INTEGER NOT NULL DEFAULT 0,
  rest_tickets_5 INTEGER NOT NULL DEFAULT 0,
  rest_tickets_15 INTEGER NOT NULL DEFAULT 0,

  -- 統計カウンター
  tasks_completed_total INTEGER NOT NULL DEFAULT 0,

  -- シーズン情報
  current_season_id TEXT NOT NULL DEFAULT '',

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- タスクテーブル
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  is_penalty INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- 試合履歴テーブル
CREATE TABLE IF NOT EXISTS match_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  task_name TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('victory', 'defeat', 'critical_win')),
  lp_change INTEGER NOT NULL,
  lp_after INTEGER NOT NULL,
  rank_tier_after TEXT NOT NULL,
  rank_division_after INTEGER NOT NULL,
  promotion INTEGER NOT NULL DEFAULT 0,
  demotion INTEGER NOT NULL DEFAULT 0,
  bonus_ticket INTEGER NOT NULL DEFAULT 0,
  penalty_task_name TEXT,
  rest_minutes INTEGER,
  season_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- シーズンテーブル
CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  final_rank_tier TEXT,
  final_rank_division INTEGER,
  final_lp INTEGER,
  total_matches INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_defeats INTEGER NOT NULL DEFAULT 0,
  total_critical_wins INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);
`;
