import type { CacheEntry, CacheStore } from "./cache-store.js";
import { buildCacheKey } from "./cache-key.js";

/**
 * Таймаут источника по умолчанию. Живой заход теперь включает «человеческий»
 * пейсинг навигации (анти-всплеск антибота) + паузы/прокрутку + SPA-рендер грида,
 * поэтому бюджет поднят с ~8с до 15с. Кэш-хитов это не касается — они мгновенны;
 * растёт лишь предел ожидания РЕДКОГО живого мисса/`fresh` до отдачи фолбэка.
 */
export const DEFAULT_TIMEOUT_MS = 15_000;
/** TTL рантайм-мисса: час — чтобы повторные произвольные запросы в рамках демо были мгновенными. */
export const RUNTIME_TTL_MS = 60 * 60_000;

/** Откуда получен результат: кэш-хит, живой источник, либо деградация до фолбэка. */
export type ReadOutcome = "hit" | "miss" | "fallback";

/**
 * Режим чтения. `auto` — режим B по умолчанию (хит → мгновенно, мисс → вживую).
 * `live` — обойти кэш и пойти вживую (доказать, что данные настоящие). `cache` —
 * только кэш, в браузер не ходить (зал без сети / гарантированная скорость демо).
 */
export type ReadMode = "auto" | "live" | "cache";

/**
 * Результат чтения через кэш. `source` позволяет инструменту решить, рисовать ли
 * фолбэк-UI; `data` равно `null` только у фолбэка без закэшированного примера.
 */
export interface ReadResult<T> {
  source: ReadOutcome;
  data: T | null;
  /** Отдан протухший пример (живой источник не успел/упал, но запись была). */
  stale: boolean;
  fetchedAt: string | null;
}

/** Источник не уложился в таймаут — внутренний сигнал к фолбэку. */
export class CacheTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Источник не ответил за ${timeoutMs} мс`);
    this.name = "CacheTimeoutError";
  }
}

export interface CachedReaderOptions {
  timeoutMs?: number;
  runtimeTtlMs?: number;
  /** Режим по умолчанию для всех чтений (per-call можно переопределить). */
  mode?: ReadMode;
  /** Инъекция часов для детерминированных тестов TTL. */
  now?: () => number;
}

/** Опции одного чтения; `mode` переопределяет дефолт ридера на этот вызов. */
export interface ReadOptions {
  mode?: ReadMode;
}

/**
 * Слой чтения режима B: хит → мгновенно; мисс → источник под таймаутом → запись;
 * таймаут/ошибка источника → фолбэк (протухший пример, если он есть, иначе
 * маркер `data:null`). Не зависит от Playwright — источник инъектируется.
 */
export class CachedReader {
  private readonly timeoutMs: number;
  private readonly runtimeTtlMs: number;
  private readonly defaultMode: ReadMode;
  private readonly now: () => number;

  constructor(
    private readonly store: CacheStore,
    opts: CachedReaderOptions = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.runtimeTtlMs = opts.runtimeTtlMs ?? RUNTIME_TTL_MS;
    this.defaultMode = opts.mode ?? "auto";
    this.now = opts.now ?? Date.now;
  }

  async read<T>(
    tool: string,
    args: unknown,
    source: () => Promise<T>,
    opts: ReadOptions = {},
  ): Promise<ReadResult<T>> {
    const mode = opts.mode ?? this.defaultMode;
    const { id, canonical } = buildCacheKey(tool, args);
    const entry = (await this.store.get(id)) as CacheEntry<T> | null;

    // cache: только кэш, в живой источник не ходим (есть запись — отдаём, нет — фолбэк).
    if (mode === "cache") {
      if (entry) {
        return { source: "hit", data: entry.data, stale: this.isExpired(entry), fetchedAt: entry.fetchedAt };
      }
      return { source: "fallback", data: null, stale: false, fetchedAt: null };
    }

    // auto: валидный хит отдаём сразу. live: пропускаем хит и идём вживую принудительно.
    if (mode === "auto" && entry && !this.isExpired(entry)) {
      return { source: "hit", data: entry.data, stale: false, fetchedAt: entry.fetchedAt };
    }

    // live, или мисс/истёкшая запись в auto — идём в живой источник под таймаутом.
    try {
      const data = await this.race(source);
      const fetchedAt = new Date(this.now()).toISOString();
      // Запись кэша не должна валить чтение: ошибка диска проглатывается.
      await this.store
        .set(id, { tool, key: canonical, data, fetchedAt, ttlMs: this.runtimeTtlMs, golden: false })
        .catch(() => {});
      return { source: "miss", data, stale: false, fetchedAt };
    } catch {
      // Таймаут или ошибка источника → фолбэк. Протухший пример лучше пустоты.
      if (entry) return { source: "fallback", data: entry.data, stale: true, fetchedAt: entry.fetchedAt };
      return { source: "fallback", data: null, stale: false, fetchedAt: null };
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    if (entry.golden || entry.ttlMs === null) return false;
    const fetchedAt = Date.parse(entry.fetchedAt);
    // Битая метка времени — считаем запись протухшей, иначе отдавали бы её вечно.
    if (Number.isNaN(fetchedAt)) return true;
    return this.now() - fetchedAt > entry.ttlMs;
  }

  /** Гонка источника с таймером: что бы ни случилось, промис разрешается за `timeoutMs`. */
  private race<T>(source: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new CacheTimeoutError(this.timeoutMs));
      }, this.timeoutMs);
      timer.unref?.();
      source().then(
        (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
