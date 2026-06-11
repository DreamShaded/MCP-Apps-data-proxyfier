import { z } from "zod";

/**
 * Товар выдачи Megamarket — DTO, который инструмент кладёт в `structuredContent`,
 * а UI-приложение рисует карточкой. Поля сознательно «плоские» и опциональные там,
 * где живой сайт может их не отдать (рейтинг/старая цена есть не у всех позиций).
 */
export const productSchema = z.object({
  /** Стабильный идентификатор позиции (для ключей React и будущего `get_product`). */
  id: z.string(),
  title: z.string(),
  /** Текущая цена в рублях (целое число рублей — копейки в выдаче не показываем). */
  price: z.number().nullable(),
  /** Цена до скидки; `null`, если скидки нет. */
  oldPrice: z.number().nullable(),
  /** Процент скидки (целое), если его удалось снять; иначе `null`. */
  discountPercent: z.number().nullable(),
  imageUrl: z.string().nullable(),
  /** Рейтинг 0..5; `null`, если у позиции ещё нет оценок. */
  rating: z.number().nullable(),
  reviewCount: z.number().nullable(),
  /** Абсолютная ссылка на страницу товара (для хэндофа и будущей деталки). */
  url: z.string().nullable(),
});

export type Product = z.infer<typeof productSchema>;

/** Фильтры поиска. Пока только ценовой коридор — расширяемо без слома схемы. */
export const searchFiltersSchema = z.object({
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

/** Выходная схема инструмента — то, что UI читает из `structuredContent`. */
export const searchResultSchema = z.object({
  query: z.string(),
  products: z.array(productSchema),
  /** Откуда выдача: кэш-хит, живой источник или деградация. UI решает по `fallback`. */
  source: z.enum(["hit", "miss", "fallback"]),
  /** Отдан протухший пример (живой источник не успел/упал, но запись была). */
  stale: z.boolean(),
  /** Фолбэк без данных к показу → UI рисует аккуратную заглушку, а не пустоту. */
  fallback: z.boolean(),
  fetchedAt: z.string().nullable(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;
