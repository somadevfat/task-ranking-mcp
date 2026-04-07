/**
 * ガチャタスクMCPサーバーの全定数定義
 * @responsibility 確率、LP値、ティア順序、外れタスクリストなど、システム全体の定数を一元管理する
 */

import type { Difficulty, GachaResult, RankTier, SafeGachaResult } from "../types/index.ts";

/** ティア順序（低→高）。インデックスが大きいほど高ランク */
export const TIER_ORDER: readonly RankTier[] = [
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
] as const;

/** Master以上のティア（ディビジョンなし、LP上限なし） */
export const MASTER_PLUS_TIERS: readonly RankTier[] = [
  "Master",
  "Grandmaster",
  "Challenger",
] as const;

/** 難易度ごとのLP変動倍率マッピング */
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  low: 1.0,
  medium: 1.5,
  high: 2.0,
} as const;

/** 難易度の日本語表示名 */
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  low: "低",
  medium: "中",
  high: "高",
} as const;

/** ガチャ判定の確率テーブル（重み付き） */
export const GACHA_PROBABILITY_TABLE: readonly {
  result: GachaResult;
  weight: number;
  baseLp: number;
}[] = [
  { result: "victory", weight: 60, baseLp: 15 },
  { result: "defeat", weight: 30, baseLp: -10 },
  { result: "critical_win", weight: 10, baseLp: 30 },
] as const;

/** 安全ガチャの確率テーブル（重み付き） */
export const SAFE_GACHA_PROBABILITY_TABLE: readonly {
  result: SafeGachaResult;
  weight: number;
  lpChange: number;
  restMinutes: number | null;
}[] = [
  { result: "lp_small_boost", weight: 50, lpChange: 10, restMinutes: null },
  { result: "lp_large_boost", weight: 20, lpChange: 25, restMinutes: null },
  { result: "rest_5", weight: 20, lpChange: 0, restMinutes: 5 },
  { result: "rest_15", weight: 10, lpChange: 0, restMinutes: 15 },
] as const;

/** Victory時の休憩時間範囲（分） */
export const REST_MINUTES_MIN = 5;
export const REST_MINUTES_MAX = 15;

/** LP上限（Master未満） */
export const LP_MAX = 100;

/** 降格後のLP値 */
export const LP_AFTER_DEMOTION = 75;

/** ガチャ券天井のタスク数間隔 */
export const TICKET_CEILING_INTERVAL = 5;

/** Defeat時に自動生成される外れタスクのプリセット */
export const PENALTY_TASKS = [
  "机の上を整理する",
  "メール1件に返信する",
  "水を1杯飲む",
  "スクワット10回",
  "ストレージの不要ファイルを3つ消す",
  "窓を開けて深呼吸を3回する",
  "財布の中身を整理する",
  "今日の予定を声に出して確認する",
  "1分間ストレッチする",
  "デスクトップのアイコンを整理する",
] as const;
