import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerViewCartTool, type CartReader } from "./view-cart-tool.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import type { Cart, ViewCartResult } from "./cart.js";

const CART: Cart = {
  items: [
    { id: "p1", title: "Наушники A", price: 4990, quantity: 2, imageUrl: null, url: null, lineTotal: 9980 },
  ],
  totalCount: 2,
  totalPrice: 9980,
};

const fakeDriver = {
  withPage: async <T>(fn: (page: never) => Promise<T>): Promise<T> => fn({} as never),
  close: async () => {},
};

/** Поднять сервер с одним инструментом `view_cart` и связать с in-memory клиентом. */
async function connect(read: CartReader) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerViewCartTool(server, { driver: fakeDriver, read });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callView(client: Client) {
  const result = await client.callTool({ name: "view_cart", arguments: {} });
  return result.structuredContent as unknown as ViewCartResult;
}

test("view_cart declares its UI via _meta.ui.resourceUri (same Megamarket app)", async () => {
  const { client, server } = await connect(async () => CART);
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "view_cart");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

test("live read → returns the real cart state as structuredContent", async () => {
  let calls = 0;
  const { client, server } = await connect(async () => (calls++, CART));

  const sc = await callView(client);
  assert.equal(sc.fallback, false);
  assert.equal(sc.cart?.totalCount, 2);
  assert.equal(sc.cart?.items[0].quantity, 2);
  assert.equal(sc.cart?.totalPrice, 9980);
  assert.equal(calls, 1, "корзина читается живьём (не из кэша)");
  await server.close();
});

test("read failure → fallback flag, null cart, no throw", async () => {
  const { client, server } = await connect(async () => {
    throw new Error("antibot / timeout");
  });
  const sc = await callView(client);
  assert.equal(sc.fallback, true);
  assert.equal(sc.cart, null);
  assert.equal(sc.fetchedAt, null);
  await server.close();
});
