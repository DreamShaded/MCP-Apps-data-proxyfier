import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as cartStore from "./cart-store.js";

// Корзина — модульный singleton (см. GOTCHA плана): сбрасываем между тестами, чтобы
// они не делили состояние.
beforeEach(() => cartStore.clear());

test("add: known id increments quantity across repeated calls", () => {
  assert.deepEqual(cartStore.add("600018869646"), { added: true });
  assert.deepEqual(cartStore.add("600018869646"), { added: true });
  const cart = cartStore.view();
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 2);
  assert.equal(cart.totalCount, 2);
});

test("add: unknown id does not add and does not change the cart", () => {
  assert.deepEqual(cartStore.add("unknown-id"), { added: false });
  assert.deepEqual(cartStore.view(), { items: [], totalCount: 0, totalPrice: 0 });
});

test("view: computes lineTotal and totalPrice from catalog price × quantity", () => {
  cartStore.add("600018869646");
  const cart = cartStore.view();
  const item = cart.items[0];
  assert.equal(item.lineTotal, item.price! * item.quantity);
  assert.equal(cart.totalPrice, item.lineTotal);
});

test("clear: empties the cart", () => {
  cartStore.add("600018869646");
  cartStore.clear();
  assert.deepEqual(cartStore.view(), { items: [], totalCount: 0, totalPrice: 0 });
});
