import { createServer } from "./server.js";
import { loadUiHtml } from "./ui-resource.js";
import { selectTransportProvider } from "./transport/select-transport-provider.js";
import type { ServerTransportProvider } from "./transport/transport-provider.js";

/**
 * Точка входа: собрать сервер, выбрать провайдер транспорта (флаг/env), подключиться.
 * Транспорт выбирается за швом `ServerTransportProvider` — код инструментов и
 * ресурсов одинаков для stdio (фаза 1) и Streamable HTTP (фаза 2). Данные статические —
 * сервер стартует мгновенно, без браузера/сети.
 */
async function main(provider: ServerTransportProvider = selectTransportProvider()): Promise<void> {
  const server = createServer({
    pingHtml: loadUiHtml("index"),
    megamarketHtml: loadUiHtml("megamarket"),
    depositsHtml: loadUiHtml("deposits"),
  });

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await provider.close?.().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const transport = await provider.create();
  await server.connect(transport);
  // stdout — это канал MCP (важно для stdio); диагностику пишем только в stderr.
  console.error(`[mcp-app-proxyfier] connected over ${provider.name}`);
  if (provider.url) console.error(`[mcp-app-proxyfier] listening on ${provider.url}`);
}

main().catch((error) => {
  console.error("[mcp-app-proxyfier] fatal:", error);
  process.exit(1);
});
