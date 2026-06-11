import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerCheckoutTool, type CheckoutReader } from "./checkout-tool.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { CART_URL } from "./scrape-cart.js";
import type { Cart, CheckoutResult } from "./cart.js";

const CART: Cart = {
  items: [{ id: "p1", title: "Наушники A", price: 4990, quantity: 2, imageUrl: null, url: null, lineTotal: 9980 }],
  totalCount: 2,
  totalPrice: 9980,
};

const fakeDriver = {
  withPage: async <T>(fn: (page: never) => Promise<T>): Promise<T> => fn({} as never),
  close: async () => {},
};

/** Поднять сервер с одним инструментом `checkout` и связать с in-memory клиентом. */
async function connect(read: CheckoutReader) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerCheckoutTool(server, { driver: fakeDriver, read });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callCheckout(client: Client) {
  const result = await client.callTool({ name: "checkout", arguments: {} });
  return result.structuredContent as unknown as CheckoutResult;
}

test("checkout declares its UI via _meta.ui.resourceUri (same Megamarket app)", async () => {
  const { client, server } = await connect(async () => CART);
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "checkout");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

test("handoff → returns the real cart URL and authoritative cart snapshot", async () => {
  let calls = 0;
  const { client, server } = await connect(async () => (calls++, CART));

  const sc = await callCheckout(client);
  assert.equal(sc.url, CART_URL, "ссылка хэндофа — реальная корзина Megamarket");
  assert.equal(sc.fallback, false);
  assert.equal(sc.cart?.totalCount, 2, "корзина заполнена товарами из add_to_cart");
  assert.equal(sc.cart?.totalPrice, 9980);
  assert.equal(calls, 1, "корзина читается живьём (не из кэша)");
  await server.close();
});

test("handoff failure → fallback, null cart, but URL still returned", async () => {
  const { client, server } = await connect(async () => {
    throw new Error("antibot / timeout");
  });
  const sc = await callCheckout(client);
  assert.equal(sc.fallback, true);
  assert.equal(sc.cart, null);
  assert.equal(sc.fetchedAt, null);
  assert.equal(sc.url, CART_URL, "ссылку отдаём всегда — окно можно открыть руками");
  await server.close();
});
