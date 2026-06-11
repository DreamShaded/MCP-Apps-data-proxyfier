import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CachedReader } from "./cache/cached-reader.js";
import { buildCacheKey } from "./cache/cache-key.js";
import type { CacheEntry, CacheStore } from "./cache/cache-store.js";
import { runSeed, goldenSearchArgs, type SeedScrapers } from "./seed-cache.js";
import { registerSearchProductsTool } from "./megamarket/search-products-tool.js";
import { registerGetProductTool } from "./megamarket/get-product-tool.js";
import { registerSearchDepositsTool } from "./deposits/search-deposits-tool.js";
import type { Product, ProductDetail, SearchResult, GetProductResult } from "./megamarket/product.js";
import type { Deposit, SearchDepositsResult } from "./deposits/deposit.js";

// Выдача наушников: товар с живой ссылкой (деталка засидится) и без неё (пропустится).
const SEARCH_FIXTURE: Product[] = [
  { id: "p1", title: "Наушники A", price: 4990, oldPrice: null, discountPercent: null, imageUrl: null, rating: null, reviewCount: null, url: "https://megamarket.ru/p1" },
  { id: "p2", title: "Наушники B", price: 3500, oldPrice: null, discountPercent: null, imageUrl: null, rating: null, reviewCount: null, url: null },
];
const DETAIL_FIXTURE: ProductDetail = { ...SEARCH_FIXTURE[0], images: [], specs: [], description: "Описание" };
const DEPOSITS_FIXTURE: Deposit[] = [
  { id: "sbervklad", name: "СберВклад", description: null, minAmount: 1000, maxAmount: null, minTermMonths: 1, maxTermMonths: 36, capitalization: true, rates: [{ termMin: 6, termMax: 12, amountMin: 100_000, amountMax: null, capitalization: true, rate: 16.5 }] },
];

/** Фейковые скрейпы — игнорируют «страницу», отдают фикстуры (сидер без браузера). */
const SCRAPERS: SeedScrapers = {
  search: async () => SEARCH_FIXTURE,
  product: async (_page, id) => ({ ...DETAIL_FIXTURE, id }),
  deposits: async () => DEPOSITS_FIXTURE,
};

const fakeDriver = {
  withPage: async <T>(fn: (page: never) => Promise<T>): Promise<T> => fn({} as never),
  close: async () => {},
};

function memoryStore() {
  const map = new Map<string, CacheEntry>();
  const store: CacheStore = {
    get: async (id) => map.get(id) ?? null,
    set: async (id, entry) => void map.set(id, entry),
  };
  return { store, map };
}

/** Боевой скрейп, который в этих тестах звать нельзя: золотой ключ обязан дать хит. */
function mustNotScrape(): never {
  throw new Error("ожидался кэш-хит из золотой фикстуры, а пошёл живой скрейп");
}

/** Поднять сервер со всеми тремя инструментами поверх засиженного store. */
async function connectTools(store: CacheStore) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  const reader = new CachedReader(store);
  registerSearchProductsTool(server, { driver: fakeDriver, reader, scrape: mustNotScrape });
  registerGetProductTool(server, { driver: fakeDriver, reader, scrape: mustNotScrape });
  registerSearchDepositsTool(server, { driver: fakeDriver, reader, scrape: mustNotScrape });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test("засиженные золотые фикстуры отдаются инструментами как hit (парность ключей)", async () => {
  const { store } = memoryStore();
  const failures = await runSeed(fakeDriver, store, SCRAPERS);
  assert.equal(failures, 0, "все золотые сценарии должны записаться");

  const { client, server } = await connectTools(store);

  const search = (await client.callTool({ name: "search_products", arguments: goldenSearchArgs })).structuredContent as unknown as SearchResult;
  assert.equal(search.source, "hit");
  assert.equal(search.products.length, 2);

  const detail = (await client.callTool({ name: "get_product", arguments: { id: "p1", url: "https://megamarket.ru/p1" } })).structuredContent as unknown as GetProductResult;
  assert.equal(detail.source, "hit");
  assert.equal(detail.product?.id, "p1");

  const deposits = (await client.callTool({ name: "search_deposits", arguments: { amount: 500_000, termMonths: 12 } })).structuredContent as unknown as SearchDepositsResult;
  assert.equal(deposits.source, "hit");
  assert.equal(deposits.deposits.length, 1);

  await server.close();
});

test("деталка сидится только для товаров с живой ссылкой", async () => {
  const { store, map } = memoryStore();
  await runSeed(fakeDriver, store, SCRAPERS);

  const p1 = buildCacheKey("get_product", { id: "p1" }).id;
  const p2 = buildCacheKey("get_product", { id: "p2" }).id;
  assert.ok(map.has(p1), "деталка товара с url должна засидиться");
  assert.ok(!map.has(p2), "товар без url деталкой не сидится");
});

test("идемпотентность: повторный прогон не плодит дублей", async () => {
  const { store, map } = memoryStore();
  await runSeed(fakeDriver, store, SCRAPERS);
  const afterFirst = map.size;
  await runSeed(fakeDriver, store, SCRAPERS);
  assert.equal(map.size, afterFirst, "запись по нормализованному ключу перезаписывает, а не дублирует");
});

test("пустая выдача не пишет фикстуру и считается провалом сценария", async () => {
  const { store, map } = memoryStore();
  const failures = await runSeed(fakeDriver, store, { ...SCRAPERS, search: async () => [] });

  assert.equal(failures, 1, "наушники провалены, вклады — нет");
  assert.ok(!map.has(buildCacheKey("search_products", goldenSearchArgs).id), "пустую выдачу не коммитим");
  assert.ok(map.has(buildCacheKey("search_deposits", { amount: 500_000, termMonths: 12 }).id), "вклады засиделись независимо");
});
