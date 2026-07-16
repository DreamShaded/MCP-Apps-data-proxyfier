import { z } from "zod";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchProducts } from "../data-source/static-catalog.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { SHOPPING_ADVISOR_SKILL_URI } from "./shopping-advisor-skill.js";
import {
  searchFiltersSchema,
  searchResultSchema,
  type SearchFilters,
  type SearchResult,
} from "./product.js";
import { goods } from "./plural.js";

/**
 * Три варианта одного поиска по статическому каталогу Megamarket — ступени живого демо.
 * Данные и логика у всех одни; различаются ровно два наблюдаемых свойства: объявлен ли
 * `_meta.ui.resourceUri` (то есть рендерит ли хост виджет) и что сказано в описании.
 *
 * Почему три инструмента, а не один с параметром: привязка UI живёт в `_meta` на
 * РЕГИСТРАЦИИ инструмента и уезжает клиенту в `tools/list` — результат вызова её изменить
 * не может. Значит «с виджетом» и «без виджета» обязаны быть разными инструментами;
 * переключение ступеней идёт формулировкой запроса, без переподключения сервера.
 */

/** Имена инструментов — публичный контракт демо: их произносят вслух и пишут в чат. */
export const SEARCH_PRODUCTS_TOOL = "search_products";
export const SEARCH_PRODUCTS_WIDGET_TOOL = "search_products_widget";
export const SEARCH_PRODUCTS_ADVISED_TOOL = "search_products_advised";

const inputSchema = {
  query: z.string().min(1).describe("Поисковый запрос, например «беспроводные наушники»"),
  filters: searchFiltersSchema.optional(),
};

/** Общий обработчик: каталог статический, вариант влияет только на текстовый канал. */
function runSearch(query: string, filters: SearchFilters | undefined, verbose: boolean) {
  const products = searchProducts(query, filters ?? {});
  const structuredContent: SearchResult = { query, products };
  const text = verbose ? listAsText(structuredContent) : summarize(structuredContent);
  return { content: [{ type: "text" as const, text }], structuredContent };
}

/**
 * Ступень 2 демо: MCP без UI. Регистрируется базовым `server.registerTool`, а не
 * `registerAppTool` — последнему `_meta.ui` обязателен. UI здесь не «выключен флагом», а
 * буквально не объявлен, поэтому хосту нечего рисовать.
 */
export function registerSearchProductsTool(server: McpServer): void {
  server.registerTool(
    SEARCH_PRODUCTS_TOOL,
    {
      title: "Поиск товаров Megamarket (только текст)",
      description:
        "Ищет товары в каталоге Megamarket и возвращает результат ТОЛЬКО ТЕКСТОМ — списком позиций. " +
        "Интерактивный виджет не рендерится. Использовать по умолчанию, когда пользователь просто " +
        "просит найти товар и НЕ просил показать виджет, карточки или интерактивную выдачу, и НЕ " +
        "просил подобрать товар или помочь с выбором.",
      inputSchema,
      // Единый источник схемы выдачи — `searchResultSchema` (без дубля формы здесь).
      outputSchema: searchResultSchema.shape,
    },
    async ({ query, filters }) => runSearch(query, filters, true),
  );
}

/**
 * Ступень 3 демо: MCP с UI. Тот же поиск, но объявлен `ui://`-ресурс — хост рисует грид
 * карточек и отдаёт в него `structuredContent` через мост.
 */
export function registerSearchProductsWidgetTool(server: McpServer): void {
  registerAppTool(
    server,
    SEARCH_PRODUCTS_WIDGET_TOOL,
    {
      title: "Поиск товаров Megamarket (виджет)",
      description:
        "Ищет товары в каталоге Megamarket и рендерит интерактивный виджет — грид карточек " +
        "(фото, название, цена, рейтинг). Использовать ТОЛЬКО когда пользователь явно попросил " +
        "показать виджет, карточки, интерактивную выдачу или UI. Методичку skill:// перед вызовом " +
        "читать не нужно.",
      inputSchema,
      outputSchema: searchResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async ({ query, filters }) => runSearch(query, filters, false),
  );
}

/**
 * Ступень 4 демо: MCP с UI + skill. Инструмент и виджет те же, что на ступени 3, — вся
 * разница в описании, которое обязывает агента сперва прочитать методичку. Так на сцене
 * видно, что скилл меняет поведение агента, а не возможности сервера.
 */
export function registerSearchProductsAdvisedTool(server: McpServer): void {
  registerAppTool(
    server,
    SEARCH_PRODUCTS_ADVISED_TOOL,
    {
      title: "Подбор товара Megamarket (виджет + методичка)",
      description:
        "Подбирает товар под задачу пользователя и рендерит интерактивный виджет — грид карточек. " +
        `ОБЯЗАТЕЛЬНО: перед первым вызовом прочитай ресурс ${SHOPPING_ADVISOR_SKILL_URI} и следуй ` +
        "методичке (уточни бюджет и сценарий использования, переведи бюджет в filters, сравнивай по " +
        "цене и объёму отзывов, предложи 2–3 варианта с разным компромиссом). Использовать, когда " +
        "пользователь просит ПОДОБРАТЬ товар или ПОМОЧЬ ВЫБРАТЬ, а не просто найти.",
      inputSchema,
      outputSchema: searchResultSchema.shape,
      _meta: { ui: { resourceUri: MEGAMARKET_UI_RESOURCE_URI } },
    },
    async ({ query, filters }) => runSearch(query, filters, false),
  );
}

/** Зарегистрировать все три ступени поиска. */
export function registerSearchProductsTools(server: McpServer): void {
  registerSearchProductsTool(server);
  registerSearchProductsWidgetTool(server);
  registerSearchProductsAdvisedTool(server);
}

/** Короткая сводка рядом с виджетом: детали показывает сам виджет, дублировать незачем. */
function summarize(r: SearchResult): string {
  return `Megamarket по запросу «${r.query}»: ${goods(r.products.length)}.`;
}

/**
 * Развёрнутый список для варианта без UI: текстовый канал — единственное, что видит зал,
 * поэтому позиции выписываются целиком.
 */
function listAsText(r: SearchResult): string {
  if (r.products.length === 0) return `Megamarket по запросу «${r.query}»: ничего не найдено.`;
  const lines = r.products.map((p, i) => {
    const price = p.price === null ? "цена не указана" : `${p.price.toLocaleString("ru-RU")} ₽`;
    const reviews = p.reviewCount === null ? "" : ` (${p.reviewCount} отз.)`;
    const rating = p.rating === null ? "без оценок" : `рейтинг ${p.rating}${reviews}`;
    return `${i + 1}. ${p.title} — ${price}, ${rating}`;
  });
  return `Megamarket по запросу «${r.query}»: ${goods(r.products.length)}.\n${lines.join("\n")}`;
}
