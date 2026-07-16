/**
 * DTO выдачи Megamarket на стороне UI. Зеркалит выходную схему инструмента
 * `search_products` (см. `packages/server/src/megamarket/product.ts`). Дублируется
 * сознательно: это граница postMessage-моста между хостом и iframe, общий тип-пакет
 * ради одного DTO — оверкилл (YAGNI).
 */
/** Срок доставки. Зеркалит `deliverySchema`; дату сервер считает на момент вызова. */
export interface Delivery {
  /** Через сколько дней приедет: 1 — завтра. */
  days: number;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Подпись как на сайте: «Завтра», «Послезавтра», «18 июля». */
  label: string;
}

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
  brand: string | null;
  /** Активное шумоподавление; `null` — характеристики нет в снапшоте («неизвестно»). */
  anc: boolean | null;
  delivery: Delivery;
}

export interface SearchResult {
  query: string;
  products: Product[];
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
  /** `null`, если `id` не найден в статическом каталоге. */
  product: ProductDetail | null;
}

/** Позиция корзины (in-memory). Зеркалит `cartItemSchema` (граница postMessage-моста). */
export interface CartItem {
  id: string;
  title: string;
  price: number | null;
  quantity: number;
  imageUrl: string | null;
  url: string | null;
  lineTotal: number | null;
}

/** Состояние корзины Megamarket. Зеркалит `cartSchema`. */
export interface Cart {
  items: CartItem[];
  totalCount: number;
  totalPrice: number | null;
}

/** Результат `add_to_cart`. Зеркалит `addToCartResultSchema`. `added:false` — id не найден. */
export interface AddToCartResult {
  cart: Cart;
  added: boolean;
}

/** Результат `view_cart`. Зеркалит `viewCartResultSchema`. */
export interface ViewCartResult {
  cart: Cart;
}

/** Результат `checkout` — статическое подтверждение заказа. Зеркалит `checkoutResultSchema`. */
export interface CheckoutResult {
  /** Снимок корзины на момент оформления (после вызова корзина очищена). */
  cart: Cart;
  confirmedAt: string;
}
