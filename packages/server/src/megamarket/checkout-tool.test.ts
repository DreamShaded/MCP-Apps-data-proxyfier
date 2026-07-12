import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import * as cartStore from "../data-source/cart-store.js";
import { registerCheckoutTool } from "./checkout-tool.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import type { CheckoutResult } from "./cart.js";

beforeEach(() => cartStore.clear());

/** Поднять сервер с одним инструментом `checkout` и связать с in-memory клиентом. */
async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerCheckoutTool(server);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callCheckout(client: Client) {
  const result = await client.callTool({ name: "checkout", arguments: {} });
  return result.structuredContent as unknown as CheckoutResult;
}

test("checkout declares its UI via _meta.ui.resourceUri (same Megamarket app)", async () => {
  const { client, server } = await connect();
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "checkout");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

test("confirms the filled cart snapshot and stamps confirmedAt", async () => {
  cartStore.add("600018869646");
  const { client, server } = await connect();
  const sc = await callCheckout(client);
  assert.equal(sc.cart.totalCount, 1, "снимок корзины на момент оформления");
  assert.ok(sc.confirmedAt);
  await server.close();
});

test("clears the cart after confirming (next view_cart is empty)", async () => {
  cartStore.add("600018869646");
  const { client, server } = await connect();
  await callCheckout(client);
  assert.deepEqual(cartStore.view(), { items: [], totalCount: 0, totalPrice: 0 });
  await server.close();
});

test("empty cart still confirms (no throw)", async () => {
  const { client, server } = await connect();
  const sc = await callCheckout(client);
  assert.deepEqual(sc.cart, { items: [], totalCount: 0, totalPrice: 0 });
  assert.ok(sc.confirmedAt);
  await server.close();
});
