import type { Page } from "playwright";
import type { Product, SearchFilters } from "./product.js";

/** Лимит видимых позиций: узкий чат-iframe не тянет тяжёлый грид. */
export const SEARCH_RESULT_LIMIT = 12;

/** База для достройки относительных ссылок/картинок до абсолютных. */
const MEGAMARKET_ORIGIN = "https://megamarket.ru";

/**
 * Сырой товар, как он снят со страницы (всё — строки/`null`). Парсинг и фильтрация
 * вынесены в чистую `normalizeProducts`, чтобы тестировать без браузера.
 */
export interface RawProduct {
  id?: string | null;
  title?: string | null;
  priceText?: string | null;
  oldPriceText?: string | null;
  discountText?: string | null;
  imageUrl?: string | null;
  ratingText?: string | null;
  reviewText?: string | null;
  url?: string | null;
}

/**
 * Живой скрейп выдачи Megamarket под залогиненной сессией. Селекторы тюнятся по
 * живому сайту (как `session-detectors`) — опасная ошибка здесь тихая (пустой грид),
 * поэтому деградацию ловит кэш-слой: бросок отсюда → `source:'fallback'`.
 *
 * `page.goto` ограничен собственным таймаутом ниже общего (~8с кэш-слоя), чтобы
 * зависший переход не держал мьютекс единственной страницы.
 */
export async function scrapeSearch(
  page: Page,
  query: string,
  filters: SearchFilters = {},
): Promise<Product[]> {
  const url = `${MEGAMARKET_ORIGIN}/catalog/?q=${encodeURIComponent(query)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 7_000 });

  // Карточка товара. Селектор HITL-настраивается на живом сайте.
  const CARD = '[data-test="catalog-item"]';
  await page.waitForSelector(CARD, { timeout: 5_000 }).catch(() => {});

  const raw = await page.$$eval(CARD, (cards) => {
    // Внутри браузера; структурные типы вместо DOM-lib (её нет в tsconfig сервера).
    const text = (el: { textContent: string | null } | null) => el?.textContent?.trim() ?? null;
    const attr = (el: { getAttribute(n: string): string | null } | null, name: string) =>
      el?.getAttribute(name) ?? null;
    return cards.map((card): Record<string, string | null> => {
      const link = card.querySelector("a[href]");
      const img = card.querySelector("img");
      return {
        id: attr(card, "data-item-id") ?? attr(link, "href"),
        title: text(card.querySelector('[data-test="product-title"], [itemprop="name"]')),
        priceText: text(card.querySelector('[data-test="product-price"], [itemprop="price"]')),
        oldPriceText: text(card.querySelector('[data-test="product-old-price"]')),
        discountText: text(card.querySelector('[data-test="product-discount"]')),
        imageUrl: attr(img, "src") ?? attr(img, "data-src"),
        ratingText: text(card.querySelector('[data-test="rating"], [data-test="product-rating"]')),
        reviewText: text(card.querySelector('[data-test="reviews-count"], [data-test="product-rating-reviews"]')),
        url: attr(link, "href"),
      };
    });
  });

  return normalizeProducts(raw, filters);
}

/**
 * Чистое преобразование сырых карточек в `Product[]`: парсинг чисел, расчёт скидки,
 * фильтр по ценовому коридору, достройка ссылок и обрезка до лимита. Тестируется без
 * браузера — это и есть проверяемая граница скрейпа.
 */
export function normalizeProducts(
  raw: RawProduct[],
  filters: SearchFilters = {},
  limit: number = SEARCH_RESULT_LIMIT,
): Product[] {
  const products: Product[] = [];
  for (const r of raw) {
    const title = clean(r.title);
    if (!title) continue; // карточка без названия — мусор/скелетон, пропускаем

    const price = parseRubles(r.priceText);
    if (filters.priceMin !== undefined && price !== null && price < filters.priceMin) continue;
    if (filters.priceMax !== undefined && price !== null && price > filters.priceMax) continue;

    const oldPrice = parseRubles(r.oldPriceText);
    products.push({
      // Позиция в выдаче добавляется к синтезированному id, чтобы две карточки без
      // настоящего id и с одинаковым названием не дали одинаковый ключ в UI.
      id: clean(r.id) ?? `${title}#${products.length}`,
      title,
      price,
      oldPrice,
      discountPercent: parsePercent(r.discountText) ?? computeDiscount(price, oldPrice),
      imageUrl: absolute(clean(r.imageUrl)),
      rating: parseRating(r.ratingText),
      reviewCount: parseCount(r.reviewText),
      url: absolute(clean(r.url)),
    });
    if (products.length >= limit) break;
  }
  return products;
}

function clean(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}

/** «1 299 ₽», «от 4990» → 1299 / 4990. Возвращает целые рубли или `null`. */
function parseRubles(text: string | null | undefined): number | null {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/** «4,7» / «4.7» → 4.7; ограничиваем диапазоном 0..5. */
function parseRating(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(",", ".").match(/\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return n >= 0 && n <= 5 ? n : null;
}

function parseCount(text: string | null | undefined): number | null {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function parsePercent(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Скидка из пары цен, если её не отдали явным бейджем. */
function computeDiscount(price: number | null, oldPrice: number | null): number | null {
  if (price === null || oldPrice === null || oldPrice <= price) return null;
  return Math.round((1 - price / oldPrice) * 100);
}

/** Достроить относительный путь до абсолютного URL Megamarket. */
function absolute(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${MEGAMARKET_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}
