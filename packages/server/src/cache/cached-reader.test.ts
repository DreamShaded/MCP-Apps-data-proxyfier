import { test } from "node:test";
import assert from "node:assert/strict";
import { CachedReader } from "./cached-reader.js";
import type { CacheEntry, CacheStore } from "./cache-store.js";

/** In-memory хранилище: тестируем шов ридера, диск не трогаем. */
class MemStore implements CacheStore {
  readonly map = new Map<string, CacheEntry>();
  setCalls = 0;
  async get(id: string): Promise<CacheEntry | null> {
    return this.map.get(id) ?? null;
  }
  async set(id: string, entry: CacheEntry): Promise<void> {
    this.setCalls += 1;
    this.map.set(id, entry);
  }
}

const NEVER = () => new Promise<never>(() => {});

test("хит: запись свежая → возврат без обращения к источнику", async () => {
  const store = new MemStore();
  const reader = new CachedReader(store, { now: () => 10_000 });
  // Прогреваем тем же ключом через мисс.
  await reader.read("t", { q: "a" }, async () => "live");
  store.setCalls = 0;

  let called = false;
  const r = await reader.read("t", { q: "a" }, async () => {
    called = true;
    return "should-not-run";
  });

  assert.equal(r.source, "hit");
  assert.equal(r.data, "live");
  assert.equal(called, false, "источник не должен вызываться при хите");
  assert.equal(store.setCalls, 0, "хит ничего не пишет");
});

test("мисс: источник вызывается, результат пишется и возвращается", async () => {
  const store = new MemStore();
  const fixedNow = 1_700_000_000_000;
  const reader = new CachedReader(store, { now: () => fixedNow });

  const r = await reader.read("t", { q: "b" }, async () => ({ items: [1, 2] }));

  assert.equal(r.source, "miss");
  assert.deepEqual(r.data, { items: [1, 2] });
  assert.equal(r.stale, false);
  assert.equal(r.fetchedAt, new Date(fixedNow).toISOString());
  assert.equal(store.setCalls, 1, "мисс пишет запись");
});

test("таймаут источника при наличии протухшей записи → фолбэк отдаёт протухший пример", async () => {
  const store = new MemStore();
  let now = 100_000;
  const reader = new CachedReader(store, { timeoutMs: 20, now: () => now });
  // Прогрев → запись с ttl 60мин (по умолчанию).
  await reader.read("t", { q: "c" }, async () => "old");
  // Перематываем часы за TTL, чтобы запись истекла.
  now += 2 * 60 * 60_000;
  store.setCalls = 0;

  const r = await reader.read("t", { q: "c" }, NEVER);

  assert.equal(r.source, "fallback");
  assert.equal(r.data, "old", "фолбэк отдаёт протухший пример");
  assert.equal(r.stale, true);
  assert.equal(store.setCalls, 0, "фолбэк ничего не пишет");
});

test("таймаут источника без записи → фолбэк-маркер data:null", async () => {
  const store = new MemStore();
  const reader = new CachedReader(store, { timeoutMs: 20 });

  const r = await reader.read("t", { q: "d" }, NEVER);

  assert.equal(r.source, "fallback");
  assert.equal(r.data, null);
  assert.equal(r.stale, false);
  assert.equal(r.fetchedAt, null);
});

test("ошибка источника без записи → фолбэк-маркер", async () => {
  const store = new MemStore();
  const reader = new CachedReader(store, { timeoutMs: 1000 });

  const r = await reader.read("t", { q: "e" }, async () => {
    throw new Error("antibot");
  });

  assert.equal(r.source, "fallback");
  assert.equal(r.data, null);
});

test("истечение TTL → повторный поход в источник (свежий мисс)", async () => {
  const store = new MemStore();
  let now = 0;
  const reader = new CachedReader(store, { runtimeTtlMs: 1000, now: () => now });

  const first = await reader.read("t", { q: "f" }, async () => "v1");
  assert.equal(first.source, "miss");

  now = 500; // в пределах TTL → хит
  const within = await reader.read("t", { q: "f" }, async () => "v2");
  assert.equal(within.source, "hit");
  assert.equal(within.data, "v1");

  now = 2000; // за TTL → снова источник
  const after = await reader.read("t", { q: "f" }, async () => "v3");
  assert.equal(after.source, "miss");
  assert.equal(after.data, "v3");
});

test("битая метка времени в рантайм-записи → считается протухшей, идём в источник", async () => {
  const store = new MemStore();
  const reader = new CachedReader(store);
  const { buildCacheKey } = await import("./cache-key.js");
  store.map.set(buildCacheKey("t", { q: "h" }).id, {
    tool: "t",
    key: "k",
    data: "corrupt",
    fetchedAt: "не-дата",
    ttlMs: 1000,
    golden: false,
  });

  const r = await reader.read("t", { q: "h" }, async () => "fresh");

  assert.equal(r.source, "miss");
  assert.equal(r.data, "fresh");
});

test("режим live: валидный хит игнорируется, идём вживую и перезаписываем", async () => {
  const store = new MemStore();
  const reader = new CachedReader(store, { now: () => 10_000 });
  await reader.read("t", { q: "live" }, async () => "cached");
  store.setCalls = 0;

  let called = false;
  const r = await reader.read(
    "t",
    { q: "live" },
    async () => {
      called = true;
      return "fresh";
    },
    { mode: "live" },
  );

  assert.equal(r.source, "miss", "live всегда даёт живой результат, не хит");
  assert.equal(r.data, "fresh");
  assert.equal(called, true, "источник обязан вызываться в режиме live");
  assert.equal(store.setCalls, 1, "живой результат перезаписывает кэш");
});

test("per-call режим переопределяет дефолт ридера (cache-ридер, live-вызов)", async () => {
  const store = new MemStore();
  const reader = new CachedReader(store, { mode: "cache" });

  const r = await reader.read("t", { q: "ov" }, async () => "live", { mode: "live" });

  assert.equal(r.source, "miss");
  assert.equal(r.data, "live");
});

test("режим cache: при наличии записи источник не зовётся", async () => {
  const store = new MemStore();
  const reader = new CachedReader(store, { now: () => 10_000 });
  await reader.read("t", { q: "c1" }, async () => "seeded");
  store.setCalls = 0;

  let called = false;
  const r = await reader.read(
    "t",
    { q: "c1" },
    async () => {
      called = true;
      return "should-not-run";
    },
    { mode: "cache" },
  );

  assert.equal(r.source, "hit");
  assert.equal(r.data, "seeded");
  assert.equal(called, false, "cache-режим не ходит в источник");
  assert.equal(store.setCalls, 0);
});

test("режим cache: записи нет → фолбэк-маркер, источник не зовётся", async () => {
  const store = new MemStore();
  const reader = new CachedReader(store);

  let called = false;
  const r = await reader.read(
    "t",
    { q: "c2" },
    async () => {
      called = true;
      return "x";
    },
    { mode: "cache" },
  );

  assert.equal(r.source, "fallback");
  assert.equal(r.data, null);
  assert.equal(called, false, "cache-режим не ходит в источник даже на миссе");
});

test("дефолтный режим ридера применяется без per-call (cache → фолбэк на миссе)", async () => {
  const store = new MemStore();
  const reader = new CachedReader(store, { mode: "cache" });

  const r = await reader.read("t", { q: "c3" }, async () => "live");

  assert.equal(r.source, "fallback", "дефолт cache не должен ходить вживую");
  assert.equal(r.data, null);
});

test("золотая фикстура (ttlMs:null) не истекает и не зовёт источник", async () => {
  const store = new MemStore();
  const reader = new CachedReader(store, { now: () => 9_999_999_999_999 });
  const golden: CacheEntry = {
    tool: "t",
    key: "k",
    data: "golden",
    fetchedAt: new Date(0).toISOString(),
    ttlMs: null,
    golden: true,
  };
  // Кладём фикстуру под тем же ключом, что построит ридер.
  const { buildCacheKey } = await import("./cache-key.js");
  store.map.set(buildCacheKey("t", { q: "g" }).id, golden);

  const r = await reader.read("t", { q: "g" }, async () => {
    throw new Error("источник не должен вызываться");
  });

  assert.equal(r.source, "hit");
  assert.equal(r.data, "golden");
});
