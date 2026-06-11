import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CachedReader } from "../cache/cached-reader.js";
import { buildCacheKey } from "../cache/cache-key.js";
import type { CacheEntry, CacheStore } from "../cache/cache-store.js";
import { registerSearchDepositsTool, type DepositsScraper } from "./search-deposits-tool.js";
import { DEPOSITS_UI_RESOURCE_URI } from "./deposits-ui-resource.js";
import type { Deposit, SearchDepositsResult } from "./deposit.js";

const FIXTURE: Deposit[] = [
  {
    id: "sbervklad",
    name: "СберВклад",
    description: "Базовый вклад",
    minAmount: 1000,
    maxAmount: null,
    minTermMonths: 1,
    maxTermMonths: 36,
    capitalization: true,
    rates: [
      { termMin: 6, termMax: 12, amountMin: 100_000, amountMax: null, capitalization: true, rate: 16.5 },
    ],
  },
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
  withPage: async <T>(fn: (page: never) => Promise<T>): Promise<T> => fn({} as never),
  close: async () => {},
};

/** Поднять сервер с одним инструментом `search_deposits` и связать с in-memory клиентом. */
async function connect(opts: { store?: CacheStore; scrape: DepositsScraper }) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerSearchDepositsTool(server, {
    driver: fakeDriver,
    reader: new CachedReader(opts.store ?? memoryStore()),
    scrape: opts.scrape,
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callSearch(client: Client, amount: number, termMonths: number) {
  const result = await client.callTool({ name: "search_deposits", arguments: { amount, termMonths } });
  return result.structuredContent as unknown as SearchDepositsResult;
}

test("search_deposits declares its own UI via _meta.ui.resourceUri", async () => {
  const { client, server } = await connect({ scrape: async () => FIXTURE });
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "search_deposits");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, DEPOSITS_UI_RESOURCE_URI);
  await server.close();
});

test("miss → live scrape returns deposits + grid as structuredContent and is cached", async () => {
  const store = memoryStore();
  let calls = 0;
  const { client, server } = await connect({ store, scrape: async () => (calls++, FIXTURE) });

  const sc = await callSearch(client, 500_000, 12);
  assert.equal(sc.source, "miss");
  assert.equal(sc.fallback, false);
  assert.equal(sc.amount, 500_000);
  assert.equal(sc.termMonths, 12);
  assert.equal(sc.deposits.length, 1);
  assert.equal(sc.deposits[0].rates[0].rate, 16.5);
  assert.equal(calls, 1, "live source must be hit exactly once on a miss");

  const sc2 = await callSearch(client, 500_000, 12);
  assert.equal(sc2.source, "hit");
  assert.equal(calls, 1, "second call must serve from cache, not re-scrape");
  await server.close();
});

test("hit → golden fixture is served without touching the live source", async () => {
  const { id, canonical } = buildCacheKey("search_deposits", { amount: 500_000, termMonths: 12 });
  const store = memoryStore({
    [id]: { tool: "search_deposits", key: canonical, data: FIXTURE, fetchedAt: "2026-01-01T00:00:00.000Z", ttlMs: null, golden: true },
  });
  let calls = 0;
  const { client, server } = await connect({ store, scrape: async () => (calls++, []) });

  const sc = await callSearch(client, 500_000, 12);
  assert.equal(sc.source, "hit");
  assert.equal(sc.deposits.length, 1);
  assert.equal(calls, 0, "golden hit must not call the live scraper");
  await server.close();
});

test("scrape failure → fallback UI flag, no deposits, no throw", async () => {
  const { client, server } = await connect({
    scrape: async () => {
      throw new Error("antibot / timeout");
    },
  });
  const sc = await callSearch(client, 123_456, 9);
  assert.equal(sc.source, "fallback");
  assert.equal(sc.fallback, true);
  assert.deepEqual(sc.deposits, []);
  // эхо запроса сохраняется даже на фолбэке — слайдеры стартуют с осмысленных значений
  assert.equal(sc.amount, 123_456);
  assert.equal(sc.termMonths, 9);
  await server.close();
});
