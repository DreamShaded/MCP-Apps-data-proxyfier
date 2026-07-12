import { z } from "zod";

/**
 * Товар выдачи Megamarket — DTO, который инструмент кладёт в `structuredContent`,
 * а UI-приложение рисует карточкой. Поля сознательно «плоские» и опциональные там,
 * где живой сайт может их не отдать (рейтинг/старая цена есть не у всех позиций).
 */
export const productSchema = z.object({
  /** Стабильный идентификатор позиции (для ключей React и `get_product`). */
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
  /** Абсолютная ссылка на страницу товара (справочно — переход по ней вживую не идёт). */
  url: z.string().nullable(),
  /** Бренд товара — участвует в поиске по статическому каталогу вместе с названием. */
  brand: z.string().nullable(),
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
});

export type SearchResult = z.infer<typeof searchResultSchema>;

/** Характеристика товара на деталке: пара «название — значение» (вес, цвет, гарантия…). */
export const productSpecSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export type ProductSpec = z.infer<typeof productSpecSchema>;

/**
 * Детальная карточка товара — то, что отдаёт `get_product` и рисует вью деталки.
 * Расширяет «плоский» товар выдачи галереей, описанием и характеристиками; всё, чего
 * может не быть на живой странице, — опционально/пустой массив, а не обязательное поле.
 */
export const productDetailSchema = productSchema.extend({
  /** Галерея: первый кадр — главный. Пусто, если со страницы не сняли ни одного фото. */
  images: z.array(z.string()),
  /** Характеристики таблицей; пустой массив, если блок не распознан. */
  specs: z.array(productSpecSchema),
  /** Текстовое описание товара; `null`, если его нет/не сняли. */
  description: z.string().nullable(),
});

export type ProductDetail = z.infer<typeof productDetailSchema>;

/** Выходная схема `get_product`. */
export const getProductResultSchema = z.object({
  /** Деталь товара; `null`, если `id` не найден в статическом каталоге. */
  product: productDetailSchema.nullable(),
});

export type GetProductResult = z.infer<typeof getProductResultSchema>;
