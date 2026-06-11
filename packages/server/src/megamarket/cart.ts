import { z } from "zod";

/**
 * Позиция реальной корзины Megamarket — DTO, который инструменты корзины кладут в
 * `structuredContent`, а вью корзины рисует строкой. Поля «плоские» и опциональные там,
 * где живая корзина может их не отдать (цена/картинка у части позиций бывают пустыми).
 */
export const cartItemSchema = z.object({
  /** Стабильный идентификатор позиции (ключ React + связь с выдачей/деталкой). */
  id: z.string(),
  title: z.string(),
  /** Цена за единицу в рублях; `null`, если со строки её не сняли. */
  price: z.number().nullable(),
  /** Количество единиц этой позиции в корзине. */
  quantity: z.number(),
  imageUrl: z.string().nullable(),
  url: z.string().nullable(),
  /** Сумма по строке (цена × количество), как её показывает сайт; `null`, если не снято. */
  lineTotal: z.number().nullable(),
});

export type CartItem = z.infer<typeof cartItemSchema>;

/**
 * Состояние реальной корзины Megamarket. `totalCount` — сумма количеств (для бейджа),
 * `totalPrice` — итог корзины в рублях (`null`, если итог со страницы не сняли).
 */
export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  totalCount: z.number(),
  totalPrice: z.number().nullable(),
});

export type Cart = z.infer<typeof cartSchema>;

/**
 * Выходная схема `add_to_cart`. Корзина = реальный сайт: на успехе возвращаем актуальное
 * состояние после клика (UI обновляет бейдж без отдельного `view_cart`); на сбое живого
 * клика — `fallback:true`, `cart:null`, чтобы вью показала аккуратную ошибку, а не зависла.
 */
export const addToCartResultSchema = z.object({
  cart: cartSchema.nullable(),
  /** Клик «в корзину» состоялся (товар добавлен в реальную корзину). */
  added: z.boolean(),
  fallback: z.boolean(),
  fetchedAt: z.string().nullable(),
});

export type AddToCartResult = z.infer<typeof addToCartResultSchema>;

/** Выходная схема `view_cart`. Зеркалит обёртку добавления без флага `added`. */
export const viewCartResultSchema = z.object({
  cart: cartSchema.nullable(),
  fallback: z.boolean(),
  fetchedAt: z.string().nullable(),
});

export type ViewCartResult = z.infer<typeof viewCartResultSchema>;

/**
 * Выходная схема `checkout` — данные хэндофа «открыть в браузере». `url` — ссылка на
 * реальную корзину/оформление Megamarket; она константна, поэтому возвращается даже на
 * сбое (живое окно всё равно можно открыть руками). `cart` — снимок для сводки на экране
 * хэндофа (подтверждает, что корзина заполнена); на сбое чтения — `fallback:true`, `cart:null`.
 * Платёжную страницу/3DS в iframe сознательно не встраиваем — оплата завершается в окне.
 */
export const checkoutResultSchema = z.object({
  url: z.string(),
  cart: cartSchema.nullable(),
  fallback: z.boolean(),
  fetchedAt: z.string().nullable(),
});

export type CheckoutResult = z.infer<typeof checkoutResultSchema>;
