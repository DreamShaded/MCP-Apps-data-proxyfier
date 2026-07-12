import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerSearchProductsTool } from "./search-products-tool.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import type { SearchResult } from "./product.js";

/** Поднять сервер с одним инструментом `search_products` и связать с in-memory клиентом. */
async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerSearchProductsTool(server);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callSearch(client: Client, query: string, filters?: unknown) {
  const result = await client.callTool({ name: "search_products", arguments: { query, ...(filters ? { filters } : {}) } });
  return result.structuredContent as unknown as SearchResult;
}

test("search_products declares its UI via _meta.ui.resourceUri", async () => {
  const { client, server } = await connect();
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "search_products");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

test("search_products returns matches from the static catalog", async () => {
  const { client, server } = await connect();
  const sc = await callSearch(client, "marshall");
  assert.ok(sc.products.some((p) => p.id === "600018869646"));
  await server.close();
});

test("search_products returns an empty list, not an error, for an unmatched query", async () => {
  const { client, server } = await connect();
  const sc = await callSearch(client, "несуществующий-товар-xyz-000");
  assert.deepEqual(sc.products, []);
  await server.close();
});

test("filters narrow the static catalog results", async () => {
  const { client, server } = await connect();
  const sc = await callSearch(client, "наушники", { priceMax: 1 });
  assert.deepEqual(sc.products, []);
  await server.close();
});
