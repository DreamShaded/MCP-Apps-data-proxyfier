import { test } from "node:test";
import assert from "node:assert/strict";
import { searchDeposits } from "./static-deposits.js";

test("searchDeposits: returns the full deposit lineup with a non-empty rate grid", () => {
  const deposits = searchDeposits();
  assert.ok(deposits.length > 0, "линейка вкладов не пуста");
  assert.ok(deposits.every((d) => d.rates.length > 0), "у каждого вклада есть хотя бы одна ставка");
});

test("searchDeposits: open upper amount bound maps to null, not a sentinel number", () => {
  const deposits = searchDeposits();
  const hasOpenBound = deposits.some((d) => d.rates.some((r) => r.amountMax === null));
  assert.ok(hasOpenBound, "хотя бы одна ставка без верхней границы суммы (sumEnd-сентинел → null)");
});
