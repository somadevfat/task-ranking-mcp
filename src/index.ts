/**
 * ガチャタスクMCPサーバー エントリーポイント
 * @responsibility MCPサーバーの起動、全ツール・リソースの登録、stdioトランスポートの接続を行う
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/* ツール登録関数のインポート */
import { registerAddTask } from "./tools/add-task.ts";
import { registerCompleteTask } from "./tools/complete-task.ts";
import { registerUseGachaTicket } from "./tools/use-gacha-ticket.ts";
import { registerUseRestTicket } from "./tools/use-rest-ticket.ts";
import { registerGetStatus } from "./tools/get-status.ts";
import { registerGetHistory } from "./tools/get-history.ts";

/* リソース登録関数のインポート */
import { registerActiveTasksResource } from "./resources/active-tasks.ts";
import { registerRankInfoResource } from "./resources/rank-info.ts";
import { registerSeasonStatsResource } from "./resources/season-stats.ts";
import { registerRecentHistoryResource } from "./resources/recent-history.ts";

/* MCPサーバーインスタンスを作成 */
const server = new McpServer({
  name: "gacha-task-mcp",
  version: "1.0.0",
});

/* ===== ツール登録（全6種） ===== */
registerAddTask(server);
registerCompleteTask(server);
registerUseGachaTicket(server);
registerUseRestTicket(server);
registerGetStatus(server);
registerGetHistory(server);

/* ===== リソース登録（全4種） ===== */
registerActiveTasksResource(server);
registerRankInfoResource(server);
registerSeasonStatsResource(server);
registerRecentHistoryResource(server);

/* stdioトランスポートで接続開始 */
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("[gacha-task-mcp] MCPサーバーを起動しました");
