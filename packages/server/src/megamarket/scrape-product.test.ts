import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeProductDetail, type RawProductDetail } from "./scrape-product.js";

test("parses prices, rating and reviews from messy site text", () => {
  const raw: RawProductDetail = {
    id: "p1",
    title: "Наушники",
    priceText: "4 990 ₽",
    oldPriceText: "от 6 990 ₽",
    ratingText: "4,7",
    reviewText: "120 отзывов",
  };
  const d = normalizeProductDetail(raw);
  assert.equal(d.price, 4990);
  assert.equal(d.oldPrice, 6990);
  assert.equal(d.rating, 4.7);
  assert.equal(d.reviewCount, 120);
  assert.equal(d.discountPercent, 29);
});

test("first gallery image becomes the main imageUrl; gallery built absolute and capped", () => {
  const images = Array.from({ length: 9 }, (_, i) => `/img/${i}.jpg`);
  const d = normalizeProductDetail({ id: "p1", title: "X", priceText: "1", images });
  assert.equal(d.imageUrl, "https://megamarket.ru/img/0.jpg");
  assert.equal(d.images.length, 6, "gallery capped to GALLERY_LIMIT");
  assert.equal(d.images[0], "https://megamarket.ru/img/0.jpg");
});

test("keeps absolute gallery URLs untouched", () => {
  const d = normalizeProductDetail({ id: "p1", title: "X", priceText: "1", images: ["https://cdn.example/a.jpg"] });
  assert.equal(d.images[0], "https://cdn.example/a.jpg");
});

test("drops spec rows missing a name or value, caps to limit", () => {
  const specs = [
    { name: "Тип", value: "Полноразмерные" },
    { name: "Пустое", value: null },
    { name: null, value: "сирота" },
    ...Array.from({ length: 15 }, (_, i) => ({ name: `K${i}`, value: `V${i}` })),
  ];
  const d = normalizeProductDetail({ id: "p1", title: "X", priceText: "1", specs });
  assert.equal(d.specs.length, 12, "specs capped to SPECS_LIMIT");
  assert.deepEqual(d.specs[0], { name: "Тип", value: "Полноразмерные" });
  assert.ok(!d.specs.some((s) => !s.name || !s.value));
});

test("missing optional fields degrade to null/empty, not zero or NaN", () => {
  const d = normalizeProductDetail({ id: "p1", title: "Без цены" });
  assert.equal(d.price, null);
  assert.equal(d.oldPrice, null);
  assert.equal(d.discountPercent, null);
  assert.equal(d.rating, null);
  assert.equal(d.imageUrl, null);
  assert.deepEqual(d.images, []);
  assert.deepEqual(d.specs, []);
  assert.equal(d.description, null);
});

test("falls back to title for id, and to a placeholder title when both missing", () => {
  assert.equal(normalizeProductDetail({ title: "Имя", priceText: "1" }).id, "Имя");
  const empty = normalizeProductDetail({ priceText: "1" });
  assert.equal(empty.id, "unknown");
  assert.equal(empty.title, "Без названия");
});

test("builds absolute product url from a relative card href", () => {
  const d = normalizeProductDetail({ id: "p1", title: "X", priceText: "1", url: "/catalog/details/p1/" });
  assert.equal(d.url, "https://megamarket.ru/catalog/details/p1/");
});
