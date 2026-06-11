import { createServer } from "./server.js";
import { loadUiHtml } from "./ui-resource.js";
import { createBrowserSession } from "./browser/create-session.js";
import { createCache } from "./cache/create-cache.js";
import { StdioTransportProvider } from "./transport/stdio-transport-provider.js";
import type { ServerTransportProvider } from "./transport/transport-provider.js";

/**
 * Точка входа: собрать сервер, выбрать провайдер транспорта, подключиться.
 * Замена `StdioTransportProvider` на HTTP — единственное нужное изменение для
 * нового транспорта; код инструментов и ресурсов при этом не меняется.
 *
 * Драйвер браузера принадлежит точке входа, чтобы закрыть его на завершении:
 * иначе при обрыве клиента headed-Chromium осиротеет и продолжит держать локу
 * на профиле, блокируя следующий запуск сервера/бутстрапа.
 */
async function main(provider: ServerTransportProvider = new StdioTransportProvider()): Promise<void> {
  const { driver, sessionChecker } = createBrowserSession();
  const { reader } = createCache();
  const server = createServer({
    pingHtml: loadUiHtml("index"),
    megamarketHtml: loadUiHtml("megamarket"),
    sessionChecker,
    driver,
    reader,
  });

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await driver.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const transport = await provider.create();
  await server.connect(transport);
  // stdout — это канал MCP; диагностику пишем только в stderr.
  console.error(`[mcp-app-proxyfier] connected over ${provider.name}`);
}

main().catch((error) => {
  console.error("[mcp-app-proxyfier] fatal:", error);
  process.exit(1);
});
