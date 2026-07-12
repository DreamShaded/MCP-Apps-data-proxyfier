import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDataDir } from "./paths.js";
import type { Product, ProductDetail, SearchFilters } from "../megamarket/product.js";

/** Лимит видимых позиций выдачи: узкий чат-iframe не тянет тяжёлый грид. */
export const SEARCH_RESULT_LIMIT = 12;

interface ProductDetailExtra {
  images: string[];
  specs: { name: string; value: string }[];
  description: string | null;
}

interface MarketData {
  products: Product[];
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

/** Поиск по подстроке в названии/бренде (регистронезависимо) + ценовой коридор, лимит 12. */
export function searchProducts(query: string, filters: SearchFilters): Product[] {
  const needle = query.trim().toLowerCase();
  const results: Product[] = [];
  for (const product of data.products) {
    const haystack = `${product.title} ${product.brand ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) continue;
    if (filters.priceMin !== undefined && product.price !== null && product.price < filters.priceMin) continue;
    if (filters.priceMax !== undefined && product.price !== null && product.price > filters.priceMax) continue;
    results.push(product);
    if (results.length >= SEARCH_RESULT_LIMIT) break;
  }
  return results;
}

/** Товар из каталога по id (без деталей) — используется корзиной. */
export function getCatalogProduct(id: string): Product | null {
  return byId.get(id) ?? null;
}

/**
 * Детальная карточка. Если для `id` не снята богатая деталь (галерея/характеристики —
 * есть не у всех снапшотов), деградирует до каталожной карточки с одной фотографией и
 * пустыми характеристиками, а не падает и не возвращает `null`.
 */
export function getProduct(id: string): ProductDetail | null {
  const product = byId.get(id);
  if (!product) return null;
  const extra = data.details[id];
  if (extra) return { ...product, ...extra };
  return { ...product, images: product.imageUrl ? [product.imageUrl] : [], specs: [], description: null };
}
