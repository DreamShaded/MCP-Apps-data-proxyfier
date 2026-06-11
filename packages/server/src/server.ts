import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadUiHtml, registerPingUiResource } from "./ui-resource.js";
import { registerPingTool } from "./ping-tool.js";

/**
 * Собрать MCP-сервер с подключёнными инструментами и UI-ресурсами.
 * Не зависит от транспорта: здесь неизвестно, пойдёт ли обмен по stdio или HTTP.
 */
export function createServer(html: string = loadUiHtml()): McpServer {
  const server = new McpServer({
    name: "mcp-app-proxyfier",
    version: "1.0.0",
  });

  registerPingUiResource(server, html);
  registerPingTool(server);

  return server;
}
