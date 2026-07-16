import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppHtmlResource } from "../ui-resource.js";

/**
 * Канонический `ui://`-URI приложения Megamarket. Это мини-SPA (выдача → деталка →
 * корзина); все инструменты Megamarket ссылаются ровно на него.
 */
export const MEGAMARKET_UI_RESOURCE_URI = "ui://mcp-app-proxyfier/megamarket.html";

/**
 * CDN фотографий товаров. Единственный внешний origin приложения: JS/CSS инлайнятся в
 * бандл, а фото приходят ссылками в `structuredContent` (все 293 — с этого хоста).
 * Без объявления песочница-iframe režет их по CSP `img-src`, и грид остаётся без картинок.
 */
const MEGAMARKET_CDN = "https://main-cdn.sbermegamarket.ru";

/** Зарегистрировать UI-ресурс приложения Megamarket (собранный `dist/megamarket.html`). */
export function registerMegamarketUiResource(server: McpServer, html: string): void {
  registerAppHtmlResource(
    server,
    "Megamarket App",
    MEGAMARKET_UI_RESOURCE_URI,
    html,
    "Megamarket mini-app: рендерит выдачу поиска товаров гридом карточек.",
    [MEGAMARKET_CDN],
  );
}
