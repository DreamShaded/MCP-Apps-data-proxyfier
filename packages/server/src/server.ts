import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadUiHtml, registerPingUiResource } from "./ui-resource.js";
import { registerPingTool } from "./ping-tool.js";
import { registerCheckSessionTool } from "./check-session-tool.js";
import { registerMegamarketUiResource } from "./megamarket/megamarket-ui-resource.js";
import { registerSearchProductsTool } from "./megamarket/search-products-tool.js";
import { registerGetProductTool } from "./megamarket/get-product-tool.js";
import { registerAddToCartTool } from "./megamarket/add-to-cart-tool.js";
import { registerViewCartTool } from "./megamarket/view-cart-tool.js";
import { createBrowserSession } from "./browser/create-session.js";
import { createCache } from "./cache/create-cache.js";
import type { BrowserDriver } from "./browser/browser-driver.js";
import type { SessionChecker } from "./browser/session-checker.js";
import type { CachedReader } from "./cache/cached-reader.js";

/**
 * Зависимости сервера. Все опциональны: в боевом запуске собираются ленивые
 * боевые слои (браузер/кэш), в тестах подставляются фейки/фикстуры — Chromium и
 * диск при этом не трогаются.
 */
export interface ServerDeps {
  /** HTML каркасного `ping`-приложения. */
  pingHtml?: string;
  /** HTML приложения Megamarket (мини-SPA выдачи). */
  megamarketHtml?: string;
  sessionChecker?: SessionChecker;
  /** Шов браузера, общий для всех инструментов (одна сериализованная сессия). */
  driver?: BrowserDriver;
  /** Шов кэша чтений (хит/мисс/фолбэк под таймаутом). */
  reader?: CachedReader;
}

/**
 * Собрать MCP-сервер с подключёнными инструментами и UI-ресурсами.
 * Не зависит от транспорта: здесь неизвестно, пойдёт ли обмен по stdio или HTTP.
 * Боевые слои (браузер/кэш) ленивые — Chromium и диск не задействуются, пока
 * инструмент реально не пойдёт в браузер.
 */
export function createServer(deps: ServerDeps = {}): McpServer {
  const browser = deps.driver && deps.sessionChecker ? null : createBrowserSession();
  const driver = deps.driver ?? browser!.driver;
  const sessionChecker = deps.sessionChecker ?? browser!.sessionChecker;
  const reader = deps.reader ?? createCache().reader;
  const pingHtml = deps.pingHtml ?? loadUiHtml("index");
  const megamarketHtml = deps.megamarketHtml ?? loadUiHtml("megamarket");

  const server = new McpServer({ name: "mcp-app-proxyfier", version: "1.0.0" });

  registerPingUiResource(server, pingHtml);
  registerPingTool(server);
  registerCheckSessionTool(server, sessionChecker);

  registerMegamarketUiResource(server, megamarketHtml);
  registerSearchProductsTool(server, { driver, reader });
  registerGetProductTool(server, { driver, reader });
  // Корзина = реальный сайт: запись/чтение изменчивого состояния идут мимо кэш-слоя,
  // только через шов браузера (сериализованы его мьютексом).
  registerAddToCartTool(server, { driver });
  registerViewCartTool(server, { driver });

  return server;
}
