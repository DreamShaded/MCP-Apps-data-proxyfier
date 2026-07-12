import { z } from "zod";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchProducts } from "../data-source/static-catalog.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { searchFiltersSchema, searchResultSchema, type SearchResult } from "./product.js";

/**
 * Инструмент `search_products`: поиск по статическому каталогу Megamarket (собран из
 * снапшотов `pages/` скриптом `pnpm update:data`) — подстрока в названии/бренде + ценовой
 * коридор, без сети и без браузера.
 */
export function registerSearchProductsTool(server: McpServer): void {
  registerAppTool(
    server,
    "search_products",
    {
      title: "Поиск товаров Megamarket",
      description:
        "Ищет товары в статическом каталоге Megamarket и рендерит выдачу гридом карточек (фото, название, цена, рейтинг).",
      inputSchema: {
        query: z.string().min(1).describe("Поисковый запрос, например «беспроводные наушники»"),
        filters: searchFiltersSchema.optional(),
      },
      // Единый источник схемы выдачи — `searchResultSchema` (без дубля формы здесь).
      outputSchema: searchResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async ({ query, filters }) => {
      const products = searchProducts(query, filters ?? {});
      const structuredContent: SearchResult = { query, products };
      return { content: [{ type: "text", text: summarize(query, structuredContent) }], structuredContent };
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-гридом). */
function summarize(query: string, r: SearchResult): string {
  return `Megamarket по запросу «${query}»: ${r.products.length} товаров.`;
}
