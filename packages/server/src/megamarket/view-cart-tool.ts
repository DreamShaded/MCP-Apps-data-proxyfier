import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as cartStore from "../data-source/cart-store.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { type ViewCartResult, viewCartResultSchema } from "./cart.js";

/** Инструмент `view_cart`: текущее состояние in-memory корзины процесса. */
export function registerViewCartTool(server: McpServer): void {
  registerAppTool(
    server,
    "view_cart",
    {
      title: "Корзина Megamarket",
      description: "Возвращает текущее состояние корзины Megamarket (позиции, количество, сумма).",
      inputSchema: {},
      outputSchema: viewCartResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async () => {
      const structuredContent: ViewCartResult = { cart: cartStore.view() };
      return { content: [{ type: "text", text: summarize(structuredContent) }], structuredContent };
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-корзиной). */
function summarize(r: ViewCartResult): string {
  if (r.cart.totalCount === 0) return "Корзина Megamarket пуста.";
  return `Корзина Megamarket: ${r.cart.totalCount} товаров.`;
}
