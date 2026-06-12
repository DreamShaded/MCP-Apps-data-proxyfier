import { z } from "zod";
import type { Page } from "playwright";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserDriver } from "../browser/browser-driver.js";
import type { CachedReader } from "../cache/cached-reader.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { scrapeProduct } from "./scrape-product.js";
import { getProductResultSchema, type GetProductResult, type ProductDetail } from "./product.js";

/** Сигнатура live-скрейпа деталки — точка подмены в тестах (без реального браузера). */
export type ProductScraper = (page: Page, id: string, url?: string | null) => Promise<ProductDetail>;

/** Зависимости инструмента — инъектируются, чтобы тестировать его как чёрный ящик. */
export interface GetProductDeps {
  driver: BrowserDriver;
  reader: CachedReader;
  /** Подмена live-скрейпа в тестах (по умолчанию — реальный Playwright-скрейп). */
  scrape?: ProductScraper;
}

/**
 * Инструмент `get_product`: ленивая подгрузка детальной карточки через кэш-слой (хит →
 * мгновенно; мисс → live Playwright под сессией → запись). Вызывается app-инициированно
 * из того же iframe выдачи («Подробнее») — хост обновляет тот же App без нового пузыря.
 * Таймаут/сбой источника кэш-слой превращает в `source:'fallback'`; инструмент лишь
 * прокидывает это флагом `fallback`, чтобы вью нарисовала заглушку, а не зависла.
 *
 * Ключ кэша — только `id` (без `url`): `url` — живая подсказка для перехода, а не часть
 * идентичности товара, иначе одна и та же деталка плодила бы записи под разными ссылками.
 *
 * Кэш-ключ сворачивает строки по регистру (см. `cache-key.ts`), т.е. различающиеся лишь
 * регистром id столкнулись бы. Здесь это безопасно: id из выдачи — это числовой
 * `data-item-id` либо нижне-регистровый href (см. `scrape-search`), коллизии «AbC/abc» не
 * возникают. Если живые селекторы начнут отдавать регистрозначимые id — хэшировать сырой id.
 */
export function registerGetProductTool(server: McpServer, deps: GetProductDeps): void {
  const scrape = deps.scrape ?? scrapeProduct;

  registerAppTool(
    server,
    "get_product",
    {
      title: "Карточка товара Megamarket",
      description:
        "Возвращает детальную карточку товара Megamarket (галерея, цена, характеристики, описание) по его id из выдачи. Золотые товары отдаются из кэша мгновенно, прочие — вживую через браузер.",
      inputSchema: {
        id: z.string().min(1).describe("Идентификатор товара из выдачи search_products"),
        url: z
          .string()
          .optional()
          .describe("Абсолютная ссылка карточки из выдачи — подсказка для живого перехода"),
        fresh: z
          .boolean()
          .optional()
          .describe("Обойти кэш и подгрузить карточку вживую через браузер (медленнее)."),
      },
      outputSchema: getProductResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async ({ id, url, fresh }) => {
      const result = await deps.reader.read<ProductDetail>(
        "get_product",
        { id },
        () => deps.driver.withPage((page) => scrape(page, id, url)),
        { mode: fresh ? "live" : undefined },
      );

      const product = result.data;
      const fallback = result.source === "fallback" && result.data === null;
      const structuredContent: GetProductResult = {
        product,
        source: result.source,
        stale: result.stale,
        fallback,
        fetchedAt: result.fetchedAt,
      };

      return { content: [{ type: "text", text: summarize(id, structuredContent) }], structuredContent };
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-деталкой). */
function summarize(id: string, r: GetProductResult): string {
  if (r.fallback || !r.product) return `Не удалось загрузить карточку товара Megamarket (${id}) — показан фолбэк.`;
  const head = `Карточка Megamarket: «${r.product.title}»`;
  return r.stale ? `${head} (из кэша, возможно неактуально).` : `${head}.`;
}
