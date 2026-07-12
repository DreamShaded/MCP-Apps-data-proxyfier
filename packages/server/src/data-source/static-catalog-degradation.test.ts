import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// `static-catalog.ts` кэширует данные на уровне модуля (см. GOTCHA плана) — чтобы
// проверить деградацию `getProduct()` для товара без богатой детали, а не для реального
// каталога (в текущем `data/market.json` деталь есть у всех 70 товаров — см. Task 1),
// собираем изолированную фикстуру во временном каталоге и импортируем модуль заново
// (уникальный query-суффикс обходит кэш ES-модулей Node).
test("getProduct: degrades to a single-image, spec-less detail when no rich capture exists", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-app-proxyfier-market-"));
  writeFileSync(
    join(dir, "market.json"),
    JSON.stringify({
      products: [
        {
          id: "no-detail",
          title: "Товар без детали",
          price: 100,
          oldPrice: null,
          discountPercent: null,
          imageUrl: "https://example.com/img.jpg",
          rating: null,
          reviewCount: null,
          url: null,
          brand: null,
        },
      ],
      details: {},
    }),
  );
  writeFileSync(join(dir, "deposits.json"), JSON.stringify({ deposits: [] }));

  process.env.MCP_DATA_DIR = dir;
  try {
    const mod = await import(`./static-catalog.js?fixture=${Date.now()}`);
    const detail = mod.getProduct("no-detail");
    assert.ok(detail, "деградация не возвращает null для известного id");
    assert.deepEqual(detail.images, ["https://example.com/img.jpg"]);
    assert.deepEqual(detail.specs, []);
    assert.equal(detail.description, null);
  } finally {
    delete process.env.MCP_DATA_DIR;
  }
});
