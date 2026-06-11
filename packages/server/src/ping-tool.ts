import { z } from "zod";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PING_UI_RESOURCE_URI } from "./ui-resource.js";

/**
 * Единственный простой инструмент каркаса. Объявляет свой UI через
 * `_meta.ui.resourceUri`: хост отрисовывает привязанное `ui://`-приложение и
 * передаёт в него `structuredContent` этого результата через мост.
 */
export function registerPingTool(server: McpServer): void {
  registerAppTool(
    server,
    "ping",
    {
      title: "Ping",
      description:
        "Health check that renders the minimal MCP App and echoes an optional message.",
      inputSchema: { echo: z.string().optional() },
      outputSchema: {
        message: z.string(),
        echo: z.string().nullable(),
        timestamp: z.string(),
      },
      _meta: { ui: { resourceUri: PING_UI_RESOURCE_URI } },
    },
    async ({ echo }) => {
      const structuredContent = {
        message: "pong",
        echo: echo ?? null,
        timestamp: new Date().toISOString(),
      };
      return {
        content: [
          { type: "text", text: `pong${echo ? ` — ${echo}` : ""}` },
        ],
        structuredContent,
      };
    },
  );
}
