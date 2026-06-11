import type { Page } from "playwright";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserDriver } from "../browser/browser-driver.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { scrapeCart as liveScrapeCart } from "./scrape-cart.js";
import { type Cart, type ViewCartResult, viewCartResultSchema } from "./cart.js";

/** Сигнатура живого чтения корзины — точка подмены в тестах (без реального браузера). */
export type CartReader = (page: Page) => Promise<Cart>;

/**
 * Зависимости инструмента — инъектируются, чтобы тестировать его как чёрный ящик.
 * Без кэш-слоя сознательно: корзина изменчива, любой кэш протух бы после `add_to_cart`,
 * поэтому состояние всегда читается живьём со страницы корзины.
 */
export interface ViewCartDeps {
  driver: BrowserDriver;
  /** Подмена живого чтения в тестах (по умолчанию — реальный Playwright-скрейп `/cart`). */
  read?: CartReader;
}

/**
 * Инструмент `view_cart`: живое чтение реальной корзины Megamarket под сессией (всегда
 * актуальное состояние, без кэша). Идёт под единственной страницей в `withPage` —
 * сериализовано с добавлением. Сбой/таймаут живого источника превращаем в `fallback:true`,
 * `cart:null`, чтобы вью показала аккуратную ошибку, а не зависла.
 */
export function registerViewCartTool(server: McpServer, deps: ViewCartDeps): void {
  const read = deps.read ?? liveScrapeCart;

  registerAppTool(
    server,
    "view_cart",
    {
      title: "Корзина Megamarket",
      description: "Возвращает актуальное состояние реальной корзины Megamarket (позиции, количество, сумма) под залогиненной сессией.",
      inputSchema: {},
      outputSchema: viewCartResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async () => {
      try {
        const cart = await deps.driver.withPage((page) => read(page));
        const structuredContent: ViewCartResult = {
          cart,
          fallback: false,
          fetchedAt: new Date().toISOString(),
        };
        return { content: [{ type: "text", text: summarize(structuredContent) }], structuredContent };
      } catch {
        const structuredContent: ViewCartResult = { cart: null, fallback: true, fetchedAt: null };
        return { content: [{ type: "text", text: summarize(structuredContent) }], structuredContent };
      }
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-корзиной). */
function summarize(r: ViewCartResult): string {
  if (r.fallback || !r.cart) return "Не удалось загрузить корзину Megamarket — показан фолбэк.";
  if (r.cart.totalCount === 0) return "Корзина Megamarket пуста.";
  return `Корзина Megamarket: ${r.cart.totalCount} товаров.`;
}
