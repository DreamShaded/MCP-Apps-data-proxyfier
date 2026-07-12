import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as cartStore from "../data-source/cart-store.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { type CheckoutResult, checkoutResultSchema } from "./cart.js";

/**
 * Инструмент `checkout`: статическое подтверждение заказа (дизайн-референс —
 * `pages/market/checkout/`), без хэндофа в реальный браузер и без 3DS/оплаты в iframe.
 * Отдаёт снимок корзины на момент оформления и очищает её — как на настоящем сайте.
 */
export function registerCheckoutTool(server: McpServer): void {
  registerAppTool(
    server,
    "checkout",
    {
      title: "Оформление Megamarket",
      description: "Оформляет заказ по текущей корзине и возвращает подтверждение с её снимком.",
      inputSchema: {},
      outputSchema: checkoutResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async () => {
      const cart = cartStore.view();
      cartStore.clear();
      const structuredContent: CheckoutResult = { cart, confirmedAt: new Date().toISOString() };
      return { content: [{ type: "text", text: summarize(structuredContent) }], structuredContent };
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-подтверждением). */
function summarize(r: CheckoutResult): string {
  const total =
    r.cart.totalPrice !== null ? `, на сумму ${new Intl.NumberFormat("ru-RU").format(r.cart.totalPrice)} ₽` : "";
  return `Заказ Megamarket оформлен: ${r.cart.totalCount} товаров${total}.`;
}
