import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  registerSearchProductsTools,
  SEARCH_PRODUCTS_TOOL,
  SEARCH_PRODUCTS_WIDGET_TOOL,
  SEARCH_PRODUCTS_ADVISED_TOOL,
} from "./search-products-tool.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { SHOPPING_ADVISOR_SKILL_URI } from "./shopping-advisor-skill.js";
import type { SearchResult } from "./product.js";

/** Поднять сервер с тремя вариантами поиска и связать с in-memory клиентом. */
async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerSearchProductsTools(server);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

/** Привязка UI объявляется на регистрации и приезжает клиенту в `tools/list`. */
async function uiResourceUriOf(client: Client, name: string) {
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === name);
  assert.ok(tool, `${name} should be listed`);
  return (tool._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri;
}

function callSearch(client: Client, name: string, query: string, filters?: unknown) {
  return client.callTool({ name, arguments: { query, ...(filters ? { filters } : {}) } });
}

function textOf(result: Awaited<ReturnType<typeof callSearch>>): string {
  return (result.content as Array<{ text: string }>)[0].text;
}

function productsOf(result: Awaited<ReturnType<typeof callSearch>>): SearchResult["products"] {
  return (result.structuredContent as unknown as SearchResult).products;
}

const ALL_RUNGS = [SEARCH_PRODUCTS_TOOL, SEARCH_PRODUCTS_WIDGET_TOOL, SEARCH_PRODUCTS_ADVISED_TOOL];

test("all three demo rungs are listed as separate tools", async () => {
  const { client, server } = await connect();
  const { tools } = await client.listTools();
  for (const name of ALL_RUNGS) {
    assert.ok(tools.some((t) => t.name === name), `${name} should be listed`);
  }
  await server.close();
});

// Ступень 2 демо стоит ровно на этом: у текстового варианта UI не объявлен.
test("search_products declares NO ui resource — the no-UI rung", async () => {
  const { client, server } = await connect();
  assert.equal(await uiResourceUriOf(client, SEARCH_PRODUCTS_TOOL), undefined);
  await server.close();
});

test("search_products_widget declares its UI via _meta.ui.resourceUri", async () => {
  const { client, server } = await connect();
  assert.equal(await uiResourceUriOf(client, SEARCH_PRODUCTS_WIDGET_TOOL), MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

test("search_products_advised declares the same UI as the widget rung", async () => {
  const { client, server } = await connect();
  assert.equal(await uiResourceUriOf(client, SEARCH_PRODUCTS_ADVISED_TOOL), MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

// Ступень 4 держится на описании: пропадёт ссылка на методичку — агент её не прочитает.
test("search_products_advised points the agent at the shopping-advisor skill", async () => {
  const { client, server } = await connect();
  const { tools } = await client.listTools();
  const advised = tools.find((t) => t.name === SEARCH_PRODUCTS_ADVISED_TOOL);
  assert.ok(String(advised?.description).includes(SHOPPING_ADVISOR_SKILL_URI));
  await server.close();
});

test("the plain widget rung does not tell the agent to read a skill", async () => {
  const { client, server } = await connect();
  const { tools } = await client.listTools();
  const widget = tools.find((t) => t.name === SEARCH_PRODUCTS_WIDGET_TOOL);
  assert.ok(!String(widget?.description).includes(SHOPPING_ADVISOR_SKILL_URI));
  await server.close();
});

test("every rung returns the same matches from the static catalog", async () => {
  const { client, server } = await connect();
  for (const name of ALL_RUNGS) {
    const products = productsOf(await callSearch(client, name, "marshall"));
    assert.ok(products.some((p) => p.id === "600018869646"), `${name} should find the Marshall item`);
  }
  await server.close();
});

// Без виджета текстовый канал — единственный носитель данных, поэтому позиции в нём целиком.
test("the no-UI rung lists products as text, the widget rung only summarises", async () => {
  const { client, server } = await connect();

  const textOnly = textOf(await callSearch(client, SEARCH_PRODUCTS_TOOL, "marshall"));
  assert.match(textOnly, /₽/, "no-UI rung must carry prices as text");
  assert.ok(textOnly.split("\n").length > 2, "no-UI rung must carry one line per item");

  // Сводка эхом повторяет сам запрос, поэтому проверяем отсутствие деталей позиций,
  // а не отсутствие слова «marshall».
  const widget = textOf(await callSearch(client, SEARCH_PRODUCTS_WIDGET_TOOL, "marshall"));
  assert.doesNotMatch(widget, /₽/, "widget rung leaves per-item detail to the widget");
  assert.equal(widget.split("\n").length, 1, "widget rung summarises in a single line");

  await server.close();
});

test("search_products returns an empty list, not an error, for an unmatched query", async () => {
  const { client, server } = await connect();
  const result = await callSearch(client, SEARCH_PRODUCTS_TOOL, "несуществующий-товар-xyz-000");
  assert.deepEqual(productsOf(result), []);
  assert.match(textOf(result), /ничего не найдено/);
  await server.close();
});

test("filters narrow the static catalog results on every rung", async () => {
  const { client, server } = await connect();
  for (const name of ALL_RUNGS) {
    const products = productsOf(await callSearch(client, name, "наушники", { priceMax: 1 }));
    assert.deepEqual(products, [], `${name} should honour filters`);
  }
  await server.close();
});
