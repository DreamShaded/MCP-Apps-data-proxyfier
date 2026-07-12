/**
 * DTO вкладов на стороне UI. Зеркалит выходную схему `search_deposits`
 * (см. `packages/server/src/deposits/deposit.ts`). Дублируется сознательно: это
 * граница postMessage-моста между хостом и iframe; общий тип-пакет ради DTO — оверкилл.
 */

/** Ячейка сетки ставок. Зеркалит `rateCellSchema`. */
export interface RateCell {
  termMin: number;
  termMax: number;
  amountMin: number;
  amountMax: number | null;
  capitalization: boolean;
  rate: number;
}

/** Вклад линейки. Зеркалит `depositSchema`. Несёт полную сетку для клиентского пересчёта. */
export interface Deposit {
  id: string;
  name: string;
  description: string | null;
  minAmount: number;
  maxAmount: number | null;
  minTermMonths: number;
  maxTermMonths: number;
  capitalization: boolean;
  rates: RateCell[];
}

/** Результат `search_deposits`. Зеркалит `searchDepositsResultSchema`. */
export interface SearchDepositsResult {
  amount: number;
  termMonths: number;
  deposits: Deposit[];
}
