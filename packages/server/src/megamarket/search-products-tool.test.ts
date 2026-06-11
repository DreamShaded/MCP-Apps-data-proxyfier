import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CachedReader } from "../cache/cached-reader.js";
import { buildCacheKey } from "../cache/cache-key.js";
import type { CacheEntry, CacheStore } from "../cache/cache-store.js";
import { registerSearchProductsTool, type SearchScraper } from "./search-products-tool.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import type { Product, SearchResult } from "./product.js";

const FIXTURE: Product[] = [
  { id: "p1", title: "Наушники A", price: 4990, oldPrice: 6990, discountPercent: 29, imageUrl: "https://megamarket.ru/a.jpg", rating: 4.7, reviewCount: 120, url: "https://megamarket.ru/p1" },
  { id: "p2", title: "Наушники B", price: 3500, oldPrice: null, discountPercent: null, imageUrl: null, rating: null, reviewCount: null, url: null },
];

/** In-memory хранилище кэша — диск в тестах не трогаем (тот же шов, что в cache-store). */
function memoryStore(seed: Record<string, CacheEntry> = {}): CacheStore {
  const map = new Map<string, CacheEntry>(Object.entries(seed));
  return {
    get: async (id) => map.get(id) ?? null,
    set: async (id, entry) => void map.set(id, entry),
  };
}

const fakeDriver = {
  // Прокидываем фейковую «страницу» — скрейп в тестах подменён и её игнорирует.
  withPage: async <T>(fn: (page: never) => Promise<T>): Promise<T> => fn({} as never),
  close: async () => {},
};

/** Поднять сервер с одним инструментом `search_products` и связать с in-memory клиентом. */
async function connect(opts: { store?: CacheStore; scrape: SearchScraper }) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerSearchProductsTool(server, {
    driver: fakeDriver,
    reader: new CachedReader(opts.store ?? memoryStore()),
    scrape: opts.scrape,
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callSearch(client: Client, query: string, filters?: unknown) {
  const result = await client.callTool({ name: "search_products", arguments: { query, ...(filters ? { filters } : {}) } });
  return result.structuredContent as unknown as SearchResult;
}

test("search_products declares its UI via _meta.ui.resourceUri", async () => {
  const { client, server } = await connect({ scrape: async () => FIXTURE });
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "search_products");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

test("miss → live scrape result is returned as structuredContent and written to cache", async () => {
  const store = memoryStore();
  let calls = 0;
  const { client, server } = await connect({ store, scrape: async () => (calls++, FIXTURE) });

  const sc = await callSearch(client, "наушники");
  assert.equal(sc.source, "miss");
  assert.equal(sc.fallback, false);
  assert.equal(sc.products.length, 2);
  assert.equal(sc.products[0].title, "Наушники A");
  assert.equal(calls, 1, "live source must be hit exactly once on a miss");

  // Запись кэша состоялась — повторный вызов уже не дёргает живой источник.
  const sc2 = await callSearch(client, "наушники");
  assert.equal(sc2.source, "hit");
  assert.equal(calls, 1, "second call must serve from cache, not re-scrape");
  await server.close();
});

test("hit → golden fixture is served without touching the live source", async () => {
  const { id, canonical } = buildCacheKey("search_products", { query: "наушники", filters: {} });
  const store = memoryStore({
    [id]: { tool: "search_products", key: canonical, data: FIXTURE, fetchedAt: "2026-01-01T00:00:00.000Z", ttlMs: null, golden: true },
  });
  let calls = 0;
  const { client, server } = await connect({ store, scrape: async () => (calls++, []) });

  const sc = await callSearch(client, "наушники");
  assert.equal(sc.source, "hit");
  assert.equal(sc.products.length, 2);
  assert.equal(calls, 0, "golden hit must not call the live scraper");
  await server.close();
});

test("scrape failure → fallback UI flag, no products, no throw", async () => {
  const { client, server } = await connect({
    scrape: async () => {
      throw new Error("antibot / timeout");
    },
  });
  const sc = await callSearch(client, "что-то редкое");
  assert.equal(sc.source, "fallback");
  assert.equal(sc.fallback, true);
  assert.deepEqual(sc.products, []);
  await server.close();
});

test("filters pass through to the scraper", async () => {
  let seen: unknown;
  const { client, server } = await connect({
    scrape: async (_page, _query, filters) => {
      seen = filters;
      return FIXTURE;
    },
  });
  await callSearch(client, "наушники", { priceMax: 5000 });
  assert.deepEqual(seen, { priceMax: 5000 });
  await server.close();
});
