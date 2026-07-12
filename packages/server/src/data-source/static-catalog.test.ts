import { test } from "node:test";
import assert from "node:assert/strict";
import { getCatalogProduct, getProduct, searchProducts } from "./static-catalog.js";

// Данные читаются из committed `packages/server/data/market.json` (сгенерирован
// `pnpm update:data` из pages/) — тесты опираются на товар "Marshall" (id 600018869646),
// который стабильно присутствует во всех трёх снапшотах Megamarket (см. план миграции).

test("searchProducts: matches by title/brand substring, case-insensitive", () => {
  const byBrand = searchProducts("marshall", {});
  assert.ok(byBrand.some((p) => p.id === "600018869646"), "поиск по бренду в другом регистре находит товар");

  const byTitle = searchProducts("наушники", {});
  assert.ok(byTitle.length > 0, "поиск по слову из названия возвращает результаты");
});

test("searchProducts: empty result for a query matching nothing", () => {
  assert.deepEqual(searchProducts("несуществующий-товар-xyz-000", {}), []);
});

test("searchProducts: applies priceMin/priceMax filters and caps at 12", () => {
  const cheap = searchProducts("наушники", { priceMax: 1 });
  assert.deepEqual(cheap, [], "ценовой фильтр отсекает все результаты при недостижимом потолке");

  const all = searchProducts("а", {}); // широкий запрос — почти все товары содержат «а»
  assert.ok(all.length <= 12, "выдача не превышает лимит в 12 позиций");
});

test("getCatalogProduct: known id returns the flat product", () => {
  const product = getCatalogProduct("600018869646");
  assert.equal(product?.title, "Беспроводные наушники Marshall Major V Black (5602)");
});

test("getCatalogProduct: unknown id returns null", () => {
  assert.equal(getCatalogProduct("not-a-real-id"), null);
});

test("getProduct: rich detail has gallery + specs for the Marshall snapshot", () => {
  const detail = getProduct("600018869646");
  assert.ok(detail);
  assert.ok(detail!.images.length > 0, "у Marshall снята галерея");
  assert.ok(detail!.specs.length > 0, "у Marshall сняты характеристики");
});

test("getProduct: unknown id returns null, not a throw", () => {
  assert.equal(getProduct("not-a-real-id"), null);
});
