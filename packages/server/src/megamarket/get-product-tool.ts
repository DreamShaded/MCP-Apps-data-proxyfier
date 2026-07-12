import { z } from "zod";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProduct } from "../data-source/static-catalog.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { getProductResultSchema, type GetProductResult } from "./product.js";

/**
 * Инструмент `get_product`: детальная карточка товара из статического каталога по `id`
 * из выдачи `search_products`. Вызывается app-инициированно из того же iframe выдачи
 * («Подробнее») — хост обновляет тот же App без нового пузыря.
 */
export function registerGetProductTool(server: McpServer): void {
  registerAppTool(
    server,
    "get_product",
    {
      title: "Карточка товара Megamarket",
      description:
        "Возвращает детальную карточку товара Megamarket (галерея, цена, характеристики, описание) по его id из выдачи.",
      inputSchema: {
        id: z.string().min(1).describe("Идентификатор товара из выдачи search_products"),
      },
      outputSchema: getProductResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async ({ id }) => {
      const structuredContent: GetProductResult = { product: getProduct(id) };
      return { content: [{ type: "text", text: summarize(id, structuredContent) }], structuredContent };
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-деталкой). */
function summarize(id: string, r: GetProductResult): string {
  if (!r.product) return `Товар Megamarket (${id}) не найден в каталоге.`;
  return `Карточка Megamarket: «${r.product.title}».`;
}
