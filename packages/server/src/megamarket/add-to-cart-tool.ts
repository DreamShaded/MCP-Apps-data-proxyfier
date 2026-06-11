import { z } from "zod";
import type { Page } from "playwright";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserDriver } from "../browser/browser-driver.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { addToCart as liveAddToCart } from "./scrape-cart.js";
import { type AddToCartResult, addToCartResultSchema, type Cart } from "./cart.js";

/** Сигнатура живого добавления — точка подмены в тестах (без реального браузера). */
export type CartAdder = (page: Page, id: string, url?: string | null) => Promise<Cart>;

/**
 * Зависимости инструмента — инъектируются, чтобы тестировать его как чёрный ящик.
 * Корзина изменчива, поэтому здесь нет кэш-слоя: добавление — это запись, а не чтение.
 */
export interface AddToCartDeps {
  driver: BrowserDriver;
  /** Подмена живого клика в тестах (по умолчанию — реальный Playwright-клик). */
  add?: CartAdder;
}

/**
 * Инструмент `add_to_cart`: app-инициированный живой клик «в корзину» под сессией. Вся
 * последовательность (переход на товар → клик → чтение корзины) идёт в одном `withPage`,
 * т.е. сериализована мьютексом единственной страницы — параллельных кликов нет. На успехе
 * возвращаем актуальную корзину после клика, чтобы UI обновил бейдж без отдельного
 * `view_cart`. Сбой живого клика (антибот/таймаут/нет кнопки) не бросаем наружу —
 * превращаем в `fallback:true`, `cart:null`, чтобы вью показала ошибку, а не зависла.
 */
export function registerAddToCartTool(server: McpServer, deps: AddToCartDeps): void {
  const add = deps.add ?? liveAddToCart;

  registerAppTool(
    server,
    "add_to_cart",
    {
      title: "Добавить в корзину Megamarket",
      description:
        "Добавляет товар в реальную корзину Megamarket живым кликом под залогиненной сессией (по id из выдачи/деталки) и возвращает актуальное состояние корзины.",
      inputSchema: {
        id: z.string().min(1).describe("Идентификатор товара из выдачи search_products или get_product"),
        url: z
          .string()
          .optional()
          .describe("Абсолютная ссылка карточки из выдачи — подсказка для живого перехода"),
      },
      outputSchema: addToCartResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async ({ id, url }) => {
      try {
        const cart = await deps.driver.withPage((page) => add(page, id, url));
        const structuredContent: AddToCartResult = {
          cart,
          added: true,
          fallback: false,
          fetchedAt: new Date().toISOString(),
        };
        return { content: [{ type: "text", text: summarize(structuredContent) }], structuredContent };
      } catch {
        const structuredContent: AddToCartResult = { cart: null, added: false, fallback: true, fetchedAt: null };
        return { content: [{ type: "text", text: summarize(structuredContent) }], structuredContent };
      }
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-корзиной). */
function summarize(r: AddToCartResult): string {
  if (!r.added || !r.cart) return "Не удалось добавить товар в корзину Megamarket — показан фолбэк.";
  return `Товар добавлен в корзину Megamarket: ${r.cart.totalCount} товаров в корзине.`;
}
