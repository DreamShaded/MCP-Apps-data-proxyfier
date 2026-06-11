import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppHtmlResource } from "../ui-resource.js";

/**
 * Канонический `ui://`-URI приложения Megamarket. Это мини-SPA (выдача → деталка →
 * корзина); все инструменты Megamarket ссылаются ровно на него.
 */
export const MEGAMARKET_UI_RESOURCE_URI = "ui://mcp-app-proxyfier/megamarket.html";

/** Зарегистрировать UI-ресурс приложения Megamarket (собранный `dist/megamarket.html`). */
export function registerMegamarketUiResource(server: McpServer, html: string): void {
  registerAppHtmlResource(
    server,
    "Megamarket App",
    MEGAMARKET_UI_RESOURCE_URI,
    html,
    "Megamarket mini-app: рендерит выдачу поиска товаров гридом карточек.",
  );
}
