import type { Page } from "playwright";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserDriver } from "../browser/browser-driver.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { CART_URL, checkoutHandoff as liveCheckout } from "./scrape-cart.js";
import { type Cart, type CheckoutResult, checkoutResultSchema } from "./cart.js";

/** Сигнатура живого хэндофа (переход на корзину + вывод окна вперёд) — точка подмены в тестах. */
export type CheckoutReader = (page: Page) => Promise<Cart>;

/**
 * Зависимости инструмента — инъектируются, чтобы тестировать его как чёрный ящик без
 * реального браузера. Без кэша сознательно: корзина изменчива, хэндоф читает её живьём.
 */
export interface CheckoutDeps {
  driver: BrowserDriver;
  /** Подмена живого хэндофа в тестах (по умолчанию — реальный переход на `/cart` + `bringToFront`). */
  read?: CheckoutReader;
}

/**
 * Инструмент `checkout`: завершение флоу Megamarket — app-инициированное «открыть в браузере».
 * Выводит живое headed-окно вперёд уже на заполненной настоящей корзине (товары из `add_to_cart`)
 * и возвращает данные хэндофа: `url` корзины/оформления + снимок состояния для сводки на экране.
 * Дальше пользователь дозавершает оплату руками в окне — платёжную страницу/3DS в чат-iframe
 * сознательно не встраиваем (frame-busting сайта + закрытая песочница; данные карты не идут через UI).
 *
 * Идёт под единственной страницей в `withPage` — сериализовано с остальными операциями корзины.
 * Сбой живого хэндофа не бросаем наружу: `fallback:true`, `cart:null`, но `url` отдаём всегда —
 * ссылку на корзину можно открыть руками, даже если снять её состояние не удалось.
 */
export function registerCheckoutTool(server: McpServer, deps: CheckoutDeps): void {
  const read = deps.read ?? liveCheckout;

  registerAppTool(
    server,
    "checkout",
    {
      title: "Оформление Megamarket",
      description:
        "Открывает заполненную реальную корзину Megamarket в живом окне браузера для завершения оплаты руками и возвращает ссылку хэндофа.",
      inputSchema: {},
      outputSchema: checkoutResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async () => {
      try {
        const cart = await deps.driver.withPage((page) => read(page));
        const structuredContent: CheckoutResult = {
          url: CART_URL,
          cart,
          fallback: false,
          fetchedAt: new Date().toISOString(),
        };
        return { content: [{ type: "text", text: summarize(structuredContent) }], structuredContent };
      } catch {
        const structuredContent: CheckoutResult = { url: CART_URL, cart: null, fallback: true, fetchedAt: null };
        return { content: [{ type: "text", text: summarize(structuredContent) }], structuredContent };
      }
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-хэндофом). */
function summarize(r: CheckoutResult): string {
  if (r.fallback || !r.cart) {
    return `Не удалось подтвердить корзину — откройте её в браузере вручную: ${r.url}`;
  }
  const total =
    r.cart.totalPrice !== null ? `, на сумму ${new Intl.NumberFormat("ru-RU").format(r.cart.totalPrice)} ₽` : "";
  return `Корзина Megamarket открыта в браузере: ${r.cart.totalCount} товаров${total}. Завершите оплату в окне.`;
}
