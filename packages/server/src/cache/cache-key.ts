import { createHash } from "node:crypto";

/**
 * Нормализованный ключ кэша: логический канонический вид + идентификатор файла.
 * Один и тот же запрос обязан давать один ключ независимо от порядка полей и
 * регистра строк — иначе золотой сценарий не «попадёт» в свою фикстуру.
 */
export interface CacheKey {
  /** Канонический логический ключ (стабильный JSON) — хранится в записи для отладки. */
  canonical: string;
  /** Имя файла без расширения: `<инструмент>-<хэш16>` — читаемый префикс + стабильный хэш. */
  id: string;
}

/**
 * Построить ключ из имени инструмента и его аргументов.
 *
 * ВНИМАНИЕ для инструментов чтения: строковые значения сворачиваются по регистру
 * и пробелам (требование стабильности ключа для свободного поиска). Значит ключ
 * НЕ различает регистрозависимые идентификаторы — `{id:"AbC"}` и `{id:"abc"}`
 * дадут один ключ. Не прокидывайте регистрозначимые ID как сырые строки через
 * кэш-шов (актуально для `get_product`).
 */
export function buildCacheKey(tool: string, args: unknown): CacheKey {
  const normTool = tool.trim().toLowerCase();
  const canonical = JSON.stringify([normTool, normalize(args)]);
  const hash = createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  return { canonical, id: `${slug(normTool)}-${hash}` };
}

/**
 * Рекурсивная нормализация: ключи объектов сортируются (независимость от
 * порядка), строки тримятся и приводятся к нижнему регистру (независимость от
 * регистра/пробелов), `undefined`-поля выбрасываются. Массивы упорядочены по
 * смыслу — порядок сохраняем.
 */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        if (obj[k] !== undefined) acc[k] = normalize(obj[k]);
        return acc;
      }, {});
  }
  if (typeof value === "string") return value.trim().toLowerCase();
  return value;
}

/** Безопасный для файловой системы префикс имени из имени инструмента. */
function slug(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40) || "tool";
}
