import { z } from "zod";

/**
 * Позиция in-memory корзины Megamarket — DTO, который инструменты корзины кладут в
 * `structuredContent`, а вью корзины рисует строкой. Собирается из статического каталога
 * (`data-source/static-catalog.ts`), поэтому `price`/`imageUrl` те же, что у товара в выдаче.
 */
export const cartItemSchema = z.object({
  /** Стабильный идентификатор позиции (ключ React + связь с выдачей/деталкой). */
  id: z.string(),
  title: z.string(),
  /** Цена за единицу в рублях; `null`, если у товара нет цены в каталоге. */
  price: z.number().nullable(),
  /** Количество единиц этой позиции в корзине. */
  quantity: z.number(),
  imageUrl: z.string().nullable(),
  url: z.string().nullable(),
  /** Сумма по строке (цена × количество); `null`, если `price` неизвестна. */
  lineTotal: z.number().nullable(),
});

export type CartItem = z.infer<typeof cartItemSchema>;

/**
 * Состояние in-memory корзины Megamarket. `totalCount` — сумма количеств (для бейджа),
 * `totalPrice` — итог корзины в рублях (`null`, если хотя бы одна позиция без цены).
 */
export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  totalCount: z.number(),
  totalPrice: z.number().nullable(),
});

export type Cart = z.infer<typeof cartSchema>;

/** Выходная схема `add_to_cart`. `added:false` — `id` не найден в статическом каталоге. */
export const addToCartResultSchema = z.object({
  cart: cartSchema,
  added: z.boolean(),
});

export type AddToCartResult = z.infer<typeof addToCartResultSchema>;

/** Выходная схема `view_cart`. */
export const viewCartResultSchema = z.object({
  cart: cartSchema,
});

export type ViewCartResult = z.infer<typeof viewCartResultSchema>;

/**
 * Выходная схема `checkout` — статическое подтверждение заказа (без хэндофа в браузер,
 * дизайн-референс — `pages/market/checkout/`). `cart` — снимок корзины на момент оформления
 * (после вызова корзина очищается инструментом); `confirmedAt` — момент подтверждения.
 */
export const checkoutResultSchema = z.object({
  cart: cartSchema,
  confirmedAt: z.string(),
});

export type CheckoutResult = z.infer<typeof checkoutResultSchema>;
