import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Запись кэша на диске. Золотые фикстуры коммитятся (`golden:true`, `ttlMs:null`),
 * рантайм-миссы пишутся с конечным TTL (`golden:false`). Один файл на ключ;
 * флаг `golden` внутри решает, истекает ли запись.
 */
export interface CacheEntry<T = unknown> {
  tool: string;
  /** Канонический ключ — для человекочитаемого диффа золотых фикстур. */
  key: string;
  data: T;
  /** Время записи (ISO) — точка отсчёта TTL. */
  fetchedAt: string;
  /** TTL в мс; `null` — не истекает (золотая фикстура). */
  ttlMs: number | null;
  golden: boolean;
}

/**
 * Шов хранилища: инструменты/ридер зависят от интерфейса, в тестах
 * подставляется in-memory реализация — диск не трогается.
 */
export interface CacheStore {
  get(id: string): Promise<CacheEntry | null>;
  set(id: string, entry: CacheEntry): Promise<void>;
}

/**
 * Плоское JSON-хранилище. Золотые фикстуры лежат в подкаталоге `golden/`
 * (коммитится), рантайм-миссы — в корне `cache/data/` (в `.gitignore`). Так
 * `.gitignore` отделяет «коммитим» от «игнорируем» по каталогу, а не по флагу
 * внутри файла. Битая/отсутствующая фикстура → `null`, не падаем.
 */
export class JsonFileCacheStore implements CacheStore {
  private readonly goldenDir: string;

  constructor(
    private readonly runtimeDir: string,
    goldenDir?: string,
  ) {
    this.goldenDir = goldenDir ?? join(runtimeDir, "golden");
  }

  async get(id: string): Promise<CacheEntry | null> {
    // Золотая фикстура приоритетнее рантайм-записи под тем же ключом.
    return (await this.readFrom(this.goldenDir, id)) ?? (await this.readFrom(this.runtimeDir, id));
  }

  async set(id: string, entry: CacheEntry): Promise<void> {
    const path = join(entry.golden ? this.goldenDir : this.runtimeDir, `${id}.json`);
    await mkdir(dirname(path), { recursive: true });
    // Форматируем с отступами: золотые фикстуры коммитятся и должны читаемо диффаться.
    await writeFile(path, JSON.stringify(entry, null, 2) + "\n", "utf-8");
  }

  private async readFrom(dir: string, id: string): Promise<CacheEntry | null> {
    try {
      return JSON.parse(await readFile(join(dir, `${id}.json`), "utf-8")) as CacheEntry;
    } catch {
      // Нет файла или повреждён JSON — для демо это просто мисс, а не ошибка.
      return null;
    }
  }
}
