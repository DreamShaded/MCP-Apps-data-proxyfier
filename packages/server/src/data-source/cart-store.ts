import { getCatalogProduct } from "./static-catalog.js";
import type { Cart, CartItem } from "../megamarket/cart.js";

/**
 * Корзина Megamarket, in-memory. Одна корзина на процесс сервера — та же гранулярность,
 * что раньше была у единственной Playwright-сессии (браузер тоже был один на процесс).
 */
const items = new Map<string, { quantity: number }>();

/** Добавить товар (по id из статического каталога). `added:false`, если id не найден. */
export function add(id: string): { added: boolean } {
  const product = getCatalogProduct(id);
  if (!product) return { added: false };
  const existing = items.get(id);
  items.set(id, { quantity: (existing?.quantity ?? 0) + 1 });
  return { added: true };
}

/** Текущее состояние корзины. */
export function view(): Cart {
  const cartItems: CartItem[] = [];
  for (const [id, { quantity }] of items) {
    const product = getCatalogProduct(id);
    if (!product) continue; // товар мог пропасть из каталога после обновления данных
    const lineTotal = product.price !== null ? product.price * quantity : null;
    cartItems.push({
      id,
      title: product.title,
      price: product.price,
      quantity,
      imageUrl: product.imageUrl,
      url: product.url,
      lineTotal,
    });
  }
  const totalCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = cartItems.some((i) => i.lineTotal === null)
    ? null
    : cartItems.reduce((sum, i) => sum + (i.lineTotal as number), 0);
  return { items: cartItems, totalCount, totalPrice };
}

/** Очистить корзину (после оформления заказа). */
export function clear(): void {
  items.clear();
}
