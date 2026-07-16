import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDataDir } from "./paths.js";
import { buildDelivery } from "./delivery.js";
import type { Product, ProductDetail, SearchFilters } from "../megamarket/product.js";

/** Лимит видимых позиций выдачи: узкий чат-iframe тянет ровно грид 3×3. */
export const SEARCH_RESULT_LIMIT = 9;

/**
 * Характеристика, из которой поднимается флаг `anc`. Совпадение обязано быть узким:
 * в каталоге есть и «Шумоподавление микрофона» — это про микрофон, а не про ANC, и
 * ловить его сюда нельзя.
 */
// `\w` в JS — только ASCII, кириллицу им не поймать: нужен явный класс [а-яё].
const ANC_SPEC = /активн[а-яё]*\s+шумоподавлени/i;

interface ProductDetailExtra {
  images: string[];
  specs: { name: string; value: string }[];
  description: string | null;
}

/** Товар в том виде, в каком он лежит в `market.json` — без вычисляемых полей. */
type StoredProduct = Omit<Product, "delivery" | "anc">;

interface MarketData {
  products: StoredProduct[];
  details: Record<string, ProductDetailExtra>;
}

/**
 * Статический каталог Megamarket, собранный `pnpm update:data` из снапшотов `pages/`
 * (см. `scripts/update-data.ts`). Читается один раз при импорте модуля — каталог
 * маленький (десятки товаров), перечитывать на каждый вызов незачем.
 */
function loadMarketData(): MarketData {
  const path = join(resolveDataDir(), "market.json");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Error(`${path} не найден — запусти "pnpm update:data" перед стартом сервера`, { cause });
  }
  return JSON.parse(raw) as MarketData;
}

const data = loadMarketData();
const byId = new Map(data.products.map((p) => [p.id, p]));

/**
 * Есть ли активное шумоподавление. `null` — характеристики нет в снапшоте: это
 * «неизвестно», а не «нет», и виджет обязан показать разницу.
 */
function ancOf(id: string): boolean | null {
  const spec = data.details[id]?.specs.find((s) => ANC_SPEC.test(s.name));
  if (!spec) return null;
  return /^да$/i.test(spec.value.trim());
}

/**
 * Достроить товар вычисляемыми полями. Доставка считается на момент вызова (`now`),
 * поэтому «завтра» всегда завтрашнее — в кэше модуля её держать нельзя.
 */
function enrich(stored: StoredProduct, now: Date): Product {
  return { ...stored, anc: ancOf(stored.id), delivery: buildDelivery(stored.id, now) };
}

/**
 * Поиск по подстроке в названии/бренде (регистронезависимо) + ценовой коридор + срок
 * доставки. `now` инжектируется тестами, чтобы «завтра» было предсказуемым.
 *
 * Порядок важен: сначала берём окно выдачи по запросу и цене (top-N), и только потом
 * отсекаем по сроку. То есть срок **сужает показанную выдачу**, а не переспрашивает
 * каталог заново.
 *
 * Почему так, хотя движок поиска обычно делает наоборот (отфильтровать всё → взять top-N):
 * иначе результат перестаёт быть подмножеством того, что человек уже видит на экране —
 * под фильтр всплывают позиции из глубины каталога. Для узкого чат-виджета это
 * необъяснимо: «я отсеял часть» не должно приводить к появлению новых карточек.
 * Плата за это — позиция за пределами top-N не попадёт в выдачу, даже если успевает.
 */
export function searchProducts(query: string, filters: SearchFilters, now: Date = new Date()): Product[] {
  const needle = query.trim().toLowerCase();
  const window: Product[] = [];
  for (const stored of data.products) {
    const haystack = `${stored.title} ${stored.brand ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) continue;
    if (filters.priceMin !== undefined && stored.price !== null && stored.price < filters.priceMin) continue;
    if (filters.priceMax !== undefined && stored.price !== null && stored.price > filters.priceMax) continue;

    window.push(enrich(stored, now));
    if (window.length >= SEARCH_RESULT_LIMIT) break;
  }

  if (filters.deliveryBy === undefined) return window;
  // ISO-даты сравнимы лексикографически — отдельный парсинг не нужен.
  return window.filter((p) => p.delivery.date <= filters.deliveryBy!);
}

/** Товар из каталога по id (без деталей) — используется корзиной. */
export function getCatalogProduct(id: string, now: Date = new Date()): Product | null {
  const stored = byId.get(id);
  return stored ? enrich(stored, now) : null;
}

/**
 * Детальная карточка. Если для `id` не снята богатая деталь (галерея/характеристики —
 * есть не у всех снапшотов), деградирует до каталожной карточки с одной фотографией и
 * пустыми характеристиками, а не падает и не возвращает `null`.
 */
export function getProduct(id: string, now: Date = new Date()): ProductDetail | null {
  const stored = byId.get(id);
  if (!stored) return null;
  const product = enrich(stored, now);
  const extra = data.details[id];
  if (extra) return { ...product, ...extra };
  return { ...product, images: product.imageUrl ? [product.imageUrl] : [], specs: [], description: null };
}
