import { JsonFileCacheStore, type CacheStore } from "./cache-store.js";
import { CachedReader, type CachedReaderOptions, type ReadMode } from "./cached-reader.js";
import { resolveCacheDir } from "./cache-paths.js";

/**
 * Композиционный корень кэш-слоя: боевое JSON-хранилище в `cache/data/` плюс
 * ридер поверх него. Инструменты чтения (`search_products` и т.д., срезы 04+)
 * получают `reader` и оборачивают свой live-вызов Playwright в `reader.read`.
 *
 * Дефолтный режим берётся из `MCP_CACHE_MODE` (auto|live|cache), если явно не задан
 * в `opts` — так зал без сети запирается на кэш одним env, не трогая код.
 */
export function createCache(opts: CachedReaderOptions = {}): {
  store: CacheStore;
  reader: CachedReader;
} {
  const store = new JsonFileCacheStore(resolveCacheDir());
  const mode = opts.mode ?? resolveCacheMode(process.env.MCP_CACHE_MODE);
  return { store, reader: new CachedReader(store, { ...opts, mode }) };
}

/** Разбор env-режима кэша: пусто → auto; мусор → внятная ошибка, а не тихий auto. */
export function resolveCacheMode(value: string | undefined): ReadMode {
  if (!value) return "auto";
  if (value === "auto" || value === "live" || value === "cache") return value;
  throw new Error(`invalid MCP_CACHE_MODE: ${value} (expected "auto", "live" or "cache")`);
}
