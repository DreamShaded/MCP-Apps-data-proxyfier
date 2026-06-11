import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppHtmlResource } from "../ui-resource.js";

/**
 * Канонический `ui://`-URI приложения «Вклады Сбера». Это **отдельный** MCP App
 * (свой ресурс, без корзины/оплаты); инструмент `search_deposits` ссылается ровно на него.
 */
export const DEPOSITS_UI_RESOURCE_URI = "ui://mcp-app-proxyfier/deposits.html";

/** Зарегистрировать UI-ресурс приложения вкладов (собранный `dist/deposits.html`). */
export function registerDepositsUiResource(server: McpServer, html: string): void {
  registerAppHtmlResource(
    server,
    "Sber Deposits App",
    DEPOSITS_UI_RESOURCE_URI,
    html,
    "Sber deposits mini-app: карточки вкладов со слайдерами суммы/срока и клиентским пересчётом доходности.",
  );
}
