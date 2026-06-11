import { z } from "zod";
import type { Page } from "playwright";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserDriver } from "../browser/browser-driver.js";
import type { CachedReader } from "../cache/cached-reader.js";
import { DEPOSITS_UI_RESOURCE_URI } from "./deposits-ui-resource.js";
import { scrapeDeposits } from "./scrape-deposits.js";
import { searchDepositsResultSchema, type Deposit, type SearchDepositsResult } from "./deposit.js";

/** Сигнатура live-скрейпа — точка подмены в тестах (без реального браузера). */
export type DepositsScraper = (page: Page, amount: number, termMonths: number) => Promise<Deposit[]>;

/** Зависимости инструмента — инъектируются, чтобы тестировать его как чёрный ящик. */
export interface SearchDepositsDeps {
  driver: BrowserDriver;
  reader: CachedReader;
  /** Подмена live-скрейпа в тестах (по умолчанию — реальный Playwright-скрейп). */
  scrape?: DepositsScraper;
}

/**
 * Инструмент `search_deposits`: чтение через кэш-слой (хит → мгновенно; мисс → live
 * Playwright под сессией → запись). Отдаёт линейку вкладов и **полную сетку ставок** в
 * `structuredContent`, чтобы пересчёт доходности по слайдерам шёл целиком на клиенте.
 * Таймаут/сбой кэш-слой превращает в `source:'fallback'` — инструмент прокидывает это
 * флагом `fallback`, чтобы UI нарисовал заглушку, а не завис.
 *
 * Имена аргументов (`amount`, `termMonths`) совпадают с золотым сценарием сидера
 * (`seed-cache.ts`), чтобы запрос «вклад 500к на год» попал в свою фикстуру.
 */
export function registerSearchDepositsTool(server: McpServer, deps: SearchDepositsDeps): void {
  const scrape = deps.scrape ?? scrapeDeposits;

  registerAppTool(
    server,
    "search_deposits",
    {
      title: "Подбор вкладов Сбера",
      description:
        "Подбирает вклады Сбера и рендерит карточки со слайдерами суммы/срока. Доходность пересчитывается мгновенно на клиенте из полной сетки ставок; золотые запросы отдаются из кэша.",
      inputSchema: {
        amount: z.number().positive().describe("Сумма вклада в рублях, например 500000"),
        termMonths: z.number().int().positive().describe("Срок вклада в месяцах, например 12"),
      },
      // Единый источник схемы выдачи — `searchDepositsResultSchema` (без дубля формы здесь).
      outputSchema: searchDepositsResultSchema.shape,
      _meta: { ui: { resourceUri: DEPOSITS_UI_RESOURCE_URI } },
    },
    async ({ amount, termMonths }) => {
      const args = { amount, termMonths };
      const result = await deps.reader.read<Deposit[]>("search_deposits", args, () =>
        deps.driver.withPage((page) => scrape(page, amount, termMonths)),
      );

      const deposits = result.data ?? [];
      const fallback = result.source === "fallback" && result.data === null;
      const structuredContent: SearchDepositsResult = {
        amount,
        termMonths,
        deposits,
        source: result.source,
        stale: result.stale,
        fallback,
        fetchedAt: result.fetchedAt,
      };

      return { content: [{ type: "text", text: summarize(structuredContent) }], structuredContent };
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-карточками). */
function summarize(r: SearchDepositsResult): string {
  if (r.fallback) return `Не удалось загрузить вклады Сбера — показан фолбэк.`;
  const head = `Вклады Сбера для ${r.amount.toLocaleString("ru-RU")} ₽ на ${r.termMonths} мес.: ${r.deposits.length} вариантов`;
  return r.stale ? `${head} (из кэша, возможно неактуально).` : `${head}.`;
}
