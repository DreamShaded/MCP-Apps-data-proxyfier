import type { Page } from "playwright";
import type { Cart, CartItem } from "./cart.js";

/** Сколько позиций корзины показываем максимум — узкий чат-iframe не тянет длинный список. */
export const CART_ITEMS_LIMIT = 30;

/** База для достройки относительных ссылок/картинок до абсолютных. */
const MEGAMARKET_ORIGIN = "https://megamarket.ru";
/**
 * Страница реальной корзины — источник авторитетного состояния после клика и адрес
 * хэндофа «открыть в браузере» (дальше пользователь дозавершает оплату руками в окне).
 */
export const CART_URL = `${MEGAMARKET_ORIGIN}/cart/`;

/**
 * Сырая позиция корзины, как она снята со страницы (всё — строки/`null`). Парсинг чисел
 * и обрезка вынесены в чистую `normalizeCart`, чтобы тестировать без браузера.
 */
export interface RawCartItem {
  id?: string | null;
  title?: string | null;
  priceText?: string | null;
  quantityText?: string | null;
  lineTotalText?: string | null;
  imageUrl?: string | null;
  url?: string | null;
}

/** Сырое состояние корзины: позиции + текст итоговой суммы (если он снят отдельным блоком). */
export interface RawCart {
  items: RawCartItem[];
  totalPriceText?: string | null;
}

/** Достроить путь до страницы товара: абсолютный `url` карточки, иначе путь из `id`. */
function productUrl(id: string, url?: string | null): string {
  const fromUrl = absolute(clean(url));
  if (fromUrl) return fromUrl;
  const fromId = absolute(clean(id));
  return fromId ?? `${MEGAMARKET_ORIGIN}/catalog/details/${encodeURIComponent(id)}/`;
}

/**
 * Живой клик «в корзину» под залогиненной сессией: повторяет естественный user-flow —
 * заходим на страницу товара и жмём настоящую кнопку добавления (мягче для антибота, чем
 * bulk-запрос). После клика читаем авторитетное состояние корзины со страницы `/cart`,
 * чтобы бейдж и вью корзины были согласованы. Опасный сбой здесь не молчит: не нашли
 * кнопку / клик не прошёл → бросок, который инструмент превращает в `fallback`.
 *
 * Вся последовательность (переход → клик → чтение корзины) идёт под единственной
 * страницей в одном `withPage`, т.е. сериализована мьютексом — параллельных кликов нет.
 */
export async function addToCart(page: Page, id: string, url?: string | null): Promise<Cart> {
  await page.goto(productUrl(id, url), { waitUntil: "domcontentloaded", timeout: 7_000 });

  // Кнопка добавления. Селекторы HITL-настраиваются на живом сайте (как в scrape-search).
  const ADD = '[data-test="add-to-cart"], button[data-test="addToCart"], [data-test="product-add-to-cart"]';
  const button = await page.waitForSelector(ADD, { timeout: 5_000 });
  await button.click();

  // Даём корзине применить добавление перед чтением авторитетного состояния.
  await page.waitForTimeout(800);
  return scrapeCart(page);
}

/**
 * Хэндоф «открыть в браузере»: переходим на реальную `/cart` (под залогиненной сессией —
 * там лежат товары из живых `add_to_cart`), снимаем авторитетное состояние и выводим живое
 * headed-окно вперёд (`bringToFront`), чтобы пользователь дозавершил оплату руками. Окно
 * остаётся на заполненной корзине; платёжную страницу/3DS в чат-iframe не встраиваем.
 *
 * Идёт под единственной страницей в `withPage` — сериализовано мьютексом с остальными
 * операциями корзины. Сбой (антибот/таймаут) бросаем — инструмент превращает его в `fallback`.
 */
export async function checkoutHandoff(page: Page): Promise<Cart> {
  const cart = await scrapeCart(page);
  await page.bringToFront();
  return cart;
}

/**
 * Живое чтение реальной корзины Megamarket: переходим на `/cart` и снимаем позиции и итог.
 * Не кэшируется — корзина изменчива (после `add_to_cart` любой кэш мгновенно протух бы).
 * `page.goto` ограничен таймаутом ниже общего (~8с), чтобы зависший переход не держал мьютекс.
 */
export async function scrapeCart(page: Page): Promise<Cart> {
  await page.goto(CART_URL, { waitUntil: "domcontentloaded", timeout: 7_000 });

  const ITEM = '[data-test="cart-item"], [data-test="basket-item"]';
  await page.waitForSelector(ITEM, { timeout: 5_000 }).catch(() => {});

  const raw = await page.$$eval(ITEM, (rows): Record<string, unknown> => {
    // Внутри браузера; структурные типы вместо DOM-lib (её нет в tsconfig сервера).
    const text = (el: { textContent: string | null } | null) => el?.textContent?.trim() ?? null;
    const attr = (el: { getAttribute(n: string): string | null } | null, name: string) =>
      el?.getAttribute(name) ?? null;

    const items = rows.map((row): Record<string, string | null> => {
      const link = row.querySelector("a[href]");
      const img = row.querySelector("img");
      return {
        id: attr(row, "data-item-id") ?? attr(link, "href"),
        title: text(row.querySelector('[data-test="item-title"], [data-test="product-title"], [itemprop="name"]')),
        priceText: text(row.querySelector('[data-test="item-price"], [data-test="product-price"]')),
        quantityText:
          text(row.querySelector('[data-test="item-count"], [data-test="quantity"], input[type="number"]')) ??
          attr(row.querySelector('input[type="number"]'), "value"),
        lineTotalText: text(row.querySelector('[data-test="item-total"], [data-test="item-sum"]')),
        imageUrl: attr(img, "src") ?? attr(img, "data-src"),
        url: attr(link, "href"),
      };
    });

    // Итог корзины ищем вне списка позиций (отдельный блок «итого»).
    const root = (rows[0]?.ownerDocument as { querySelector(s: string): unknown } | undefined) ?? null;
    const totalEl = (root?.querySelector('[data-test="cart-total"], [data-test="basket-total"], [data-test="total-price"]') ??
      null) as { textContent: string | null } | null;

    return { items, totalPriceText: totalEl?.textContent?.trim() ?? null };
  });

  return normalizeCart(raw as unknown as RawCart);
}

/**
 * Чистое преобразование сырой корзины в `Cart`: парсинг чисел, расчёт суммы по строке,
 * достройка ссылок, обрезка под лимит и подсчёт `totalCount`/`totalPrice`. Тестируется без
 * браузера — это и есть проверяемая граница скрейпа корзины.
 */
export function normalizeCart(raw: RawCart, limit: number = CART_ITEMS_LIMIT): Cart {
  const items: CartItem[] = [];
  for (const r of raw.items ?? []) {
    const title = clean(r.title);
    if (!title) continue; // строка без названия — скелетон/мусор, пропускаем

    const price = parseRubles(r.priceText);
    const quantity = parseQuantity(r.quantityText);
    const lineTotal = parseRubles(r.lineTotalText) ?? computeLineTotal(price, quantity);
    items.push({
      id: clean(r.id) ?? `${title}#${items.length}`,
      title,
      price,
      quantity,
      imageUrl: absolute(clean(r.imageUrl)),
      url: absolute(clean(r.url)),
      lineTotal,
    });
    if (items.length >= limit) break;
  }

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  // Итог берём со страницы; если его не сняли — суммируем строки сами.
  const totalPrice = parseRubles(raw.totalPriceText) ?? sumLineTotals(items);
  return { items, totalCount, totalPrice };
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

/** «2», «× 3», пустое поле → количество; минимум 1 (позиция в корзине есть хотя бы одна). */
function parseQuantity(text: string | null | undefined): number {
  if (!text) return 1;
  const digits = text.replace(/[^\d]/g, "");
  const n = digits ? Number(digits) : 1;
  return n > 0 ? n : 1;
}

/** Сумма по строке из цены и количества, если её не отдали явным блоком. */
function computeLineTotal(price: number | null, quantity: number): number | null {
  return price === null ? null : price * quantity;
}

/** Итог корзины как сумма строк; `null`, если ни по одной строке суммы нет. */
function sumLineTotals(items: CartItem[]): number | null {
  const totals = items.map((item) => item.lineTotal).filter((t): t is number => t !== null);
  return totals.length ? totals.reduce((sum, t) => sum + t, 0) : null;
}

/** Достроить относительный путь до абсолютного URL Megamarket. */
function absolute(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${MEGAMARKET_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}
