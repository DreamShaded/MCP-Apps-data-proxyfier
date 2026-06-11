import { z } from "zod";

/**
 * Ячейка сетки ставок: ставка действует для пересечения «диапазон срока × диапазон
 * суммы × капитализация». Клиент по позиции слайдеров выбирает подходящую ячейку и
 * пересчитывает доходность сам — к серверу при движении слайдера не ходит.
 */
export const rateCellSchema = z.object({
  /** Нижняя граница срока в месяцах (включительно). */
  termMin: z.number(),
  /** Верхняя граница срока в месяцах (включительно). */
  termMax: z.number(),
  /** Нижний порог суммы в рублях (включительно). */
  amountMin: z.number(),
  /** Верхний порог суммы; `null` — без верхней границы. */
  amountMax: z.number().nullable(),
  /** Ставка для ячейки с ежемесячной капитализацией процентов. */
  capitalization: z.boolean(),
  /** Годовая ставка в процентах. */
  rate: z.number(),
});

export type RateCell = z.infer<typeof rateCellSchema>;

/**
 * Вклад линейки Сбера — DTO, который инструмент кладёт в `structuredContent`, а UI
 * рисует карточкой со слайдерами. Несёт **полную сетку ставок** (`rates`), чтобы
 * пересчёт доходности шёл целиком на клиенте. Поля, которых может не быть на живой
 * странице, — опциональны/nullable, а не обязательны.
 */
export const depositSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Короткое описание/условие вклада; `null`, если не сняли. */
  description: z.string().nullable(),
  /** Минимальная сумма открытия в рублях. */
  minAmount: z.number(),
  /** Максимальная сумма; `null` — без верхней границы. */
  maxAmount: z.number().nullable(),
  /** Минимальный срок в месяцах. */
  minTermMonths: z.number(),
  /** Максимальный срок в месяцах. */
  maxTermMonths: z.number(),
  /** Доступна ли капитализация процентов (есть переключатель в UI). */
  capitalization: z.boolean(),
  /** Полная сетка ставок (срок × порог суммы × капитализация). */
  rates: z.array(rateCellSchema),
});

export type Deposit = z.infer<typeof depositSchema>;

/**
 * Выходная схема `search_deposits` — то, что UI читает из `structuredContent`.
 * `amount`/`termMonths` — эхо запроса (начальные позиции слайдеров); `deposits`
 * несут полную сетку для клиентского пересчёта. Обёртка происхождения/деградации
 * зеркалит выдачу Megamarket (UI решает по `fallback`).
 */
export const searchDepositsResultSchema = z.object({
  /** Запрошенная сумма — начальная позиция слайдера суммы. */
  amount: z.number(),
  /** Запрошенный срок в месяцах — начальная позиция слайдера срока. */
  termMonths: z.number(),
  deposits: z.array(depositSchema),
  source: z.enum(["hit", "miss", "fallback"]),
  /** Отдан протухший пример (живой источник не успел/упал, но запись была). */
  stale: z.boolean(),
  /** Фолбэк без данных к показу → UI рисует аккуратную заглушку. */
  fallback: z.boolean(),
  fetchedAt: z.string().nullable(),
});

export type SearchDepositsResult = z.infer<typeof searchDepositsResultSchema>;
