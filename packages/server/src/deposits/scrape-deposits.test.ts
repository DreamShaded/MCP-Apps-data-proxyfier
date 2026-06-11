import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDeposits, type RawDeposit } from "./scrape-deposits.js";

/** Сырая карточка вклада «как со страницы»: строки порогов/срока + сетка ставок. */
const RAW: RawDeposit[] = [
  {
    id: "sbervklad",
    name: "СберВклад",
    description: "Базовый вклад",
    minAmountText: "от 1 000 ₽",
    maxAmountText: null,
    minTermText: "от 1 мес",
    maxTermText: "до 36 мес",
    capitalization: true,
    rates: [
      { termMinText: "1", termMaxText: "5", amountMinText: "1 000", amountMaxText: "100 000", capitalization: false, rateText: "14,0%" },
      { termMinText: "6", termMaxText: "12", amountMinText: "100 000", amountMaxText: null, capitalization: true, rateText: "16,5%" },
      // битая ячейка без ставки — должна быть отброшена
      { termMinText: "6", termMaxText: "12", amountMinText: "100 000", amountMaxText: null, capitalization: false, rateText: null },
    ],
  },
];

test("normalizeDeposits parses amounts, terms and the rate grid", () => {
  const [d] = normalizeDeposits(RAW);
  assert.equal(d.id, "sbervklad");
  assert.equal(d.name, "СберВклад");
  assert.equal(d.minAmount, 1000);
  assert.equal(d.maxAmount, null);
  assert.equal(d.minTermMonths, 1);
  assert.equal(d.maxTermMonths, 36);
  assert.equal(d.capitalization, true);
  // битая ячейка отброшена → остаются ровно две
  assert.equal(d.rates.length, 2);
  assert.deepEqual(d.rates[1], { termMin: 6, termMax: 12, amountMin: 100000, amountMax: null, capitalization: true, rate: 16.5 });
});

test("normalizeDeposits drops cards without a name or without any valid rate", () => {
  const out = normalizeDeposits([
    { name: null, rates: [{ termMinText: "1", termMaxText: "3", amountMinText: "1000", rateText: "10%" }] },
    { name: "Пустой", rates: [] },
    { name: "Без ставок", rates: [{ termMinText: "1", termMaxText: "3", amountMinText: "1000", rateText: null }] },
  ]);
  assert.equal(out.length, 0);
});

test("normalizeDeposits derives term/amount bounds from the grid when card fields are missing", () => {
  const [d] = normalizeDeposits([
    {
      name: "Без явных границ",
      rates: [
        { termMinText: "3", termMaxText: "6", amountMinText: "50 000", amountMaxText: null, rateText: "12%" },
        { termMinText: "7", termMaxText: "24", amountMinText: "10 000", amountMaxText: null, rateText: "13%" },
      ],
    },
  ]);
  assert.equal(d.minTermMonths, 3);
  assert.equal(d.maxTermMonths, 24);
  assert.equal(d.minAmount, 10000);
});

test("normalizeDeposits truncates to the limit", () => {
  const many: RawDeposit[] = Array.from({ length: 10 }, (_, i) => ({
    name: `Вклад ${i}`,
    rates: [{ termMinText: "1", termMaxText: "12", amountMinText: "1000", rateText: "10%" }],
  }));
  assert.equal(normalizeDeposits(many, 6).length, 6);
});
