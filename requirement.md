# ガチャタスク MCP サーバー — 要件定義書

> **目的:** 日常タスクの完了をトリガーに、ランダム報酬（LP増減・追加タスク・休憩）を付与し、シーズンごとのランク昇降格を行う自己管理システムを、MCPサーバーとして実装する。
> AIエージェント（Claude等）からツール呼び出しで全操作を行う。

---

## 1. プロジェクト概要

### 1-1. コンセプト

LoL（League of Legends）のランクマッチシステムを模倣し、タスク完了を「試合」に見立てたゲーミフィケーション型タスク管理。タスクを完了するたびにガチャが回り、勝敗に応じてLP（リーグポイント）が変動し、ランクが昇降する。

### 1-2. 動作形態

- **MCPサーバー**としてローカルで動作する。
- AIエージェント（Claude Desktop、Cursor、Gemini CLI等）がクライアントとなり、stdioトランスポート経由でツールを呼び出す。
- UIは持たない。全ての操作と表示はAIのチャットインターフェースを通じて行う。

### 1-3. データ永続化

- **`bun:sqlite`** を使用し、単一のSQLiteファイルにローカル保存する。
- データファイルパス: `~/.gacha-task/gacha.db`

---

## 2. 技術スタック

| カテゴリ | 技術 | バージョン | 備考 |
|:--|:--|:--|:--|
| ランタイム | **Bun** | 最新安定版 | Node.js は使用しない |
| MCP SDK | **@modelcontextprotocol/sdk** | ^1.29.0 | 公式TypeScript SDK |
| スキーマバリデーション | **zod** | ^3.x | MCP SDKの必須ピアデペンデンシー |
| データベース | **bun:sqlite** | Bun内蔵 | 外部依存なし |
| テスト | **bun test** | Bun内蔵 | ユニットテスト・ロジックテスト |
| パッケージマネージャー | **bun** | — | CLI操作は全て `bun` / `bunx` |
| コード品質 | **ESLint** + **Prettier** | — | `any`禁止、import順序 |
| Gitフック | **Husky** | — | pre-commit, commit-msg |
| コミット規約 | **Conventional Commits** | — | `feat:`, `fix:`, `chore:` 等 |

### 2-1. `package.json` の必須設定

```json
{
  "name": "gacha-task-mcp",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "gacha-task-mcp": "./dist/index.js"
  },
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "test": "bun test",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

### 2-2. `tsconfig.json` の必須設定

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"]
  }
}
```

---

## 3. MCPサーバーの実装

### 3-1. エントリーポイント (`src/index.ts`)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "gacha-task-mcp",
  version: "1.0.0",
});

// ここで各ツール・リソースを登録する（後述）

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 3-2. 重要な制約

- **`stdout` にはMCPメッセージ以外を出力してはならない。** ログは全て `console.error`（stderr）を使う。
- サーバーはクラッシュしてはならない。全ての例外をキャッチし、MCPのエラーレスポンスとして返す。
- データベースファイルが存在しない場合は、初回起動時に自動作成・初期化する。

---

## 4. MCPツール定義（全6種）

AIエージェントが呼び出す操作。全てのツールは副作用を持つ（データの読み書き）。

---

### Tool 1: `add_task`

**概要:** 新しいタスクを追加する。

| 項目 | 内容 |
|:--|:--|
| 説明 | 新しいタスクをリストに追加する |
| パラメータ | `name: string`（タスク名、必須）、`difficulty: "low" \| "medium" \| "high"`（難易度、必須） |
| 戻り値 | 追加されたタスクのID、名前、難易度、作成日時 |

**難易度によるLP変動倍率:**

| 難易度 | LP増減倍率 |
|:--|:--|
| `low` | ×1.0 |
| `medium` | ×1.5 |
| `high` | ×2.0 |

**レスポンス例:**
```
✅ タスクを追加しました
ID: 42
タスク: 「バナナと鶏胸肉の買い出しに行く」
難易度: 低 (×1.0)
```

---

### Tool 2: `complete_task`

**概要:** タスクを完了し、ガチャ判定を実行する。**このツールがシステムの中核。**

| 項目 | 内容 |
|:--|:--|
| 説明 | 指定したタスクを完了し、ガチャ（リザルト判定）を実行する |
| パラメータ | `task_id: number`（タスクID、必須） |
| 戻り値 | ガチャ結果、LP変動、ランク変動、昇格/降格の有無 |

**ガチャ判定ロジック（確率テーブル）:**

| 判定結果 | 確率 | LP変動（基本値） | 追加効果 |
|:--|:--|:--|:--|
| **Victory（勝利）** | 60% | **+15 LP** | 休憩時間（5〜15分のランダム）を付与 |
| **Defeat（敗北）** | 30% | **-10 LP** | 外れタスクを1件自動生成（後述） |
| **Critical Win（大勝利）** | 10% | **+30 LP** | ガチャ券を1枚付与 |

> **LP変動の最終値 = 基本値 × 難易度倍率**
>
> 例: 難易度 `high` のタスクで Victory → +15 × 2.0 = **+30 LP**

**ガチャ券ボーナス（天井システム）:**
- 完了タスク数が **5の倍数** に到達するたびに、ガチャ結果に関わらずガチャ券を **1枚追加付与** する。
- この判定は `user_state.tasks_completed_total` をインクリメントした後に行う。

**外れタスク（Defeat時の自動生成）:**

以下のプリセットからランダムに1件を選び、`tasks` テーブルに自動追加する。外れタスクの難易度は常に `low`。

```typescript
const PENALTY_TASKS = [
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
```

**レスポンス例（Victory）:**
```
🏆 Victory!

タスク: 「コーヒーを淹れて25分間の集中作業」(難易度: 中)
LP変動: +23 LP  (15 × 1.5)
現在のLP: 68 / 100
ランク: Silver II

🎁 ボーナス: 5分の休憩時間を獲得！

📊 本日の戦績: 5戦 4勝 1敗 (勝率 80%)
```

**レスポンス例（Defeat）:**
```
💀 Defeat...

タスク: 「ビオフェルミンの在庫補充と記録」(難易度: 低)
LP変動: -10 LP  (10 × 1.0)
現在のLP: 35 / 100
ランク: Silver III

⚡ 追加タスク発生: 「スクワット10回」
→ 完了してリベンジだ！

📊 本日の戦績: 3戦 1勝 2敗 (勝率 33%)
```

**レスポンス例（Critical Win）:**
```
⚡⚡⚡ CRITICAL WIN! ⚡⚡⚡

タスク: 「『たった一人の熱狂』を1章読み進める」(難易度: 高)
LP変動: +60 LP  (30 × 2.0)
現在のLP: 95 / 100  ← あと5LPで昇格！
ランク: Gold IV

🎫 ガチャ券を獲得！ (所持数: 3枚)

📊 本日の戦績: 7戦 5勝 2敗 (勝率 71%)
```

---

### Tool 3: `use_gacha_ticket`

**概要:** ガチャ券を使い、Defeatが存在しない安全なガチャを回す。

| 項目 | 内容 |
|:--|:--|
| 説明 | ガチャ券を1枚消費し、安全ガチャを回す |
| パラメータ | なし |
| 前提条件 | ガチャ券を1枚以上所持していること |
| 戻り値 | ガチャ結果、LP変動、残りガチャ券数 |

**安全ガチャの確率テーブル:**

| 判定結果 | 確率 | 効果 |
|:--|:--|:--|
| **LP小ブースト** | 50% | +10 LP |
| **LP大ブースト** | 20% | +25 LP |
| **休憩券（5分）** | 20% | 休憩券を1枚獲得 |
| **休憩券（15分）** | 10% | 休憩券を1枚獲得（15分） |

**レスポンス例:**
```
🎰 安全ガチャ結果

🎉 LP大ブースト! +25 LP
現在のLP: 80 / 100
ランク: Gold III

🎫 残りガチャ券: 2枚
```

---

### Tool 4: `use_rest_ticket`

**概要:** 休憩券を使う。

| 項目 | 内容 |
|:--|:--|
| 説明 | 休憩券を1枚消費する |
| パラメータ | なし |
| 前提条件 | 休憩券を1枚以上所持していること |
| 戻り値 | 使用した休憩券の分数、残り休憩券リスト |

**休憩券の合成ルール:**
- 5分券 × 3枚 → 使用時に「20分の自由時間」として計算表示できる（合成はAIへの情報提示のみ、実際のストック管理は個別枚数で行う）

**レスポンス例:**
```
☕ 休憩券を使用しました

休憩時間: 5分
残り休憩券: 5分×2枚, 15分×1枚
💡 ヒント: 5分券があと1枚で20分の自由時間に合成できます！
```

---

### Tool 5: `get_status`

**概要:** 現在の全ステータスを取得する。

| 項目 | 内容 |
|:--|:--|
| 説明 | 現在のLP、ランク、勝率、タスク一覧、券の所持数、シーズン情報を一括取得する |
| パラメータ | なし |
| 戻り値 | 下記の全情報 |

**レスポンス例:**
```
📊 ステータス

👤 ランク: Gold III
⭐ LP: 68 / 100
🛡️ 降格保護: なし

📋 未完了タスク (3件):
  1. [ID:42] バナナと鶏胸肉の買い出しに行く (低)
  2. [ID:43] コーヒーを淹れて25分間の集中作業 (中)
  3. [ID:45] スクワット10回 (低) ⚡外れタスク

🎫 ガチャ券: 2枚
☕ 休憩券: 5分×2枚, 15分×1枚
📈 次のガチャ券まで: あと2タスク

📅 シーズン: 2026-Q2 (残り47日)
🏆 シーズン戦績: 45戦 28勝 17敗 (勝率 62%)
```

---

### Tool 6: `get_history`

**概要:** 直近の勝敗履歴を取得する。

| 項目 | 内容 |
|:--|:--|
| 説明 | 直近N件の勝敗履歴を表示する |
| パラメータ | `limit: number`（取得件数、任意、デフォルト20、最大50） |
| 戻り値 | 履歴一覧と統計情報 |

**レスポンス例:**
```
📜 直近20件の戦績

 # | 結果          | タスク                           | LP変動 | 日時
---|---------------|----------------------------------|--------|-------------
 1 | 🏆 Victory    | コーヒーを淹れて25分間の集中作業   | +23    | 04/07 09:15
 2 | 💀 Defeat     | ビオフェルミンの在庫補充と記録     | -10    | 04/07 08:50
 3 | ⚡ Critical   | 『たった一人の熱狂』を1章読む     | +60    | 04/06 22:30
 ...

📊 統計:
  直近20戦: 13勝 7敗 (勝率 65%)
  今日: 5戦 4勝 1敗 (勝率 80%)
  連勝中: 3連勝 🔥
```

---

## 5. MCPリソース定義（全4種）

AIエージェントがコンテキストとして参照できる読み取り専用データ。

| リソース名 | URI | 説明 |
|:--|:--|:--|
| `active_tasks` | `gacha://tasks/active` | 未完了タスクの一覧 |
| `rank_info` | `gacha://rank/current` | 現在のランク・LP情報 |
| `season_stats` | `gacha://season/current` | 現在シーズンの統計情報 |
| `recent_history` | `gacha://history/recent` | 直近10件の勝敗履歴 |

---

## 6. データベース設計（SQLite）

### 6-1. `user_state` テーブル（1レコード固定）

ユーザーの現在状態を保持する。常にID=1の1レコードのみ。

```sql
CREATE TABLE user_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),

  -- ランク情報
  rank_tier TEXT NOT NULL DEFAULT 'Iron',       -- Iron/Bronze/Silver/Gold/Platinum/Emerald/Diamond/Master/Grandmaster/Challenger
  rank_division INTEGER NOT NULL DEFAULT 4,     -- 4〜1（4が最低、1が最高）。Master以上は division = 0
  current_lp INTEGER NOT NULL DEFAULT 0,        -- 0〜100
  demotion_shield INTEGER NOT NULL DEFAULT 0,   -- 降格保護の残りタスク数（0=保護なし）

  -- 所持アイテム
  gacha_tickets INTEGER NOT NULL DEFAULT 0,     -- ガチャ券の枚数
  rest_tickets_5 INTEGER NOT NULL DEFAULT 0,    -- 5分休憩券の枚数
  rest_tickets_15 INTEGER NOT NULL DEFAULT 0,   -- 15分休憩券の枚数

  -- 統計カウンター
  tasks_completed_total INTEGER NOT NULL DEFAULT 0,  -- 通算完了タスク数（ガチャ券の天井計算に使用）

  -- シーズン情報
  current_season_id TEXT NOT NULL DEFAULT '',    -- "2026-Q2" 形式

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 6-2. `tasks` テーブル

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                                  -- タスク名
  difficulty TEXT NOT NULL CHECK (difficulty IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  is_penalty INTEGER NOT NULL DEFAULT 0,               -- 外れタスク（Defeatで自動生成）なら1
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT                                     -- 完了日時（NULLなら未完了）
);
```

### 6-3. `match_history` テーブル

```sql
CREATE TABLE match_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,                             -- 完了したタスクのID
  task_name TEXT NOT NULL,                              -- タスク名（非正規化、履歴表示用）
  difficulty TEXT NOT NULL,                              -- タスクの難易度
  result TEXT NOT NULL CHECK (result IN ('victory', 'defeat', 'critical_win')),
  lp_change INTEGER NOT NULL,                           -- LP変動値（+/-）
  lp_after INTEGER NOT NULL,                            -- 変動後のLP
  rank_tier_after TEXT NOT NULL,                         -- 変動後のランク帯
  rank_division_after INTEGER NOT NULL,                  -- 変動後のディビジョン
  promotion INTEGER NOT NULL DEFAULT 0,                  -- 昇格が発生したら1
  demotion INTEGER NOT NULL DEFAULT 0,                   -- 降格が発生したら1
  bonus_ticket INTEGER NOT NULL DEFAULT 0,               -- ガチャ券ボーナスが発生したら1
  penalty_task_name TEXT,                                -- Defeat時の外れタスク名（NULLなら該当なし）
  rest_minutes INTEGER,                                  -- Victory時の休憩時間（NULLなら該当なし）
  season_id TEXT NOT NULL,                               -- 所属シーズンID
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 6-4. `seasons` テーブル

```sql
CREATE TABLE seasons (
  id TEXT PRIMARY KEY,                                   -- "2026-Q2" 形式
  start_date TEXT NOT NULL,                              -- シーズン開始日
  end_date TEXT NOT NULL,                                -- シーズン終了日
  final_rank_tier TEXT,                                  -- シーズン終了時の最終ランク（NULLなら進行中）
  final_rank_division INTEGER,
  final_lp INTEGER,
  total_matches INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_defeats INTEGER NOT NULL DEFAULT 0,
  total_critical_wins INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1                   -- 現在のシーズンなら1
);
```

### 6-5. 初期化SQL

データベースファイルが存在しない場合、初回起動時に以下を実行する:

1. 上記4テーブルを全て `CREATE TABLE IF NOT EXISTS` で作成
2. `user_state` に `id=1` の初期レコードを挿入
3. 現在の日付から `current_season_id` を算出し、`seasons` テーブルに初期シーズンを挿入

**シーズンIDの算出ロジック:**
```typescript
/**
 * @responsibility 現在日時からシーズンIDを算出する
 * @return "YYYY-QN" 形式のシーズンID文字列
 */
function getCurrentSeasonId(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${quarter}`;
}
```

---

## 7. ビジネスロジック詳細

### 7-1. ランクティアとディビジョン

**ティア一覧（低→高）:**

| # | ティア | ディビジョン | 備考 |
|:--|:--|:--|:--|
| 1 | Iron | IV〜I | 初期ランク |
| 2 | Bronze | IV〜I | |
| 3 | Silver | IV〜I | |
| 4 | Gold | IV〜I | |
| 5 | Platinum | IV〜I | |
| 6 | Emerald | IV〜I | |
| 7 | Diamond | IV〜I | |
| 8 | Master | なし (0) | LP上限なし |
| 9 | Grandmaster | なし (0) | LP上限なし |
| 10 | Challenger | なし (0) | LP上限なし |

### 7-2. 昇格ロジック

```
LP が 100 以上に到達した場合:
  1. 現在のディビジョンが I（最高）の場合:
     → 次のティアの IV に昇格（例: Silver I → Gold IV）
     → LP = 超過分（例: LP 115 → 昇格後 LP 15）
  2. 現在のディビジョンが II〜IV の場合:
     → ディビジョンを1つ上げる（例: Gold III → Gold II）
     → LP = 超過分
  3. 昇格発生時:
     → demotion_shield = 1 を設定（降格保護1タスク分）
  4. Master以上の場合:
     → ディビジョンなし、LPは100を超えて無制限に累積する
```

### 7-3. 降格ロジック

```
LP が 0 未満に到達した場合:
  1. demotion_shield > 0 の場合:
     → LP = 0 に補正、降格しない
     → demotion_shield を 1 減算
  2. demotion_shield = 0 の場合:
     a. 現在のディビジョンが IV（最低）の場合:
        → 1つ下のティアの I に降格（例: Gold IV → Silver I）
        → LP = 75（降格直後はLPを75に設定、即死を防ぐ）
     b. 現在のディビジョンが I〜III の場合:
        → ディビジョンを1つ下げる（例: Gold II → Gold III）
        → LP = 75
     c. Iron IV で LP が 0 未満の場合:
        → LP = 0 に補正（最低ランクから降格しない）
```

### 7-4. シーズンリセット

**トリガー:** シーズン終了日を過ぎた状態で任意のツールが呼ばれた時。

**処理手順:**
1. 現在の `seasons` レコードの `is_active` を 0 に変更し、最終成績を記録
2. 新しいシーズンIDを算出して `seasons` に挿入
3. ユーザーのランクを**ソフトリセット**する:
   - リセット後のランク = `max(現在ランクの2ティア下, Iron IV)`
   - LP = 50（中間値でスタート）
4. `user_state.current_season_id` を更新

**ソフトリセットの例:**

| シーズン終了時ランク | リセット後ランク |
|:--|:--|
| Challenger | Diamond IV |
| Diamond I | Platinum IV |
| Gold III | Silver III |
| Silver II | Bronze II |
| Bronze I | Iron I |
| Iron III | Iron IV |

### 7-5. ガチャ券の天井システム

```
タスク完了時（complete_task 実行時）:
  1. user_state.tasks_completed_total をインクリメント
  2. tasks_completed_total % 5 === 0 の場合:
     → ガチャ券を1枚追加付与
     → レスポンスにボーナス情報を含める
  3. これはガチャ判定の結果（Victory/Defeat/Critical Win）とは「独立」して判定する
     → つまり Defeat でも5タスク目なら券がもらえる
```

---

## 8. ディレクトリ構成

```text
gacha-task-mcp/
├── src/
│   ├── index.ts                  # エントリーポイント: MCPサーバー起動・ツール/リソース登録
│   ├── db/
│   │   ├── connection.ts         # SQLiteコネクション管理・初期化
│   │   ├── schema.sql            # テーブル作成SQL（文字列定数 or 外部ファイル）
│   │   └── queries.ts            # 全クエリ関数（読み書き）
│   ├── tools/
│   │   ├── add-task.ts           # add_task ツール
│   │   ├── complete-task.ts      # complete_task ツール
│   │   ├── use-gacha-ticket.ts   # use_gacha_ticket ツール
│   │   ├── use-rest-ticket.ts    # use_rest_ticket ツール
│   │   ├── get-status.ts         # get_status ツール
│   │   └── get-history.ts        # get_history ツール
│   ├── resources/
│   │   ├── active-tasks.ts       # active_tasks リソース
│   │   ├── rank-info.ts          # rank_info リソース
│   │   ├── season-stats.ts       # season_stats リソース
│   │   └── recent-history.ts     # recent_history リソース
│   ├── domain/
│   │   ├── gacha.ts              # ガチャ判定ロジック（確率計算、重み付き抽選）
│   │   ├── rank.ts               # ランク昇降格ロジック
│   │   ├── season.ts             # シーズン管理ロジック
│   │   └── constants.ts          # 全定数（確率、LP値、ティア順序、外れタスクリスト）
│   └── types/
│       └── index.ts              # 全型定義
├── tests/
│   ├── domain/
│   │   ├── gacha.test.ts         # ガチャロジックのテスト
│   │   ├── rank.test.ts          # ランク昇降格のテスト
│   │   └── season.test.ts        # シーズンリセットのテスト
│   ├── tools/
│   │   ├── complete-task.test.ts # complete_taskの統合テスト
│   │   └── ...
│   └── db/
│       └── queries.test.ts       # クエリのテスト（インメモリDB使用）
├── .husky/
│   ├── pre-commit                # lint実行
│   └── commit-msg                # commitlint実行
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── commitlint.config.js
└── README.md
```

---

## 9. テスト戦略

### 9-1. ドメインロジックのテスト（純粋関数）

`src/domain/` 内の関数はDBに依存しない純粋関数として設計し、`bun test` で直接テストする。

**テストすべきケース（最低限）:**

| 対象 | テストケース |
|:--|:--|
| ガチャ判定 | Victory / Defeat / Critical Win それぞれが正しいLP変動を返す |
| ガチャ判定 | 難易度倍率が正しく適用される |
| ランク昇格 | LP 100到達時にディビジョンが上がる |
| ランク昇格 | ディビジョンI → 次ティアIV への昇格 |
| ランク降格 | LP 0未満で降格し、LP 75に設定される |
| ランク降格 | 降格保護が機能する |
| ランク降格 | Iron IV では LP 0 で止まる |
| 天井システム | 5タスクごとにガチャ券が付与される |
| シーズンリセット | ソフトリセットが正しいランクを返す |

### 9-2. クエリのテスト（インメモリDB）

`bun:sqlite` はインメモリモードをサポートしている（`new Database(":memory:")`) 。テスト用にインメモリDBを使い、実際のファイルに影響を与えずにクエリをテストする。

### 9-3. カバレッジ目標

- `src/domain/`: **100%**
- `src/db/queries.ts`: **100%**
- `src/tools/`: **主要パスのテスト（昇格・降格の境界値）**

---

## 10. MCP クライアント設定例

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "gacha-task": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/gacha-task-mcp/src/index.ts"]
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "gacha-task": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/gacha-task-mcp/src/index.ts"]
    }
  }
}
```

---

## 11. 開発フェーズ

### Phase 1: 基盤構築
1. `bun init` でプロジェクト作成
2. `@modelcontextprotocol/sdk` と `zod` をインストール
3. `bun:sqlite` でDB接続・初期化コードを実装
4. テーブル作成SQLを実行し、初期レコードを挿入

### Phase 2: ドメインロジック
1. `src/domain/constants.ts` に全定数を定義
2. `src/domain/gacha.ts` にガチャ判定を実装 + テスト
3. `src/domain/rank.ts` にランク昇降格を実装 + テスト
4. `src/domain/season.ts` にシーズン管理を実装 + テスト

### Phase 3: DB層
1. `src/db/queries.ts` に全クエリ関数を実装
2. インメモリDBでテスト

### Phase 4: MCPツール・リソース
1. 各ツールを `src/tools/` に実装
2. 各リソースを `src/resources/` に実装
3. `src/index.ts` で全て登録

### Phase 5: 品質管理
1. ESLint + Prettier 設定
2. Husky + commitlint 設定
3. 全テスト通過を確認

---

## 12. 厳格な開発制約

1. **`any` 型の完全禁止。** `tsconfig.json` の `strict: true` + `noImplicitAny: true` + ESLint `@typescript-eslint/no-explicit-any: error`
2. **全てのコメントは日本語で記述する。** コミットメッセージのみ英語。
3. **JSDoc形式のドキュメンテーション必須。** `@responsibility`, `@param`, `@return` を記載。
4. **ロジックのひとまとまりごとに通常コメントを1行以上記載する。**
5. **`stdout` にログを出力しない。** MCPプロトコル違反となる。ログは `console.error` を使う。
6. **CLI操作は `bun` / `bunx` のみ。** `npm`, `npx`, `node` は使用しない。
