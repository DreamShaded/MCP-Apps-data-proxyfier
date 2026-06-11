import { z } from "zod";
import type { Page } from "playwright";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserDriver } from "../browser/browser-driver.js";
import type { CachedReader } from "../cache/cached-reader.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { scrapeSearch } from "./scrape-search.js";
import {
  searchFiltersSchema,
  searchResultSchema,
  type Product,
  type SearchFilters,
  type SearchResult,
} from "./product.js";

/** Сигнатура live-скрейпа — точка подмены в тестах (без реального браузера). */
export type SearchScraper = (page: Page, query: string, filters: SearchFilters) => Promise<Product[]>;

/** Зависимости инструмента — инъектируются, чтобы тестировать его как чёрный ящик. */
export interface SearchProductsDeps {
  driver: BrowserDriver;
  reader: CachedReader;
  /** Подмена live-скрейпа в тестах (по умолчанию — реальный Playwright-скрейп). */
  scrape?: SearchScraper;
}

/**
 * Инструмент `search_products`: чтение через кэш-слой (хит → мгновенно; мисс → live
 * Playwright под сессией → запись), выдача в `structuredContent` гридом для UI.
 * Таймаут/сбой живого источника кэш-слой превращает в `source:'fallback'` — инструмент
 * лишь прокидывает это в UI флагом `fallback`, чтобы тот нарисовал заглушку, а не завис.
 */
export function registerSearchProductsTool(server: McpServer, deps: SearchProductsDeps): void {
  const scrape = deps.scrape ?? scrapeSearch;

  registerAppTool(
    server,
    "search_products",
    {
      title: "Поиск товаров Megamarket",
      description:
        "Ищет товары на Megamarket и рендерит выдачу гридом карточек (фото, название, цена, рейтинг). Золотые запросы отдаются из кэша мгновенно, произвольные — вживую через браузер.",
      inputSchema: {
        query: z.string().min(1).describe("Поисковый запрос, например «беспроводные наушники»"),
        filters: searchFiltersSchema.optional(),
      },
      // Единый источник схемы выдачи — `searchResultSchema` (без дубля формы здесь).
      outputSchema: searchResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async ({ query, filters }) => {
      const args = { query, filters: filters ?? {} };
      const result = await deps.reader.read<Product[]>("search_products", args, () =>
        deps.driver.withPage((page) => scrape(page, query, args.filters)),
      );

      const products = result.data ?? [];
      const fallback = result.source === "fallback" && result.data === null;
      const structuredContent: SearchResult = {
        query,
        products,
        source: result.source,
        stale: result.stale,
        fallback,
        fetchedAt: result.fetchedAt,
      };

      return { content: [{ type: "text", text: summarize(query, structuredContent) }], structuredContent };
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-гридом). */
function summarize(query: string, r: SearchResult): string {
  if (r.fallback) return `Не удалось загрузить выдачу Megamarket по запросу «${query}» — показан фолбэк.`;
  const head = `Megamarket по запросу «${query}»: ${r.products.length} товаров`;
  return r.stale ? `${head} (из кэша, возможно неактуально).` : `${head}.`;
}
