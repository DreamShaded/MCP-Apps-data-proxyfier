import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import * as cartStore from "../data-source/cart-store.js";
import { registerAddToCartTool } from "./add-to-cart-tool.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import type { AddToCartResult } from "./cart.js";

// Корзина — модульный singleton (см. `data-source/cart-store.ts`): сбрасываем между тестами.
beforeEach(() => cartStore.clear());

/** Поднять сервер с одним инструментом `add_to_cart` и связать с in-memory клиентом. */
async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerAddToCartTool(server);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callAdd(client: Client, id: string) {
  const result = await client.callTool({ name: "add_to_cart", arguments: { id } });
  return result.structuredContent as unknown as AddToCartResult;
}

test("add_to_cart declares its UI via _meta.ui.resourceUri (same Megamarket app)", async () => {
  const { client, server } = await connect();
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "add_to_cart");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

test("known id → added, returns the updated cart", async () => {
  const { client, server } = await connect();
  const sc = await callAdd(client, "600018869646");
  assert.equal(sc.added, true);
  assert.equal(sc.cart.totalCount, 1);
  assert.equal(sc.cart.items[0].title, "Беспроводные наушники Marshall Major V Black (5602)");
  await server.close();
});

test("unknown id → not added, cart unchanged, no throw", async () => {
  const { client, server } = await connect();
  const sc = await callAdd(client, "редкий-id");
  assert.equal(sc.added, false);
  assert.deepEqual(sc.cart, { items: [], totalCount: 0, totalPrice: 0 });
  await server.close();
});
