import { test } from "node:test";
import assert from "node:assert/strict";
import { goods, plural } from "./plural.js";

test("singular for numbers ending in 1", () => {
  for (const n of [1, 21, 101, 1001]) assert.equal(goods(n), `${n} товар`);
});

test("few for numbers ending in 2..4", () => {
  for (const n of [2, 3, 4, 22, 33, 104]) assert.equal(goods(n), `${n} товара`);
});

test("many for 0, 5..9 and round tens", () => {
  for (const n of [0, 5, 9, 10, 20, 100]) assert.equal(goods(n), `${n} товаров`);
});

// 11–14 — исключение: по последней цифре они дали бы «11 товар», «12 товара».
test("the 11..14 exception always takes the plural form", () => {
  for (const n of [11, 12, 13, 14, 111, 112, 213]) assert.equal(goods(n), `${n} товаров`);
});

test("plural works for any word triple", () => {
  assert.equal(plural(1, "позиция", "позиции", "позиций"), "позиция");
  assert.equal(plural(3, "позиция", "позиции", "позиций"), "позиции");
  assert.equal(plural(12, "позиция", "позиции", "позиций"), "позиций");
});
