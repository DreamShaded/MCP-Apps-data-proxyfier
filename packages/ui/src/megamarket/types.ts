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

/** Характеристика деталки: пара «название — значение». Зеркалит `productSpecSchema`. */
export interface ProductSpec {
  name: string;
  value: string;
}

/** Детальная карточка товара. Зеркалит `productDetailSchema` (граница postMessage-моста). */
export interface ProductDetail extends Product {
  images: string[];
  specs: ProductSpec[];
  description: string | null;
}

/** Результат `get_product`. Зеркалит `getProductResultSchema`. */
export interface GetProductResult {
  product: ProductDetail | null;
  source: "hit" | "miss" | "fallback";
  stale: boolean;
  fallback: boolean;
  fetchedAt: string | null;
}

/** Позиция реальной корзины. Зеркалит `cartItemSchema` (граница postMessage-моста). */
export interface CartItem {
  id: string;
  title: string;
  price: number | null;
  quantity: number;
  imageUrl: string | null;
  url: string | null;
  lineTotal: number | null;
}

/** Состояние реальной корзины Megamarket. Зеркалит `cartSchema`. */
export interface Cart {
  items: CartItem[];
  totalCount: number;
  totalPrice: number | null;
}

/** Результат `add_to_cart`. Зеркалит `addToCartResultSchema`. */
export interface AddToCartResult {
  cart: Cart | null;
  added: boolean;
  fallback: boolean;
  fetchedAt: string | null;
}

/** Результат `view_cart`. Зеркалит `viewCartResultSchema`. */
export interface ViewCartResult {
  cart: Cart | null;
  fallback: boolean;
  fetchedAt: string | null;
}

/** Результат `checkout` (хэндоф «открыть в браузере»). Зеркалит `checkoutResultSchema`. */
export interface CheckoutResult {
  /** Ссылка на реальную корзину/оформление Megamarket — отдаётся всегда, даже на сбое. */
  url: string;
  cart: Cart | null;
  fallback: boolean;
  fetchedAt: string | null;
}
