import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ServerTransportProvider } from "./transport-provider.js";

/**
 * Транспорт фазы 1: сервер запускается как дочерний процесс Claude Desktop и
 * общается по MCP через stdin/stdout (прописывается в `claude_desktop_config.json`).
 */
export class StdioTransportProvider implements ServerTransportProvider {
  readonly name = "stdio";

  create(): StdioServerTransport {
    return new StdioServerTransport();
  }
}
