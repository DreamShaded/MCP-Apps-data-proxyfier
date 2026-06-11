import type { Page } from "playwright";
import type { ProductDetail, ProductSpec } from "./product.js";

/** Сколько кадров галереи показываем максимум — узкий чат-iframe не тянет десятки превью. */
export const GALLERY_LIMIT = 6;
/** Сколько строк характеристик показываем максимум — деталка под чат остаётся компактной. */
export const SPECS_LIMIT = 12;

/** База для достройки относительных ссылок/картинок до абсолютных. */
const MEGAMARKET_ORIGIN = "https://megamarket.ru";

/**
 * Сырая деталь, как она снята со страницы (всё — строки/`null`/массивы строк). Парсинг
 * и обрезка вынесены в чистую `normalizeProductDetail`, чтобы тестировать без браузера.
 */
export interface RawProductDetail {
  id?: string | null;
  title?: string | null;
  priceText?: string | null;
  oldPriceText?: string | null;
  discountText?: string | null;
  ratingText?: string | null;
  reviewText?: string | null;
  description?: string | null;
  url?: string | null;
  images?: (string | null)[];
  specs?: { name?: string | null; value?: string | null }[];
}

/**
 * Живой скрейп страницы товара Megamarket под залогиненной сессией. Селекторы тюнятся
 * по живому сайту (как в `scrape-search`); опасная ошибка здесь тихая (пустая деталка),
 * поэтому деградацию ловит кэш-слой: бросок отсюда → `source:'fallback'`.
 *
 * `id` — стабильный идентификатор позиции из выдачи; `url` — абсолютная ссылка карточки,
 * если она известна (выдача её знает). Ссылку строим из `url`, иначе из `id` (для id-пути).
 * `page.goto` ограничен собственным таймаутом ниже общего (~8с кэш-слоя), чтобы зависший
 * переход не держал мьютекс единственной страницы.
 */
export async function scrapeProduct(
  page: Page,
  id: string,
  url?: string | null,
): Promise<ProductDetail> {
  await page.goto(productUrl(id, url), { waitUntil: "domcontentloaded", timeout: 7_000 });

  const TITLE = '[data-test="product-title"], h1[itemprop="name"], h1';
  await page.waitForSelector(TITLE, { timeout: 5_000 }).catch(() => {});

  const raw = await page.$$eval(TITLE, (titles): Record<string, unknown> => {
    // Внутри браузера; структурные типы вместо DOM-lib (её нет в tsconfig сервера).
    const root = (titles[0]?.ownerDocument as { querySelector(s: string): unknown } | undefined) ?? null;
    const q = (sel: string) =>
      (root?.querySelector(sel) as { textContent: string | null } | null) ?? null;
    const text = (el: { textContent: string | null } | null) => el?.textContent?.trim() ?? null;
    const all = (sel: string) =>
      Array.from(
        (root as unknown as { querySelectorAll(s: string): ArrayLike<unknown> } | null)?.querySelectorAll(sel) ?? [],
      );

    const images = all('[data-test="product-gallery"] img, [itemprop="image"], .gallery img')
      .map((el) => {
        const img = el as { getAttribute(n: string): string | null };
        return img.getAttribute("src") ?? img.getAttribute("data-src");
      })
      .filter((s): s is string => Boolean(s));

    const specs = all('[data-test="product-characteristics"] tr, .characteristics__row').map((row) => {
      const r = row as { querySelector(s: string): { textContent: string | null } | null };
      const name = r.querySelector("th, .characteristics__name, dt")?.textContent?.trim() ?? null;
      const value = r.querySelector("td, .characteristics__value, dd")?.textContent?.trim() ?? null;
      return { name, value };
    });

    return {
      title: text(titles[0] as { textContent: string | null }),
      priceText: text(q('[data-test="product-price"], [itemprop="price"]')),
      oldPriceText: text(q('[data-test="product-old-price"]')),
      discountText: text(q('[data-test="product-discount"]')),
      ratingText: text(q('[data-test="rating"], [data-test="product-rating"]')),
      reviewText: text(q('[data-test="reviews-count"], [data-test="product-rating-reviews"]')),
      description: text(q('[data-test="product-description"], [itemprop="description"]')),
      images,
      specs,
    };
  });

  return normalizeProductDetail({ ...raw, id, url: url ?? null });
}

/**
 * Чистое преобразование сырой детали в `ProductDetail`: парсинг чисел, расчёт скидки,
 * достройка ссылок, отбор валидных характеристик и обрезка галереи/таблицы под лимиты.
 * Тестируется без браузера — это и есть проверяемая граница скрейпа деталки.
 */
export function normalizeProductDetail(raw: RawProductDetail): ProductDetail {
  const price = parseRubles(raw.priceText);
  const oldPrice = parseRubles(raw.oldPriceText);
  const images = (raw.images ?? [])
    .map((src) => absolute(clean(src)))
    .filter((s): s is string => Boolean(s))
    .slice(0, GALLERY_LIMIT);

  const specs: ProductSpec[] = (raw.specs ?? [])
    .map((s) => ({ name: clean(s.name), value: clean(s.value) }))
    .filter((s): s is ProductSpec => Boolean(s.name && s.value))
    .slice(0, SPECS_LIMIT);

  return {
    id: clean(raw.id) ?? clean(raw.title) ?? "unknown",
    title: clean(raw.title) ?? "Без названия",
    price,
    oldPrice,
    discountPercent: parsePercent(raw.discountText) ?? computeDiscount(price, oldPrice),
    // Главное фото деталки = первый кадр галереи (карточка-выдача отдельного поля не несёт).
    imageUrl: images[0] ?? null,
    rating: parseRating(raw.ratingText),
    reviewCount: parseCount(raw.reviewText),
    url: absolute(clean(raw.url)),
    images,
    specs,
    description: clean(raw.description),
  };
}

/** Ссылка на страницу товара: абсолютный `url` карточки, иначе достройка из `id`-пути. */
function productUrl(id: string, url?: string | null): string {
  const fromUrl = absolute(clean(url));
  if (fromUrl) return fromUrl;
  const fromId = absolute(clean(id));
  return fromId ?? `${MEGAMARKET_ORIGIN}/catalog/details/${encodeURIComponent(id)}/`;
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
