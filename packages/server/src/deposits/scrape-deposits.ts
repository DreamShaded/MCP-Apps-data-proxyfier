import type { Page } from "playwright";
import type { Deposit, RateCell } from "./deposit.js";

/** Лимит видимых вкладов: узкий чат-iframe не тянет длинную линейку. */
export const DEPOSITS_RESULT_LIMIT = 6;

/** База для достройки относительных ссылок до абсолютных. */
const SBER_ORIGIN = "https://www.sberbank.ru";
const DEPOSITS_URL = `${SBER_ORIGIN}/person/contributions/depositsnew`;

/**
 * Сырой вклад, как он снят со страницы (всё — строки/`null`). Парсинг сетки ставок
 * вынесен в чистую `normalizeDeposits`, чтобы тестировать без браузера.
 */
export interface RawDeposit {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  minAmountText?: string | null;
  maxAmountText?: string | null;
  minTermText?: string | null;
  maxTermText?: string | null;
  capitalization?: boolean | null;
  /** Сырые ячейки сетки ставок (строки порогов/срока/ставки + флаг капитализации). */
  rates?: RawRateCell[] | null;
}

export interface RawRateCell {
  termMinText?: string | null;
  termMaxText?: string | null;
  amountMinText?: string | null;
  amountMaxText?: string | null;
  capitalization?: boolean | null;
  rateText?: string | null;
}

/**
 * Живой скрейп линейки вкладов Сбера под сессией. Селекторы тюнятся по живому сайту
 * (как `session-detectors`) — опасная ошибка тихая (пустая линейка), поэтому
 * деградацию ловит кэш-слой: бросок отсюда → `source:'fallback'`.
 *
 * `page.goto` ограничен таймаутом ниже общего (~8с кэш-слоя), чтобы зависший переход
 * не держал мьютекс единственной страницы. `amount`/`termMonths` — подсказки для
 * пред-заполнения калькулятора на странице, в сетку не входят (она отдаётся полной).
 */
export async function scrapeDeposits(
  page: Page,
  _amount: number,
  _termMonths: number,
): Promise<Deposit[]> {
  await page.goto(DEPOSITS_URL, { waitUntil: "domcontentloaded", timeout: 7_000 });

  // Карточка вклада. Селектор HITL-настраивается на живом сайте.
  const CARD = '[data-test-id="deposit-card"]';
  await page.waitForSelector(CARD, { timeout: 5_000 }).catch(() => {});

  const raw = await page.$$eval(CARD, (cards) => {
    // Внутри браузера; структурные типы вместо DOM-lib (её нет в tsconfig сервера).
    const text = (el: { textContent: string | null } | null) => el?.textContent?.trim() ?? null;
    const attr = (el: { getAttribute(n: string): string | null } | null, name: string) =>
      el?.getAttribute(name) ?? null;
    return cards.map((card): Record<string, unknown> => {
      // Индексный обход вместо Array.from: NodeList не итерируется без DOM.Iterable
      // в tsconfig сервера, а `.length`/индексатор доступны и сохраняют тип Element.
      const rows = card.querySelectorAll('[data-test-id="rate-row"]');
      const rates: Record<string, string | boolean | null>[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        rates.push({
          termMinText: attr(row, "data-term-min"),
          termMaxText: attr(row, "data-term-max"),
          amountMinText: attr(row, "data-amount-min"),
          amountMaxText: attr(row, "data-amount-max"),
          capitalization: attr(row, "data-capitalization") === "true",
          rateText: text(row.querySelector('[data-test-id="rate-value"]')) ?? attr(row, "data-rate"),
        });
      }
      return {
        id: attr(card, "data-deposit-id"),
        name: text(card.querySelector('[data-test-id="deposit-name"]')),
        description: text(card.querySelector('[data-test-id="deposit-desc"]')),
        minAmountText: text(card.querySelector('[data-test-id="amount-min"]')),
        maxAmountText: text(card.querySelector('[data-test-id="amount-max"]')),
        minTermText: text(card.querySelector('[data-test-id="term-min"]')),
        maxTermText: text(card.querySelector('[data-test-id="term-max"]')),
        capitalization: card.querySelector('[data-test-id="capitalization"]') !== null,
        rates,
      };
    });
  });

  return normalizeDeposits(raw as RawDeposit[]);
}

/**
 * Чистое преобразование сырых карточек в `Deposit[]`: парсинг сумм/сроков/ставок,
 * сборка сетки, отсев вкладов без названия или без валидных ставок, обрезка до
 * лимита. Тестируется без браузера — это и есть проверяемая граница скрейпа.
 */
export function normalizeDeposits(
  raw: RawDeposit[],
  limit: number = DEPOSITS_RESULT_LIMIT,
): Deposit[] {
  const deposits: Deposit[] = [];
  for (const r of raw) {
    const name = clean(r.name);
    if (!name) continue; // карточка без названия — мусор/скелетон

    const rates = normalizeRates(r.rates ?? []);
    if (rates.length === 0) continue; // без ставок карточку показывать нечем

    const minTermMonths = parseMonths(r.minTermText) ?? minOf(rates.map((c) => c.termMin)) ?? 1;
    const maxTermMonths = parseMonths(r.maxTermText) ?? maxOf(rates.map((c) => c.termMax)) ?? minTermMonths;
    const minAmount = parseRubles(r.minAmountText) ?? minOf(rates.map((c) => c.amountMin)) ?? 0;

    deposits.push({
      id: clean(r.id) ?? `${name}#${deposits.length}`,
      name,
      description: clean(r.description),
      minAmount,
      maxAmount: parseRubles(r.maxAmountText),
      minTermMonths,
      maxTermMonths,
      capitalization: r.capitalization === true || rates.some((c) => c.capitalization),
      rates,
    });
    if (deposits.length >= limit) break;
  }
  return deposits;
}

/** Собрать валидные ячейки сетки из сырых строк (битые/без ставки — отбрасываем). */
function normalizeRates(raw: RawRateCell[]): RateCell[] {
  const cells: RateCell[] = [];
  for (const r of raw) {
    const rate = parseRate(r.rateText);
    const termMin = parseMonths(r.termMinText);
    const termMax = parseMonths(r.termMaxText);
    const amountMin = parseRubles(r.amountMinText);
    // Без ставки или границ срока/суммы ячейка бесполезна для выбора.
    if (rate === null || termMin === null || termMax === null || amountMin === null) continue;
    cells.push({
      termMin,
      termMax,
      amountMin,
      amountMax: parseRubles(r.amountMaxText),
      capitalization: r.capitalization === true,
      rate,
    });
  }
  return cells;
}

function clean(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}

/** «от 100 000 ₽», «1 299» → 100000 / 1299. Целые рубли или `null`. */
function parseRubles(text: string | null | undefined): number | null {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/** «12 мес», «от 6» → 12 / 6. Целое число месяцев или `null`. */
function parseMonths(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** «16,5%» / «16.5» → 16.5. Годовая ставка или `null`. */
function parseRate(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(",", ".").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function minOf(xs: number[]): number | null {
  return xs.length ? Math.min(...xs) : null;
}
function maxOf(xs: number[]): number | null {
  return xs.length ? Math.max(...xs) : null;
}
