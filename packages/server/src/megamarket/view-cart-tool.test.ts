import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import * as cartStore from "../data-source/cart-store.js";
import { registerViewCartTool } from "./view-cart-tool.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import type { ViewCartResult } from "./cart.js";

beforeEach(() => cartStore.clear());

/** Поднять сервер с одним инструментом `view_cart` и связать с in-memory клиентом. */
async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerViewCartTool(server);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callView(client: Client) {
  const result = await client.callTool({ name: "view_cart", arguments: {} });
  return result.structuredContent as unknown as ViewCartResult;
}

test("view_cart declares its UI via _meta.ui.resourceUri (same Megamarket app)", async () => {
  const { client, server } = await connect();
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "view_cart");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

test("empty cart → totalCount 0, empty items", async () => {
  const { client, server } = await connect();
  const sc = await callView(client);
  assert.deepEqual(sc.cart, { items: [], totalCount: 0, totalPrice: 0 });
  await server.close();
});

test("reflects state added by add_to_cart (shared in-memory store)", async () => {
  cartStore.add("600018869646");
  const { client, server } = await connect();
  const sc = await callView(client);
  assert.equal(sc.cart.totalCount, 1);
  assert.equal(sc.cart.items[0].id, "600018869646");
  await server.close();
});
