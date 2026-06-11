/**
 * Живой сидинг «золотых» сценариев (`pnpm seed:cache`).
 *
 * Прогоняет золотые запросы вживую через Playwright под залогиненной сессией и
 * пишет ответы коммитимыми фикстурами в `cache/data/golden/`, чтобы на демо они
 * отдавались мгновенно (кэш-хит, без захода на сайт). Набор из PRD: поиск
 * «беспроводные наушники до 5000 ₽» + деталки товаров этой выдачи + «вклад 500к
 * на год».
 *
 * Идемпотентность: запись идёт по нормализованному ключу (`buildCacheKey`),
 * повторный прогон перезаписывает те же фикстуры без дублей.
 *
 * ВАЖНО: аргументы каждого золотого сценария обязаны совпадать с тем, что
 * одноимённый инструмент передаёт в `reader.read` — иначе демо-запрос построит
 * другой ключ и не попадёт в свою фикстуру. Парность ключей закрыта тестом.
 *
 * Как и бутстрап-логин, не запускается одновременно с сервером: Chromium держит
 * singleton-локу на профиле `./.session/`.
 */
import { pathToFileURL } from "node:url";
import type { Page } from "playwright";
import { createBrowserSession } from "./browser/create-session.js";
import { createCache } from "./cache/create-cache.js";
import { buildCacheKey } from "./cache/cache-key.js";
import type { BrowserDriver } from "./browser/browser-driver.js";
import type { CacheStore } from "./cache/cache-store.js";
import { scrapeSearch } from "./megamarket/scrape-search.js";
import { scrapeProduct } from "./megamarket/scrape-product.js";
import { scrapeDeposits } from "./deposits/scrape-deposits.js";
import type { Product, ProductDetail, SearchFilters } from "./megamarket/product.js";
import type { Deposit } from "./deposits/deposit.js";

/** Параметры золотого поиска наушников (фильтр-коридор «до 5000 ₽»). */
const HEADPHONES_QUERY = "беспроводные наушники";
const HEADPHONES_FILTERS: SearchFilters = { priceMax: 5000 };
/** Параметры золотого вклада «500к на год». */
const DEPOSIT_AMOUNT = 500_000;
const DEPOSIT_TERM_MONTHS = 12;

/** Аргументы золотых сценариев — зеркалят `reader.read(...)` своих инструментов. */
export const goldenSearchArgs = { query: HEADPHONES_QUERY, filters: HEADPHONES_FILTERS };
export const goldenDepositsArgs = { amount: DEPOSIT_AMOUNT, termMonths: DEPOSIT_TERM_MONTHS };
/** `get_product` кэширует только по `id` (см. инструмент) — `url` в ключ не входит. */
export const goldenProductArgs = (id: string): { id: string } => ({ id });

/** Инъекция скрейпов — в тестах подменяются, чтобы прогнать сидер без браузера. */
export interface SeedScrapers {
  search?: (page: Page, query: string, filters: SearchFilters) => Promise<Product[]>;
  product?: (page: Page, id: string, url?: string | null) => Promise<ProductDetail>;
  deposits?: (page: Page, amount: number, termMonths: number) => Promise<Deposit[]>;
}

/** Записать золотую фикстуру: ключ из (tool, args), не истекает, каталог golden/. */
async function writeGolden(store: CacheStore, tool: string, args: unknown, data: unknown): Promise<void> {
  const { id, canonical } = buildCacheKey(tool, args);
  await store.set(id, { tool, key: canonical, data, fetchedAt: new Date().toISOString(), ttlMs: null, golden: true });
}

/** Засидить поиск наушников и деталки всех товаров его выдачи. Возвращает число деталок. */
async function seedHeadphones(driver: BrowserDriver, store: CacheStore, scrapers: SeedScrapers): Promise<number> {
  const search = scrapers.search ?? scrapeSearch;
  const product = scrapers.product ?? scrapeProduct;

  const products = await driver.withPage((page) => search(page, HEADPHONES_QUERY, HEADPHONES_FILTERS));
  if (products.length === 0) {
    throw new Error("пустая выдача наушников (сессия не залогинена или селекторы устарели) — фикстуру не пишем");
  }
  await writeGolden(store, "search_products", goldenSearchArgs, products);

  // Деталка каждого товара выдачи: на демо «Подробнее» по любой карточке обязано попасть в кэш.
  let details = 0;
  for (const p of products) {
    if (!p.url) continue; // без живой ссылки переход к деталке ненадёжен — пропускаем
    const detail = await driver.withPage((page) => product(page, p.id, p.url));
    if (!detail.title || detail.title === "Без названия") continue; // пустую деталку не коммитим
    await writeGolden(store, "get_product", goldenProductArgs(p.id), detail);
    details++;
  }
  return details;
}

/** Засидить золотую линейку вкладов. Возвращает число вариантов. */
async function seedDeposits(driver: BrowserDriver, store: CacheStore, scrapers: SeedScrapers): Promise<number> {
  const deposits = scrapers.deposits ?? scrapeDeposits;
  const list = await driver.withPage((page) => deposits(page, DEPOSIT_AMOUNT, DEPOSIT_TERM_MONTHS));
  if (list.length === 0) {
    throw new Error("пустая линейка вкладов (сессия не залогинена или селекторы устарели) — фикстуру не пишем");
  }
  await writeGolden(store, "search_deposits", goldenDepositsArgs, list);
  return list.length;
}

/**
 * Прогнать все золотые сценарии. Сценарии независимы: сбой одного не отменяет
 * уже записанные фикстуры другого. Возвращает число проваленных сценариев.
 */
export async function runSeed(driver: BrowserDriver, store: CacheStore, scrapers: SeedScrapers = {}): Promise<number> {
  let failures = 0;
  try {
    const details = await seedHeadphones(driver, store, scrapers);
    console.error(`[seed:cache] ✓ наушники: выдача + ${details} деталок товаров`);
  } catch (error) {
    failures++;
    console.error("[seed:cache] ✗ наушники:", (error as Error).message);
  }
  try {
    const n = await seedDeposits(driver, store, scrapers);
    console.error(`[seed:cache] ✓ вклады: ${n} вариантов`);
  } catch (error) {
    failures++;
    console.error("[seed:cache] ✗ вклады:", (error as Error).message);
  }
  return failures;
}

async function main(): Promise<void> {
  console.error("[seed:cache] Живой прогон золотых сценариев через Playwright…");
  const { driver } = createBrowserSession();
  const { store } = createCache();
  try {
    const failures = await runSeed(driver, store);
    if (failures > 0) throw new Error(`провалено сценариев: ${failures} (см. лог выше)`);
    console.error("[seed:cache] готово. Золотые фикстуры — в cache/data/golden/.");
  } finally {
    await driver.close().catch(() => {});
  }
}

// Запуск только как CLI-скрипт; при импорте из теста `main` не вызывается.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error("[seed:cache] fatal:", error);
      process.exit(1);
    },
  );
}
