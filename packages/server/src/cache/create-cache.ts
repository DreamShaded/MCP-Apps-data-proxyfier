import { JsonFileCacheStore, type CacheStore } from "./cache-store.js";
import { CachedReader, type CachedReaderOptions } from "./cached-reader.js";
import { resolveCacheDir } from "./cache-paths.js";

/**
 * Композиционный корень кэш-слоя: боевое JSON-хранилище в `cache/data/` плюс
 * ридер поверх него. Инструменты чтения (`search_products` и т.д., срезы 04+)
 * получают `reader` и оборачивают свой live-вызов Playwright в `reader.read`.
 */
export function createCache(opts: CachedReaderOptions = {}): {
  store: CacheStore;
  reader: CachedReader;
} {
  const store = new JsonFileCacheStore(resolveCacheDir());
  return { store, reader: new CachedReader(store, opts) };
}
