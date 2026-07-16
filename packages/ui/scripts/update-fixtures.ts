import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Пересобрать фикстуры дев-превью (`pnpm update:fixtures`).
 *
 * Поднимает **настоящий** сервер по stdio и снимает его реальные ответы: превью обязано
 * показывать то, что отдаёт сервер, а не то, что удобно написать руками. Иначе превью
 * начнёт врать про дизайн ровно тогда, когда меняется DTO.
 *
 * Даты доставки в фикстуре заморожены на момент снятия — превью для проверки вёрстки, а
 * не для проверки календаря. Протухли подписи вроде «Завтра» — просто перезапустите.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = resolve(here, "../../server/dist/index.js");
const OUT = resolve(here, "../src/preview/fixtures.json");

/** Товары, которые кладём в корзину: две разные позиции, чтобы список был не из одной строки. */
const CART_IDS = ["600018869646", "600005366927"];

interface ToolResult {
  structuredContent?: unknown;
}

async function main(): Promise<void> {
  if (!existsSync(SERVER_ENTRY)) {
    throw new Error(`${SERVER_ENTRY} не найден — сначала "pnpm build"`);
  }

  const client = new Client({ name: "update-fixtures", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: "node", args: [SERVER_ENTRY] }));

  try {
    const call = async (name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> => {
      const r = (await client.callTool({ name, arguments: args })) as ToolResult;
      if (!r.structuredContent) throw new Error(`${name} не вернул structuredContent`);
      return r.structuredContent as Record<string, unknown>;
    };

    const grid = await call("search_products_widget", { query: "наушники" });

    // Тот же порядок, которому скилл учит агента: календарь → дата → поиск со сроком.
    const calendar = (await call("get_delivery_calendar", {})) as {
      upcoming: Array<{ weekday: string; date: string }>;
    };
    const friday = calendar.upcoming.find((d) => d.weekday === "пятница");
    if (!friday) throw new Error("в ближайших 7 днях нет пятницы — сломан календарь");
    const byFriday = await call("search_products_advised", {
      query: "наушники",
      filters: { deliveryBy: friday.date },
    });

    const products = grid.products as Array<{ id: string }>;
    if (products.length === 0) throw new Error("пустая выдача — фикстура бессмысленна");
    const detail = (await call("get_product", { id: products[0].id })).product;

    // Корзина набирается настоящими add_to_cart — состояние живёт в процессе сервера.
    for (const id of CART_IDS) {
      const { added } = (await call("add_to_cart", { id })) as { added: boolean };
      if (!added) throw new Error(`add_to_cart(${id}): товара нет в каталоге — поправь CART_IDS`);
    }
    const { cart } = (await call("view_cart", {})) as { cart: { totalCount: number } };

    const out = {
      _note:
        "Снято с живого сервера скриптом `pnpm update:fixtures`. Руками не править: превью должно показывать реальные ответы. Даты доставки заморожены на момент снятия.",
      generatedAt: new Date().toISOString(),
      friday: friday.date,
      grid,
      byFriday,
      detail,
      cart,
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

    console.error(`[update:fixtures] выдача: ${products.length} товаров`);
    console.error(`[update:fixtures] до пятницы (${friday.date}): ${(byFriday.products as unknown[]).length}`);
    console.error(`[update:fixtures] корзина: ${cart.totalCount} товаров`);
    console.error(`[update:fixtures] готово → ${join("src/preview", "fixtures.json")}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("[update:fixtures] fatal:", error);
  process.exit(1);
});
