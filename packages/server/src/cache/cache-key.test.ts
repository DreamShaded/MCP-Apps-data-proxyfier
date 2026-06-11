import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCacheKey } from "./cache-key.js";

test("ключ стабилен независимо от порядка полей", () => {
  const a = buildCacheKey("search_products", { query: "наушники", maxPrice: 5000 });
  const b = buildCacheKey("search_products", { maxPrice: 5000, query: "наушники" });
  assert.equal(a.id, b.id);
  assert.equal(a.canonical, b.canonical);
});

test("ключ стабилен независимо от регистра и пробелов в строках", () => {
  const a = buildCacheKey("search_products", { query: "Наушники" });
  const b = buildCacheKey("search_products", { query: "  наушники  " });
  assert.equal(a.id, b.id);
});

test("имя инструмента нечувствительно к регистру/пробелам", () => {
  const a = buildCacheKey("Search_Products", { query: "x" });
  const b = buildCacheKey(" search_products ", { query: "x" });
  assert.equal(a.id, b.id);
});

test("разные аргументы дают разные ключи", () => {
  const a = buildCacheKey("search_products", { query: "наушники", maxPrice: 5000 });
  const b = buildCacheKey("search_products", { query: "наушники", maxPrice: 4000 });
  assert.notEqual(a.id, b.id);
});

test("id читаем: префикс из имени инструмента + хэш", () => {
  const { id } = buildCacheKey("search_products", { query: "x" });
  assert.match(id, /^search_products-[0-9a-f]{16}$/);
});

test("вложенные объекты тоже нормализуются по порядку ключей", () => {
  const a = buildCacheKey("get_product", { id: "p1", opts: { color: "black", size: "m" } });
  const b = buildCacheKey("get_product", { opts: { size: "m", color: "black" }, id: "p1" });
  assert.equal(a.id, b.id);
});
