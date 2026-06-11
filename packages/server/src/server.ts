import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadUiHtml, registerPingUiResource } from "./ui-resource.js";
import { registerPingTool } from "./ping-tool.js";
import { registerCheckSessionTool } from "./check-session-tool.js";
import { createBrowserSession } from "./browser/create-session.js";
import type { SessionChecker } from "./browser/session-checker.js";

/**
 * Собрать MCP-сервер с подключёнными инструментами и UI-ресурсами.
 * Не зависит от транспорта: здесь неизвестно, пойдёт ли обмен по stdio или HTTP.
 * `sessionChecker` инъектируется в тестах фейком; по умолчанию — ленивый
 * боевой драйвер браузера (Chromium не стартует до первого `check_session`).
 */
export function createServer(
  html: string = loadUiHtml(),
  sessionChecker: SessionChecker = createBrowserSession().sessionChecker,
): McpServer {
  const server = new McpServer({
    name: "mcp-app-proxyfier",
    version: "1.0.0",
  });

  registerPingUiResource(server, html);
  registerPingTool(server);
  registerCheckSessionTool(server, sessionChecker);

  return server;
}
