import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFilters, brandsOf, EMPTY_FILTERS, hasAncData, isEmpty } from "./product-filters.js";
import type { Product } from "./types";

function product(over: Partial<Product> & Pick<Product, "id">): Product {
  return {
    title: "Наушники",
    price: 5000,
    oldPrice: null,
    discountPercent: null,
    imageUrl: null,
    rating: null,
    reviewCount: null,
    url: null,
    brand: "JBL",
    anc: true,
    delivery: { days: 1, date: "2026-07-17", label: "Завтра" },
    ...over,
  };
}

const CATALOG: Product[] = [
  product({ id: "1", brand: "Marshall", anc: true }),
  product({ id: "2", brand: "JBL", anc: false }),
  product({ id: "3", brand: "Marshall", anc: null }),
  product({ id: "4", brand: "Sony", anc: true }),
];

test("empty filters keep every product", () => {
  assert.equal(applyFilters(CATALOG, EMPTY_FILTERS).length, CATALOG.length);
  assert.equal(isEmpty(EMPTY_FILTERS), true);
});

test("brand filter keeps only that brand", () => {
  const r = applyFilters(CATALOG, { brand: "Marshall", ancOnly: false });
  assert.deepEqual(r.map((p) => p.id), ["1", "3"]);
});

// «Характеристика не указана» — не то же самое, что «шумодава нет»: обещать его нельзя.
test("ancOnly excludes both anc:false and anc:null", () => {
  const r = applyFilters(CATALOG, { brand: null, ancOnly: true });
  assert.deepEqual(r.map((p) => p.id), ["1", "4"]);
});

test("brand and anc filters combine", () => {
  const r = applyFilters(CATALOG, { brand: "Marshall", ancOnly: true });
  assert.deepEqual(r.map((p) => p.id), ["1"]);
});

test("a filter combination with no matches yields an empty list, not an error", () => {
  assert.deepEqual(applyFilters(CATALOG, { brand: "Sony", ancOnly: false }).map((p) => p.id), ["4"]);
  assert.deepEqual(applyFilters(CATALOG, { brand: "JBL", ancOnly: true }), []);
});

// Порядок чипов не должен скакать между рендерами.
test("brandsOf returns unique brands in first-seen order", () => {
  assert.deepEqual(brandsOf(CATALOG), ["Marshall", "JBL", "Sony"]);
});

test("brandsOf skips products without a brand", () => {
  assert.deepEqual(brandsOf([product({ id: "5", brand: null })]), []);
});

test("hasAncData is false only when no product knows its anc", () => {
  assert.equal(hasAncData(CATALOG), true);
  assert.equal(hasAncData([product({ id: "6", anc: null })]), false);
});

test("applyFilters does not mutate the input", () => {
  const before = CATALOG.map((p) => p.id);
  applyFilters(CATALOG, { brand: "Sony", ancOnly: true });
  assert.deepEqual(CATALOG.map((p) => p.id), before);
});
