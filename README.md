# ガチャタスク MCP サーバー

LoL（League of Legends）のランクマッチシステムを模倣した、ゲーミフィケーション型タスク管理 MCP サーバー。

タスクを完了するたびにガチャが回り、勝敗に応じて LP（リーグポイント）が変動し、ランクが昇降する。

## セットアップ

```bash
# 依存関係のインストール
bun install

# 開発サーバー起動
bun run dev

# テスト実行
bun test

# リント
bun run lint

# フォーマット
bun run format

# ビルド
bun run build
```

## MCP クライアント設定

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

## ツール一覧

| ツール名 | 説明 |
|:--|:--|
| `add_task` | 新しいタスクをリストに追加する |
| `complete_task` | タスクを完了し、ガチャ判定を実行する |
| `use_gacha_ticket` | ガチャ券を消費し、安全ガチャを回す |
| `use_rest_ticket` | 休憩券を1枚消費する |
| `get_status` | 現在の全ステータスを一括取得する |
| `get_history` | 直近の勝敗履歴を取得する |

## リソース一覧

| リソース名 | URI | 説明 |
|:--|:--|:--|
| `active_tasks` | `gacha://tasks/active` | 未完了タスクの一覧 |
| `rank_info` | `gacha://rank/current` | 現在のランク・LP情報 |
| `season_stats` | `gacha://season/current` | 現在シーズンの統計情報 |
| `recent_history` | `gacha://history/recent` | 直近10件の勝敗履歴 |

## ランクシステム

Iron → Bronze → Silver → Gold → Platinum → Emerald → Diamond → Master → Grandmaster → Challenger

各ティア（Master未満）には IV〜I のディビジョンがあり、LP 100 到達で昇格。
