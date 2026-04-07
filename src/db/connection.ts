/**
 * SQLiteコネクション管理・初期化
 * @responsibility データベースファイルの接続管理と初回テーブル作成・初期データ挿入を行う
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { SCHEMA_SQL } from "./schema.ts";
import { getCurrentSeasonId, getSeasonStartDate, getSeasonEndDate } from "../domain/season.ts";

/** データベースファイルのデフォルトパス */
const DB_DIR = `${homedir()}/.gacha-task`;
const DB_PATH = `${DB_DIR}/gacha.db`;

/** データベースインスタンスのシングルトン */
let dbInstance: Database | null = null;

/**
 * データベースの初期化SQLを実行する
 * @responsibility テーブル作成と初期レコード挿入を行う
 * @param db SQLiteデータベースインスタンス
 */
function initializeDatabase(db: Database): void {
  /* テーブル作成SQLを実行 */
  db.exec(SCHEMA_SQL);

  /* user_stateの初期レコードが存在するか確認 */
  const existing = db.query("SELECT id FROM user_state WHERE id = 1").get();
  if (!existing) {
    /* 現在のシーズンIDを算出 */
    const seasonId = getCurrentSeasonId();
    const startDate = getSeasonStartDate(seasonId);
    const endDate = getSeasonEndDate(seasonId);

    /* user_stateの初期レコードを挿入 */
    db.query(
      "INSERT INTO user_state (id, current_season_id) VALUES (1, ?)",
    ).run(seasonId);

    /* seasonsテーブルに初期シーズンを挿入 */
    db.query(
      "INSERT OR IGNORE INTO seasons (id, start_date, end_date) VALUES (?, ?, ?)",
    ).run(seasonId, startDate, endDate);

    console.error(`[gacha-task-mcp] データベースを初期化しました (シーズン: ${seasonId})`);
  }
}

/**
 * データベース接続を取得する（シングルトン）
 * @responsibility DBファイルの存在確認・ディレクトリ作成・接続・初期化を一括で行う
 * @return SQLiteデータベースインスタンス
 */
export function getDatabase(): Database {
  if (dbInstance) {
    return dbInstance;
  }

  /* ディレクトリが存在しない場合は作成 */
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
    console.error(`[gacha-task-mcp] データディレクトリを作成しました: ${DB_DIR}`);
  }

  /* SQLiteデータベースを開く（存在しなければ自動作成） */
  dbInstance = new Database(DB_PATH);

  /* WALモードを有効化（パフォーマンス向上） */
  dbInstance.exec("PRAGMA journal_mode = WAL");

  /* 外部キー制約を有効化 */
  dbInstance.exec("PRAGMA foreign_keys = ON");

  /* DB初期化を実行 */
  initializeDatabase(dbInstance);

  console.error(`[gacha-task-mcp] データベースに接続しました: ${DB_PATH}`);

  return dbInstance;
}

/**
 * テスト用: インメモリデータベースを作成する
 * @responsibility テスト環境用のインメモリDBを作成・初期化する
 * @return インメモリSQLiteデータベースインスタンス
 */
export function createTestDatabase(): Database {
  const db = new Database(":memory:");
  initializeDatabase(db);
  return db;
}

/**
 * データベース接続を閉じる
 * @responsibility シングルトンのDB接続を安全に閉じる
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.error("[gacha-task-mcp] データベース接続を閉じました");
  }
}
