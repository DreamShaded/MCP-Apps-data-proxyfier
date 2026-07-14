import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadUiHtml, registerPingUiResource } from "./ui-resource.js";
import { registerPingTool } from "./ping-tool.js";
import { registerMegamarketUiResource } from "./megamarket/megamarket-ui-resource.js";
import { registerSearchProductsTool } from "./megamarket/search-products-tool.js";
import { registerGetProductTool } from "./megamarket/get-product-tool.js";
import { registerAddToCartTool } from "./megamarket/add-to-cart-tool.js";
import { registerViewCartTool } from "./megamarket/view-cart-tool.js";
import { registerCheckoutTool } from "./megamarket/checkout-tool.js";
import { registerDepositsUiResource } from "./deposits/deposits-ui-resource.js";
import { registerSearchDepositsTool } from "./deposits/search-deposits-tool.js";
import { registerDepositAdvisorSkillResources } from "./deposits/deposit-advisor-skill.js";

/** Зависимости сервера. Все опциональны — в тестах подставляются фейковые HTML-заглушки. */
export interface ServerDeps {
  /** HTML каркасного `ping`-приложения. */
  pingHtml?: string;
  /** HTML приложения Megamarket (мини-SPA выдачи). */
  megamarketHtml?: string;
  /** HTML приложения «Вклады Сбера» (отдельный MCP App). */
  depositsHtml?: string;
}

/**
 * Собрать MCP-сервер с подключёнными инструментами и UI-ресурсами. Не зависит от
 * транспорта: здесь неизвестно, пойдёт ли обмен по stdio или HTTP. Данные — статический
 * каталог/линейка вкладов (`data-source/`), запускается мгновенно без браузера/сети.
 */
export function createServer(deps: ServerDeps = {}): McpServer {
  const pingHtml = deps.pingHtml ?? loadUiHtml("index");
  const megamarketHtml = deps.megamarketHtml ?? loadUiHtml("megamarket");
  const depositsHtml = deps.depositsHtml ?? loadUiHtml("deposits");

  const server = new McpServer({ name: "mcp-app-proxyfier", version: "1.0.0" });

  registerPingUiResource(server, pingHtml);
  registerPingTool(server);

  registerMegamarketUiResource(server, megamarketHtml);
  registerSearchProductsTool(server);
  registerGetProductTool(server);
  registerAddToCartTool(server);
  registerViewCartTool(server);
  registerCheckoutTool(server);

  // Вклады Сбера — отдельный MCP App (свой ui://, без корзины/оплаты). Пересчёт
  // доходности по слайдерам — целиком на клиенте.
  registerDepositsUiResource(server, depositsHtml);
  registerSearchDepositsTool(server);
  // Скилл-методичка для агента (`skill://`): читается до вызова search_deposits.
  registerDepositAdvisorSkillResources(server);

  return server;
}
