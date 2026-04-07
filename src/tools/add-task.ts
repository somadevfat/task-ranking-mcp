/**
 * add_task ツール
 * @responsibility 新しいタスクをリストに追加するMCPツール
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/connection.ts";
import { addTask } from "../db/queries.ts";
import { DIFFICULTY_LABEL, DIFFICULTY_MULTIPLIER } from "../domain/constants.ts";
import { checkAndTransitionSeason } from "./season-check.ts";

/**
 * add_taskツールをMCPサーバーに登録する
 * @responsibility タスク追加ツールの定義・ハンドラーを登録する
 * @param server MCPサーバーインスタンス
 */
export function registerAddTask(server: McpServer): void {
  server.tool(
    "add_task",
    "新しいタスクをリストに追加する",
    {
      name: z.string().describe("タスク名"),
      difficulty: z.enum(["low", "medium", "high"]).describe("難易度（low/medium/high）"),
    },
    async ({ name, difficulty }) => {
      try {
        const db = getDatabase();

        /* シーズン遷移チェック */
        const seasonMsg = checkAndTransitionSeason(db);

        /* タスクをDBに追加 */
        const task = addTask(db, name, difficulty);

        /* レスポンスメッセージを構築 */
        const multiplier = DIFFICULTY_MULTIPLIER[difficulty];
        const label = DIFFICULTY_LABEL[difficulty];

        let response = "";
        if (seasonMsg) {
          response += seasonMsg + "\n\n---\n\n";
        }

        response += `✅ タスクを追加しました
ID: ${task.id}
タスク: 「${task.name}」
難易度: ${label} (×${multiplier})`;

        return {
          content: [{ type: "text" as const, text: response }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `❌ エラー: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
