import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonFileCacheStore, type CacheEntry } from "./cache-store.js";

async function withTempStore(fn: (store: JsonFileCacheStore, dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "cache-store-"));
  try {
    await fn(new JsonFileCacheStore(dir), dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const entry = (data: unknown): CacheEntry => ({
  tool: "t",
  key: "k",
  data,
  fetchedAt: "2026-01-01T00:00:00.000Z",
  ttlMs: 1000,
  golden: false,
});

test("запись и чтение по id — круговой обход", async () => {
  await withTempStore(async (store) => {
    await store.set("search_products-abc", entry({ items: [1, 2, 3] }));
    const got = await store.get("search_products-abc");
    assert.deepEqual(got?.data, { items: [1, 2, 3] });
    assert.equal(got?.golden, false);
  });
});

test("отсутствующий файл → null", async () => {
  await withTempStore(async (store) => {
    assert.equal(await store.get("missing-xyz"), null);
  });
});

test("повреждённый JSON → null, без падения", async () => {
  await withTempStore(async (store, dir) => {
    await writeFile(join(dir, "broken-1.json"), "{ это не json ", "utf-8");
    assert.equal(await store.get("broken-1"), null);
  });
});

test("повторная запись по тому же id перезаписывает без дублей", async () => {
  await withTempStore(async (store) => {
    await store.set("k-1", entry("first"));
    await store.set("k-1", entry("second"));
    const got = await store.get("k-1");
    assert.equal(got?.data, "second");
  });
});

const golden = (data: unknown): CacheEntry => ({
  tool: "t",
  key: "k",
  data,
  fetchedAt: "2026-01-01T00:00:00.000Z",
  ttlMs: null,
  golden: true,
});

test("золотая запись пишется в подкаталог golden/ и читается оттуда", async () => {
  await withTempStore(async (store, dir) => {
    await store.set("g-1", golden("fixed"));
    const onDisk = await readFile(join(dir, "golden", "g-1.json"), "utf-8");
    assert.match(onDisk, /"golden": true/);
    assert.equal((await store.get("g-1"))?.data, "fixed");
  });
});

test("золотая фикстура приоритетнее рантайм-записи под тем же id", async () => {
  await withTempStore(async (store) => {
    await store.set("dup", entry("runtime"));
    await store.set("dup", golden("golden"));
    assert.equal((await store.get("dup"))?.data, "golden");
  });
});
