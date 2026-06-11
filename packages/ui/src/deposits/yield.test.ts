import { test } from "node:test";
import assert from "node:assert/strict";
import { computeYield, selectRate, amountBounds, termBounds, clamp } from "./yield.js";
import type { RateCell } from "./types.js";

/** Сетка с двумя порогами суммы и двумя диапазонами срока, кап/не-кап. */
const GRID: RateCell[] = [
  { termMin: 1, termMax: 5, amountMin: 1_000, amountMax: 99_999, capitalization: false, rate: 12 },
  { termMin: 6, termMax: 12, amountMin: 1_000, amountMax: 99_999, capitalization: false, rate: 14 },
  { termMin: 6, termMax: 12, amountMin: 100_000, amountMax: null, capitalization: false, rate: 16 },
  { termMin: 6, termMax: 12, amountMin: 100_000, amountMax: null, capitalization: true, rate: 16.5 },
];

test("selectRate picks the higher amount bucket exactly at the threshold (inclusive lower bound)", () => {
  // 100_000 — нижняя граница верхнего порога: должна примениться ставка 16, а не 14.
  const cell = selectRate(GRID, 100_000, 12, false);
  assert.equal(cell?.rate, 16);
  // На рубль ниже порога — нижний бакет.
  assert.equal(selectRate(GRID, 99_999, 12, false)?.rate, 14);
});

test("selectRate respects the term bucket boundary", () => {
  assert.equal(selectRate(GRID, 50_000, 5, false)?.rate, 12); // верх первого диапазона
  assert.equal(selectRate(GRID, 50_000, 6, false)?.rate, 14); // низ второго диапазона
});

test("selectRate falls back to a non-capitalization cell when no cap cell matches", () => {
  // Запрошена капитализация, но в нижнем пороге кап-ячейки нет → берём не-кап (14).
  const cell = selectRate(GRID, 50_000, 12, true);
  assert.equal(cell?.rate, 14);
  assert.equal(cell?.capitalization, false);
});

test("selectRate returns null when amount/term are outside the grid", () => {
  assert.equal(selectRate(GRID, 500, 12, false), null); // сумма ниже минимума
  assert.equal(selectRate(GRID, 50_000, 24, false), null); // срок за пределами
});

test("selectRate prefers the requested capitalization even if its rate is nominally lower", () => {
  // Намеренно: запрошена капитализация и кап-ячейка есть → берём её, даже если
  // не-кап ставка в том же диапазоне выше. Выбор клиента важнее номинала ставки.
  const grid: RateCell[] = [
    { termMin: 6, termMax: 12, amountMin: 1_000, amountMax: null, capitalization: false, rate: 18 },
    { termMin: 6, termMax: 12, amountMin: 1_000, amountMax: null, capitalization: true, rate: 16 },
  ];
  assert.equal(selectRate(grid, 50_000, 12, true)?.rate, 16);
  assert.equal(selectRate(grid, 50_000, 12, false)?.rate, 18);
});

test("amountBounds keeps a high-max bounded deposit reachable alongside an unbounded one", () => {
  // Безлимитный вклад + лимитный с потолком 5 млн → слайдер должен дотягиваться до 5 млн.
  const bounds = amountBounds([
    { minAmount: 1_000, maxAmount: null },
    { minAmount: 1_000, maxAmount: 5_000_000 },
  ]);
  assert.equal(bounds.max, 5_000_000);
});

test("computeYield: simple interest is amount * rate * term/12", () => {
  // 100 000 ₽, 12 мес, ставка 16% без капитализации → 16 000 процентов.
  const y = computeYield(100_000, 12, false, GRID);
  assert.equal(y.rate, 16);
  assert.equal(y.capitalized, false);
  assert.equal(y.interest, 16_000);
  assert.equal(y.total, 116_000);
});

test("computeYield: monthly capitalization yields more than simple interest", () => {
  const cap = computeYield(100_000, 12, true, GRID); // ставка 16.5 с ежемесячной кап.
  const simple = computeYield(100_000, 12, false, GRID); // ставка 16 простыми
  assert.equal(cap.capitalized, true);
  assert.equal(cap.rate, 16.5);
  // Сложный процент строго больше простого начисления.
  assert.ok(cap.interest > simple.interest, "капитализация должна давать больше процентов");
  // 100000 * (1 + 0.165/12)^12 ≈ 117 807 → проценты ≈ 17 807.
  assert.equal(cap.interest, Math.round(100_000 * Math.pow(1 + 0.165 / 12, 12)) - 100_000);
});

test("computeYield: half-year simple interest is half of the annual", () => {
  // 100 000 ₽, 6 мес, ставка 16% → проценты 8 000 (половина годовых).
  const y = computeYield(100_000, 6, false, GRID);
  assert.equal(y.interest, 8_000);
});

test("computeYield: out-of-range selection returns zero interest and principal as total", () => {
  const y = computeYield(500, 12, false, GRID);
  assert.equal(y.rate, null);
  assert.equal(y.interest, 0);
  assert.equal(y.total, 500);
});

test("amountBounds / termBounds derive slider ranges from the line-up", () => {
  const deposits = [
    { minAmount: 1_000, maxAmount: 50_000, minTermMonths: 3, maxTermMonths: 12 },
    { minAmount: 100_000, maxAmount: null, minTermMonths: 1, maxTermMonths: 36 },
  ];
  assert.deepEqual(amountBounds(deposits), { min: 1_000, max: 3_000_000 });
  assert.deepEqual(termBounds(deposits), { min: 1, max: 36 });
  // Пустая линейка → дефолтные диапазоны.
  assert.deepEqual(termBounds([]), { min: 1, max: 36 });
});

test("clamp keeps a value within bounds", () => {
  assert.equal(clamp(5, 1, 10), 5);
  assert.equal(clamp(-1, 1, 10), 1);
  assert.equal(clamp(99, 1, 10), 10);
});
