import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CachedReader } from "../cache/cached-reader.js";
import { buildCacheKey } from "../cache/cache-key.js";
import type { CacheEntry, CacheStore } from "../cache/cache-store.js";
import { registerGetProductTool, type ProductScraper } from "./get-product-tool.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import type { ProductDetail, GetProductResult } from "./product.js";

const DETAIL: ProductDetail = {
  id: "p1",
  title: "Наушники A",
  price: 4990,
  oldPrice: 6990,
  discountPercent: 29,
  imageUrl: "https://megamarket.ru/a.jpg",
  rating: 4.7,
  reviewCount: 120,
  url: "https://megamarket.ru/p1",
  images: ["https://megamarket.ru/a.jpg", "https://megamarket.ru/a2.jpg"],
  specs: [
    { name: "Тип", value: "Полноразмерные" },
    { name: "Подключение", value: "Bluetooth 5.3" },
  ],
  description: "Беспроводные наушники с шумоподавлением.",
};

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

/** Поднять сервер с одним инструментом `get_product` и связать с in-memory клиентом. */
async function connect(opts: { store?: CacheStore; scrape: ProductScraper }) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerGetProductTool(server, {
    driver: fakeDriver,
    reader: new CachedReader(opts.store ?? memoryStore()),
    scrape: opts.scrape,
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callGet(client: Client, id: string, url?: string) {
  const result = await client.callTool({ name: "get_product", arguments: { id, ...(url ? { url } : {}) } });
  return result.structuredContent as unknown as GetProductResult;
}

test("get_product declares its UI via _meta.ui.resourceUri (same Megamarket app)", async () => {
  const { client, server } = await connect({ scrape: async () => DETAIL });
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "get_product");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

test("miss → live scrape detail is returned as structuredContent and written to cache", async () => {
  const store = memoryStore();
  let calls = 0;
  const { client, server } = await connect({ store, scrape: async () => (calls++, DETAIL) });

  const sc = await callGet(client, "p1");
  assert.equal(sc.source, "miss");
  assert.equal(sc.fallback, false);
  assert.equal(sc.product?.title, "Наушники A");
  assert.equal(sc.product?.specs.length, 2);
  assert.equal(sc.product?.images.length, 2);
  assert.equal(calls, 1, "live source must be hit exactly once on a miss");

  // Запись кэша состоялась — повторный вызов уже не дёргает живой источник.
  const sc2 = await callGet(client, "p1");
  assert.equal(sc2.source, "hit");
  assert.equal(calls, 1, "second call must serve from cache, not re-scrape");
  await server.close();
});

test("cache key ignores the url hint — same id served from cache regardless of url", async () => {
  const store = memoryStore();
  let calls = 0;
  const { client, server } = await connect({ store, scrape: async () => (calls++, DETAIL) });

  await callGet(client, "p1", "https://megamarket.ru/p1");
  const sc = await callGet(client, "p1", "https://megamarket.ru/other-link");
  assert.equal(sc.source, "hit");
  assert.equal(calls, 1, "url is a live hint, not part of cache identity");
  await server.close();
});

test("hit → golden detail fixture is served without touching the live source", async () => {
  const { id, canonical } = buildCacheKey("get_product", { id: "p1" });
  const store = memoryStore({
    [id]: { tool: "get_product", key: canonical, data: DETAIL, fetchedAt: "2026-01-01T00:00:00.000Z", ttlMs: null, golden: true },
  });
  let calls = 0;
  const { client, server } = await connect({ store, scrape: async () => (calls++, DETAIL) });

  const sc = await callGet(client, "p1");
  assert.equal(sc.source, "hit");
  assert.equal(sc.product?.title, "Наушники A");
  assert.equal(calls, 0, "golden hit must not call the live scraper");
  await server.close();
});

test("scrape failure → fallback flag, null product, no throw", async () => {
  const { client, server } = await connect({
    scrape: async () => {
      throw new Error("antibot / timeout");
    },
  });
  const sc = await callGet(client, "редкий-id");
  assert.equal(sc.source, "fallback");
  assert.equal(sc.fallback, true);
  assert.equal(sc.product, null);
  await server.close();
});

test("id and url pass through to the scraper", async () => {
  let seen: { id: string; url?: string | null } | undefined;
  const { client, server } = await connect({
    scrape: async (_page, id, url) => {
      seen = { id, url };
      return DETAIL;
    },
  });
  await callGet(client, "p1", "https://megamarket.ru/p1");
  assert.deepEqual(seen, { id: "p1", url: "https://megamarket.ru/p1" });
  await server.close();
});
