import { createServer } from "./server.js";
import { StdioTransportProvider } from "./transport/stdio-transport-provider.js";
import type { ServerTransportProvider } from "./transport/transport-provider.js";

/**
 * Точка входа: собрать сервер, выбрать провайдер транспорта, подключиться.
 * Замена `StdioTransportProvider` на HTTP — единственное нужное изменение для
 * нового транспорта; код инструментов и ресурсов при этом не меняется.
 */
async function main(provider: ServerTransportProvider = new StdioTransportProvider()): Promise<void> {
  const server = createServer();
  const transport = await provider.create();
  await server.connect(transport);
  // stdout — это канал MCP; диагностику пишем только в stderr.
  console.error(`[mcp-app-proxyfier] connected over ${provider.name}`);
}

main().catch((error) => {
  console.error("[mcp-app-proxyfier] fatal:", error);
  process.exit(1);
});
