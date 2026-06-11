import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCart, CART_ITEMS_LIMIT, type RawCart } from "./scrape-cart.js";

test("normalizeCart parses prices, quantity and totals from raw rows", () => {
  const raw: RawCart = {
    items: [
      { id: "p1", title: "Наушники A", priceText: "4 990 ₽", quantityText: "2", imageUrl: "/a.jpg", url: "/p1" },
      { id: "p2", title: "Колонка B", priceText: "1 200 ₽", quantityText: "× 1", lineTotalText: "1 200 ₽", url: "https://megamarket.ru/p2" },
    ],
    totalPriceText: "11 180 ₽",
  };

  const cart = normalizeCart(raw);

  assert.equal(cart.items.length, 2);
  assert.equal(cart.items[0].price, 4990);
  assert.equal(cart.items[0].quantity, 2);
  // Сумма по строке посчитана из цены и количества (явного блока не было).
  assert.equal(cart.items[0].lineTotal, 9980);
  assert.equal(cart.items[0].imageUrl, "https://megamarket.ru/a.jpg");
  assert.equal(cart.items[0].url, "https://megamarket.ru/p1");
  // Явная сумма по строке снята как есть.
  assert.equal(cart.items[1].lineTotal, 1200);
  assert.equal(cart.totalCount, 3, "totalCount = сумма количеств");
  assert.equal(cart.totalPrice, 11180, "итог взят со страницы");
});

test("normalizeCart computes total from line totals when the page total is missing", () => {
  const cart = normalizeCart({
    items: [
      { id: "p1", title: "A", priceText: "1000", quantityText: "2" },
      { id: "p2", title: "B", priceText: "500", quantityText: "1" },
    ],
  });
  assert.equal(cart.totalPrice, 2500, "итог суммируется из строк, когда блока итога нет");
});

test("normalizeCart skips skeleton rows without a title", () => {
  const cart = normalizeCart({
    items: [
      { id: "p1", title: "Реальный товар", priceText: "999", quantityText: "1" },
      { id: "skeleton", title: "   ", priceText: "0" },
    ],
  });
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].title, "Реальный товар");
});

test("normalizeCart defaults missing quantity to 1 and synthesizes ids by position", () => {
  const cart = normalizeCart({
    items: [
      { title: "Без id", priceText: "100" },
      { title: "Без id", priceText: "200" },
    ],
  });
  assert.equal(cart.items[0].quantity, 1, "пустое количество → 1");
  assert.notEqual(cart.items[0].id, cart.items[1].id, "синтезированные id различаются по позиции");
  assert.equal(cart.totalCount, 2);
});

test("normalizeCart caps the list at the items limit", () => {
  const items = Array.from({ length: CART_ITEMS_LIMIT + 5 }, (_, i) => ({
    id: `p${i}`,
    title: `Товар ${i}`,
    priceText: "100",
    quantityText: "1",
  }));
  const cart = normalizeCart({ items });
  assert.equal(cart.items.length, CART_ITEMS_LIMIT);
});

test("normalizeCart yields an empty cart for no rows", () => {
  const cart = normalizeCart({ items: [] });
  assert.deepEqual(cart, { items: [], totalCount: 0, totalPrice: null });
});
