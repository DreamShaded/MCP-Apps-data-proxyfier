/**
 * DTO выдачи Megamarket на стороне UI. Зеркалит выходную схему инструмента
 * `search_products` (см. `packages/server/src/megamarket/product.ts`). Дублируется
 * сознательно: это граница postMessage-моста между хостом и iframe, общий тип-пакет
 * ради одного DTO — оверкилл (YAGNI).
 */
export interface Product {
  id: string;
  title: string;
  price: number | null;
  oldPrice: number | null;
  discountPercent: number | null;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  url: string | null;
}

export interface SearchResult {
  query: string;
  products: Product[];
  source: "hit" | "miss" | "fallback";
  stale: boolean;
  /** Фолбэк без данных к показу → рисуем заглушку, а не пустой грид. */
  fallback: boolean;
  fetchedAt: string | null;
}
