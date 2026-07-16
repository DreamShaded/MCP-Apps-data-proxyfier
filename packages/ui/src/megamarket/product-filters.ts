import type { Product } from "./types";

/**
 * Клиентские фильтры выдачи. Живут целиком в виджете: сервер уже прислал грид, и
 * перещёлкивание бренда не должно стоить нового вызова инструмента и нового пузыря в чате.
 *
 * Доставки здесь сознательно нет — срок задаёт агент через `filters.deliveryBy` на сервере
 * (у модели нет часов, см. `get_delivery_calendar`). Смешивать эти два уровня нельзя:
 * иначе виджет молча покажет то, что агент уже отсёк по сроку.
 */
export interface FilterState {
  /** Выбранный бренд; `null` — все. */
  brand: string | null;
  /** Показывать только товары с активным шумоподавлением. */
  ancOnly: boolean;
}

export const EMPTY_FILTERS: FilterState = { brand: null, ancOnly: false };

export function isEmpty(f: FilterState): boolean {
  return f.brand === null && !f.ancOnly;
}

/** Бренды выдачи в порядке первого появления — порядок чипов не должен скакать. */
export function brandsOf(products: readonly Product[]): string[] {
  const seen: string[] = [];
  for (const p of products) {
    if (p.brand && !seen.includes(p.brand)) seen.push(p.brand);
  }
  return seen;
}

/** Есть ли смысл показывать переключатель шумодава: хоть у одного товара он известен. */
export function hasAncData(products: readonly Product[]): boolean {
  return products.some((p) => p.anc !== null);
}

/**
 * Применить фильтры. `anc: null` («характеристика не указана») под `ancOnly` не проходит:
 * обещать шумодав там, где его нет в данных, нельзя.
 */
export function applyFilters(products: readonly Product[], f: FilterState): Product[] {
  return products.filter((p) => {
    if (f.brand !== null && p.brand !== f.brand) return false;
    if (f.ancOnly && p.anc !== true) return false;
    return true;
  });
}
