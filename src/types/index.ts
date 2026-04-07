/**
 * ガチャタスクMCPサーバーの全型定義
 * @responsibility システム全体で使用される型を一元管理する
 */

/** ランクティア（低→高の順序） */
export type RankTier =
  | "Iron"
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Emerald"
  | "Diamond"
  | "Master"
  | "Grandmaster"
  | "Challenger";

/** タスクの難易度 */
export type Difficulty = "low" | "medium" | "high";

/** タスクのステータス */
export type TaskStatus = "active" | "completed";

/** ガチャの判定結果 */
export type GachaResult = "victory" | "defeat" | "critical_win";

/** 安全ガチャの判定結果 */
export type SafeGachaResult =
  | "lp_small_boost"
  | "lp_large_boost"
  | "rest_5"
  | "rest_15";

/** ユーザー状態（user_stateテーブルの行） */
export interface UserState {
  id: number;
  rank_tier: RankTier;
  rank_division: number;
  current_lp: number;
  demotion_shield: number;
  gacha_tickets: number;
  rest_tickets_5: number;
  rest_tickets_15: number;
  tasks_completed_total: number;
  current_season_id: string;
  created_at: string;
  updated_at: string;
}

/** タスク（tasksテーブルの行） */
export interface Task {
  id: number;
  name: string;
  difficulty: Difficulty;
  status: TaskStatus;
  is_penalty: number;
  created_at: string;
  completed_at: string | null;
}

/** 試合履歴（match_historyテーブルの行） */
export interface MatchHistory {
  id: number;
  task_id: number;
  task_name: string;
  difficulty: Difficulty;
  result: GachaResult;
  lp_change: number;
  lp_after: number;
  rank_tier_after: RankTier;
  rank_division_after: number;
  promotion: number;
  demotion: number;
  bonus_ticket: number;
  penalty_task_name: string | null;
  rest_minutes: number | null;
  season_id: string;
  created_at: string;
}

/** シーズン（seasonsテーブルの行） */
export interface Season {
  id: string;
  start_date: string;
  end_date: string;
  final_rank_tier: RankTier | null;
  final_rank_division: number | null;
  final_lp: number | null;
  total_matches: number;
  total_wins: number;
  total_defeats: number;
  total_critical_wins: number;
  is_active: number;
}

/** ランク情報（ティアとディビジョンのペア） */
export interface RankInfo {
  tier: RankTier;
  division: number;
  lp: number;
}

/** ガチャ判定結果の詳細 */
export interface GachaOutcome {
  result: GachaResult;
  baseLpChange: number;
  finalLpChange: number;
  restMinutes: number | null;
  penaltyTaskName: string | null;
}

/** 安全ガチャ判定結果の詳細 */
export interface SafeGachaOutcome {
  result: SafeGachaResult;
  lpChange: number;
  restMinutes: number | null;
}

/** ランク変動結果 */
export interface RankChangeResult {
  newTier: RankTier;
  newDivision: number;
  newLp: number;
  promoted: boolean;
  demoted: boolean;
  demotionShield: number;
}

/** ソフトリセット結果 */
export interface SoftResetResult {
  tier: RankTier;
  division: number;
  lp: number;
}
