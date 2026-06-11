import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeProducts, type RawProduct } from "./scrape-search.js";

test("parses prices, rating and reviews from messy site text", () => {
  const raw: RawProduct[] = [
    { id: "p1", title: "Наушники", priceText: "4 990 ₽", oldPriceText: "от 6 990 ₽", ratingText: "4,7", reviewText: "120 отзывов", imageUrl: "/img/a.jpg", url: "/catalog/p1" },
  ];
  const [p] = normalizeProducts(raw);
  assert.equal(p.price, 4990);
  assert.equal(p.oldPrice, 6990);
  assert.equal(p.rating, 4.7);
  assert.equal(p.reviewCount, 120);
});

test("computes discount from prices when no explicit badge", () => {
  const [p] = normalizeProducts([{ title: "X", priceText: "5000", oldPriceText: "10000" }]);
  assert.equal(p.discountPercent, 50);
});

test("prefers an explicit discount badge over the computed one", () => {
  const [p] = normalizeProducts([{ title: "X", priceText: "5000", oldPriceText: "10000", discountText: "-45%" }]);
  assert.equal(p.discountPercent, 45);
});

test("missing price/rating degrade to null, not zero or NaN", () => {
  const [p] = normalizeProducts([{ title: "Без цены", priceText: null, ratingText: null }]);
  assert.equal(p.price, null);
  assert.equal(p.rating, null);
  assert.equal(p.discountPercent, null);
});

test("skips cards without a title (skeletons / junk)", () => {
  const out = normalizeProducts([{ title: null, priceText: "100" }, { title: "Реальный", priceText: "200" }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "Реальный");
});

test("filters by price corridor (priceMin/priceMax)", () => {
  const raw: RawProduct[] = [
    { title: "Дешёвый", priceText: "1000" },
    { title: "Целевой", priceText: "4000" },
    { title: "Дорогой", priceText: "9000" },
  ];
  const out = normalizeProducts(raw, { priceMin: 2000, priceMax: 5000 });
  assert.deepEqual(out.map((p) => p.title), ["Целевой"]);
});

test("builds absolute URLs for relative image/href", () => {
  const [p] = normalizeProducts([{ title: "X", priceText: "1", imageUrl: "/img/a.jpg", url: "catalog/p1" }]);
  assert.equal(p.imageUrl, "https://megamarket.ru/img/a.jpg");
  assert.equal(p.url, "https://megamarket.ru/catalog/p1");
});

test("keeps absolute URLs untouched", () => {
  const [p] = normalizeProducts([{ title: "X", priceText: "1", imageUrl: "https://cdn.example/a.jpg" }]);
  assert.equal(p.imageUrl, "https://cdn.example/a.jpg");
});

test("caps the result list to the requested limit", () => {
  const raw: RawProduct[] = Array.from({ length: 20 }, (_, i) => ({ title: `T${i}`, priceText: "1" }));
  assert.equal(normalizeProducts(raw, {}, 12).length, 12);
});
