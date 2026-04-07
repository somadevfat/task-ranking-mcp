/**
 * active_tasks リソース
 * @responsibility 未完了タスク一覧をMCPリソースとして提供する
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/connection.ts";
import { getActiveTasks } from "../db/queries.ts";
import { DIFFICULTY_LABEL } from "../domain/constants.ts";

/**
 * active_tasksリソースをMCPサーバーに登録する
 * @responsibility 未完了タスク一覧リソースの定義・ハンドラーを登録する
 * @param server MCPサーバーインスタンス
 */
export function registerActiveTasksResource(server: McpServer): void {
  server.resource(
    "active_tasks",
    "gacha://tasks/active",
    { description: "未完了タスクの一覧" },
    async () => {
      const db = getDatabase();
      const tasks = getActiveTasks(db);

      /* タスク一覧をテキスト形式で構築 */
      let text = `📋 未完了タスク (${tasks.length}件)\n\n`;

      if (tasks.length === 0) {
        text += "タスクがありません。\n";
      } else {
        for (const task of tasks) {
          const diffLabel = DIFFICULTY_LABEL[task.difficulty];
          const penaltyMark = task.is_penalty ? " ⚡外れタスク" : "";
          text += `[ID:${task.id}] ${task.name} (${diffLabel})${penaltyMark}\n`;
        }
      }

      return {
        contents: [
          {
            uri: "gacha://tasks/active",
            mimeType: "text/plain",
            text,
          },
        ],
      };
    },
  );
}
