import type { RateCell } from "./types";

/** Результат пересчёта доходности по позиции слайдеров. */
export interface YieldResult {
  /** Применённая годовая ставка из сетки, %. `null` — выбранные сумма/срок вне условий. */
  rate: number | null;
  /** Начисленные проценты за весь срок, руб (целое). */
  interest: number;
  /** Сумма к концу срока (вклад + проценты), руб (целое). */
  total: number;
  /** Капитализация реально применена при расчёте (есть и запрошена, и в ячейке). */
  capitalized: boolean;
}

/** Диапазон позиций слайдера. */
export interface Bounds {
  min: number;
  max: number;
}

/**
 * Выбор ставки из сетки по позиции слайдеров. Сначала — ячейки, в чьи диапазоны
 * попадают и срок, и сумма. Среди них предпочитаем запрошенную капитализацию; если
 * ячейки с нужным флагом нет — берём из всех попавших (ставка без капитализации тоже
 * применима). На неоднозначности (пересекающиеся пороги) выбираем бóльшую ставку —
 * в пользу клиента. `null` — выбранные сумма/срок не покрыты сеткой.
 */
export function selectRate(
  rates: RateCell[],
  amount: number,
  termMonths: number,
  capitalization: boolean,
): RateCell | null {
  const inRange = rates.filter(
    (c) =>
      termMonths >= c.termMin &&
      termMonths <= c.termMax &&
      amount >= c.amountMin &&
      (c.amountMax === null || amount <= c.amountMax),
  );
  if (inRange.length === 0) return null;
  const matching = inRange.filter((c) => c.capitalization === capitalization);
  const pool = matching.length ? matching : inRange;
  return pool.reduce((best, c) => (c.rate > best.rate ? c : best));
}

/**
 * Чистый пересчёт доходности от (сумма, срок, капитализация, сетка). Граница порогов
 * и формула капитализации покрыты юнит-тестами. Без побочных эффектов — крутится в
 * iframe при каждом движении слайдера, к серверу не ходит.
 *
 * Капитализация — ежемесячное сложение процентов; иначе простые проценты
 * пропорционально сроку. Капитализируем только если она и запрошена, и есть в ячейке
 * (иначе применяется её же не-кап ставка простым начислением — честно к данным).
 */
export function computeYield(
  amount: number,
  termMonths: number,
  capitalization: boolean,
  rates: RateCell[],
): YieldResult {
  const cell = selectRate(rates, amount, termMonths, capitalization);
  if (!cell) return { rate: null, interest: 0, total: amount, capitalized: false };

  const annual = cell.rate / 100;
  const useCap = capitalization && cell.capitalization;
  const total = useCap
    ? amount * Math.pow(1 + annual / 12, termMonths)
    : amount * (1 + (annual * termMonths) / 12);

  const totalRounded = Math.round(total);
  return { rate: cell.rate, interest: totalRounded - amount, total: totalRounded, capitalized: useCap };
}

/** Границы слайдера суммы из линейки (объединение минимумов/максимумов вкладов). */
export function amountBounds(deposits: { minAmount: number; maxAmount: number | null }[]): Bounds {
  if (deposits.length === 0) return { min: 1_000, max: 3_000_000 };
  const min = Math.min(...deposits.map((d) => d.minAmount));
  // Безлимитный вклад (maxAmount === null) поднимает потолок слайдера к высокому
  // дефолту, а не ограничивает его максимумом «лимитных» вкладов линейки.
  const hasUnbounded = deposits.some((d) => d.maxAmount === null);
  const maxes = deposits.map((d) => d.maxAmount).filter((x): x is number => x !== null);
  // С безлимитным вкладом потолок щедрый, но всё равно не ниже максимума «лимитных»
  // вкладов линейки — иначе их верхние пороги суммы были бы недостижимы слайдером.
  const max = hasUnbounded ? Math.max(min * 100, 3_000_000, ...maxes) : Math.max(...maxes);
  return { min, max: Math.max(max, min) };
}

/** Границы слайдера срока в месяцах из линейки. */
export function termBounds(deposits: { minTermMonths: number; maxTermMonths: number }[]): Bounds {
  if (deposits.length === 0) return { min: 1, max: 36 };
  return {
    min: Math.min(...deposits.map((d) => d.minTermMonths)),
    max: Math.max(...deposits.map((d) => d.maxTermMonths)),
  };
}

/** Прижать значение к диапазону. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
