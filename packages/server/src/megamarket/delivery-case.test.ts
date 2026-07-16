import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";
import { GET_DELIVERY_CALENDAR_TOOL } from "./delivery-calendar-tool.js";
import { SEARCH_PRODUCTS_TOOL, SEARCH_PRODUCTS_ADVISED_TOOL } from "./search-products-tool.js";
import { SEARCH_RESULT_LIMIT } from "../data-source/static-catalog.js";
import type { SearchResult } from "./product.js";

const FAKE_HTML = "<!doctype html><html><body>ui</body></html>";

async function connectTestClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ pingHtml: FAKE_HTML, megamarketHtml: FAKE_HTML });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

function search(client: Client, name: string, query: string, filters?: unknown) {
  return client.callTool({ name, arguments: { query, ...(filters ? { filters } : {}) } });
}

function productsOf(r: Awaited<ReturnType<typeof search>>): SearchResult["products"] {
  return (r.structuredContent as unknown as SearchResult).products;
}

// Кейсы 1 и 2 демо: ровно 9 карточек — грид 3×3 в узком чат-iframe.
test("«наушники» returns exactly 9 products — the demo grid", async () => {
  const { client, server } = await connectTestClient();
  const products = productsOf(await search(client, SEARCH_PRODUCTS_TOOL, "наушники"));
  assert.equal(products.length, 9);
  assert.equal(products.length, SEARCH_RESULT_LIMIT);
  await server.close();
});

// Виджету нужны бренд и шумодав, чтобы фильтровать грид без похода на сервер.
test("every product carries the fields the widget filters on", async () => {
  const { client, server } = await connectTestClient();
  const products = productsOf(await search(client, SEARCH_PRODUCTS_TOOL, "наушники"));
  for (const p of products) {
    assert.ok(p.brand, `${p.id} must have a brand for the filter chips`);
    assert.ok(p.anc === true || p.anc === false || p.anc === null, `${p.id} anc must be tri-state`);
    assert.ok(p.delivery.date.match(/^\d{4}-\d{2}-\d{2}$/), `${p.id} must carry a delivery date`);
    assert.ok(p.delivery.label.length > 0);
  }
  const brands = new Set(products.map((p) => p.brand));
  assert.ok(brands.size >= 3, `demo grid needs several brands to filter, got ${brands.size}`);
  assert.ok(products.some((p) => p.anc === true) && products.some((p) => p.anc !== true), "anc filter must split the grid");
  await server.close();
});

/**
 * `anc` обязан читаться только из «Системы активного шумоподавления». В каталоге есть и
 * «Шумоподавление микрофона» — если ловить его, флаг у товара будет от чужой характеристики.
 */
test("anc is read from the ANC spec only, never from «Шумоподавление микрофона»", async () => {
  const { client, server } = await connectTestClient();
  const products = productsOf(await search(client, SEARCH_PRODUCTS_TOOL, "наушники"));

  for (const p of products) {
    const detail = await client.callTool({ name: "get_product", arguments: { id: p.id } });
    const specs = ((detail.structuredContent as { product?: { specs?: Array<{ name: string; value: string }> } })
      .product?.specs) ?? [];
    const anc = specs.find((s) => /активн[а-яё]*\s+шумоподавлени/i.test(s.name));
    const micOnly = !anc && specs.some((s) => /шумоподавлени/i.test(s.name));

    if (micOnly) assert.equal(p.anc, null, `${p.title}: у товара только «шумоподавление микрофона» — anc обязан быть null`);
    if (anc) assert.equal(p.anc, /^да$/i.test(anc.value.trim()), `${p.title}: anc разошёлся с характеристикой`);
    if (!anc && !micOnly) assert.equal(p.anc, null, `${p.title}: характеристики нет — anc обязан быть null`);
  }
  await server.close();
});

test("get_delivery_calendar resolves weekday names to concrete dates", async () => {
  const { client, server } = await connectTestClient();
  const r = await client.callTool({ name: GET_DELIVERY_CALENDAR_TOOL, arguments: {} });
  const c = r.structuredContent as unknown as {
    today: { date: string };
    tomorrow: { date: string };
    upcoming: Array<{ weekday: string; date: string }>;
  };
  assert.match(c.today.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(c.upcoming.length, 7);
  // «Пятница» обязана находиться в любой день недели — иначе кейс не отработает.
  assert.ok(c.upcoming.some((d) => d.weekday === "пятница"), "next 7 days always contain a Friday");
  await server.close();
});

// Календарь без UI — это справка агенту, а не виджет.
test("get_delivery_calendar declares no ui resource", async () => {
  const { client, server } = await connectTestClient();
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === GET_DELIVERY_CALENDAR_TOOL);
  assert.ok(tool);
  assert.equal((tool._meta as { ui?: unknown } | undefined)?.ui, undefined);
  await server.close();
});

/** Ровно тот порядок, которому скилл учит агента: календарь → дата → поиск с deliveryBy. */
async function searchByFriday(client: Client) {
  const cal = await client.callTool({ name: GET_DELIVERY_CALENDAR_TOOL, arguments: {} });
  const { upcoming } = cal.structuredContent as unknown as { upcoming: Array<{ weekday: string; date: string }> };
  const friday = upcoming.find((d) => d.weekday === "пятница");
  assert.ok(friday);
  const all = productsOf(await search(client, SEARCH_PRODUCTS_ADVISED_TOOL, "наушники"));
  const byFriday = productsOf(await search(client, SEARCH_PRODUCTS_ADVISED_TOOL, "наушники", { deliveryBy: friday.date }));
  return { friday: friday.date, all, byFriday };
}

// Кейс 3 демо целиком. Показателен, только если фильтр реально делит выдачу.
test("the «до пятницы» case: calendar → deliveryBy → a strict, non-empty subset", async () => {
  const { client, server } = await connectTestClient();
  const { friday, all, byFriday } = await searchByFriday(client);

  assert.ok(byFriday.length > 0, "кто-то обязан успевать — иначе демо показывает пустоту");
  assert.ok(byFriday.length < all.length, "кто-то обязан НЕ успевать — иначе фильтр не виден");
  for (const p of byFriday) {
    assert.ok(p.delivery.date <= friday, `${p.title} приедет ${p.delivery.date}, позже пятницы ${friday}`);
  }
  await server.close();
});

/**
 * Срок обязан сужать показанную выдачу, а не переспрашивать каталог: если под фильтром
 * всплывёт карточка, которой в гриде не было, зал увидит фокус, а не фильтрацию.
 */
test("deliveryBy never surfaces products that were not in the unfiltered grid", async () => {
  const { client, server } = await connectTestClient();
  const { all, byFriday } = await searchByFriday(client);
  const shown = new Set(all.map((p) => p.id));
  for (const p of byFriday) {
    assert.ok(shown.has(p.id), `${p.title} появился из глубины каталога — его не было в выдаче`);
  }
  await server.close();
});

/**
 * Демо не должно зависеть от дня недели: при любом сроке от «завтра» до «+7 дней»
 * выдача обязана делиться — иначе в какую-то среду фильтр покажется сломанным.
 */
test("the delivery spread splits the grid for every deadline in the coming week", async () => {
  const { client, server } = await connectTestClient();
  const cal = await client.callTool({ name: GET_DELIVERY_CALENDAR_TOOL, arguments: {} });
  const { upcoming } = cal.structuredContent as unknown as { upcoming: Array<{ date: string; inDays: number }> };
  const all = productsOf(await search(client, SEARCH_PRODUCTS_ADVISED_TOOL, "наушники"));

  for (const day of upcoming) {
    const hit = productsOf(await search(client, SEARCH_PRODUCTS_ADVISED_TOOL, "наушники", { deliveryBy: day.date }));
    assert.ok(hit.length > 0, `дедлайн +${day.inDays} дн.: никто не успевает — демо покажет пустоту`);
    assert.ok(hit.length < all.length, `дедлайн +${day.inDays} дн.: успевают все — фильтр не виден`);
  }
  await server.close();
});

test("deliveryBy filters out everything that arrives later", async () => {
  const { client, server } = await connectTestClient();
  const cal = await client.callTool({ name: GET_DELIVERY_CALENDAR_TOOL, arguments: {} });
  const { tomorrow } = cal.structuredContent as unknown as { tomorrow: { date: string } };

  const products = productsOf(await search(client, SEARCH_PRODUCTS_ADVISED_TOOL, "наушники", { deliveryBy: tomorrow.date }));
  assert.ok(products.length > 0, "хоть что-то обязано приезжать завтра");
  for (const p of products) {
    assert.equal(p.delivery.days, 1, `${p.title} не приедет завтра`);
    assert.equal(p.delivery.label, "Завтра");
  }
  await server.close();
});

test("an impossible deadline yields an empty list, not an error", async () => {
  const { client, server } = await connectTestClient();
  const r = await search(client, SEARCH_PRODUCTS_ADVISED_TOOL, "наушники", { deliveryBy: "2000-01-01" });
  assert.deepEqual(productsOf(r), []);
  await server.close();
});

test("a malformed deliveryBy is rejected at the boundary", async () => {
  const { client, server } = await connectTestClient();
  const r = await search(client, SEARCH_PRODUCTS_ADVISED_TOOL, "наушники", { deliveryBy: "пятница" });
  assert.equal(r.isError, true, "свободный текст вместо даты обязан отлетать валидацией");
  await server.close();
});
