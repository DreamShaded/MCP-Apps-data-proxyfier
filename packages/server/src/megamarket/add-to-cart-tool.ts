import { z } from "zod";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as cartStore from "../data-source/cart-store.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { type AddToCartResult, addToCartResultSchema } from "./cart.js";

/**
 * Инструмент `add_to_cart`: добавляет товар (по id из статического каталога) в in-memory
 * корзину процесса и возвращает актуальное состояние, чтобы UI обновил бейдж без отдельного
 * `view_cart`. `added:false` — id не найден в каталоге (корзина не меняется).
 */
export function registerAddToCartTool(server: McpServer): void {
  registerAppTool(
    server,
    "add_to_cart",
    {
      title: "Добавить в корзину Megamarket",
      description: "Добавляет товар в корзину (по id из выдачи/деталки) и возвращает актуальное состояние корзины.",
      inputSchema: {
        id: z.string().min(1).describe("Идентификатор товара из выдачи search_products или get_product"),
      },
      outputSchema: addToCartResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async ({ id }) => {
      const { added } = cartStore.add(id);
      const structuredContent: AddToCartResult = { cart: cartStore.view(), added };
      return { content: [{ type: "text", text: summarize(structuredContent) }], structuredContent };
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-корзиной). */
function summarize(r: AddToCartResult): string {
  if (!r.added) return "Товар не найден в каталоге Megamarket — не добавлен в корзину.";
  return `Товар добавлен в корзину Megamarket: ${r.cart.totalCount} товаров в корзине.`;
}
