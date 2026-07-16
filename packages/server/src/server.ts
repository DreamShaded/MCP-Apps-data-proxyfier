import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadUiHtml, registerPingUiResource } from "./ui-resource.js";
import { registerPingTool } from "./ping-tool.js";
import { registerMegamarketUiResource } from "./megamarket/megamarket-ui-resource.js";
import { registerSearchProductsTools } from "./megamarket/search-products-tool.js";
import { SHOPPING_ADVISOR_SKILL } from "./megamarket/shopping-advisor-skill.js";
import { registerGetProductTool } from "./megamarket/get-product-tool.js";
import { registerDeliveryCalendarTool } from "./megamarket/delivery-calendar-tool.js";
import { registerAddToCartTool } from "./megamarket/add-to-cart-tool.js";
import { registerViewCartTool } from "./megamarket/view-cart-tool.js";
import { registerCheckoutTool } from "./megamarket/checkout-tool.js";
import { registerSkills } from "./skills/skill-registry.js";

/** Зависимости сервера. Все опциональны — в тестах подставляются фейковые HTML-заглушки. */
export interface ServerDeps {
  /** HTML каркасного `ping`-приложения. */
  pingHtml?: string;
  /** HTML приложения Megamarket (мини-SPA выдачи). */
  megamarketHtml?: string;
}

/**
 * Собрать MCP-сервер с подключёнными инструментами и UI-ресурсами. Не зависит от
 * транспорта: здесь неизвестно, пойдёт ли обмен по stdio или HTTP. Данные — статический
 * каталог (`data-source/`), запускается мгновенно без браузера/сети.
 */
export function createServer(deps: ServerDeps = {}): McpServer {
  const pingHtml = deps.pingHtml ?? loadUiHtml("index");
  const megamarketHtml = deps.megamarketHtml ?? loadUiHtml("megamarket");

  const server = new McpServer({ name: "mcp-app-proxyfier", version: "1.0.0" });

  registerPingUiResource(server, pingHtml);
  registerPingTool(server);

  registerMegamarketUiResource(server, megamarketHtml);
  // Три ступени демо: без UI / с UI / с UI + методичка. Выбор — формулировкой запроса.
  registerSearchProductsTools(server);
  registerGetProductTool(server);
  // Без часов у модели «до пятницы» не превратить в дату — календарь идёт до поиска.
  registerDeliveryCalendarTool(server);
  registerAddToCartTool(server);
  registerViewCartTool(server);
  registerCheckoutTool(server);

  // Скилл-методичка для агента (`skill://`) + индекс. Читается до вызова
  // search_products_advised; это не MCP App — рендерить нечего.
  registerSkills(server, [SHOPPING_ADVISOR_SKILL]);

  return server;
}
