import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerAddToCartTool, type CartAdder } from "./add-to-cart-tool.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import type { AddToCartResult, Cart } from "./cart.js";

const CART: Cart = {
  items: [
    { id: "p1", title: "Наушники A", price: 4990, quantity: 1, imageUrl: "https://megamarket.ru/a.jpg", url: "https://megamarket.ru/p1", lineTotal: 4990 },
  ],
  totalCount: 1,
  totalPrice: 4990,
};

/** Фейк-драйвер браузера: тесты слоя инструмента не должны поднимать Chromium. */
const fakeDriver = {
  withPage: async <T>(fn: (page: never) => Promise<T>): Promise<T> => fn({} as never),
  close: async () => {},
};

/** Поднять сервер с одним инструментом `add_to_cart` и связать с in-memory клиентом. */
async function connect(add: CartAdder) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerAddToCartTool(server, { driver: fakeDriver, add });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callAdd(client: Client, id: string, url?: string) {
  const result = await client.callTool({ name: "add_to_cart", arguments: { id, ...(url ? { url } : {}) } });
  return result.structuredContent as unknown as AddToCartResult;
}

test("add_to_cart declares its UI via _meta.ui.resourceUri (same Megamarket app)", async () => {
  const { client, server } = await connect(async () => CART);
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "add_to_cart");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

test("live click → returns the resulting cart with added flag set", async () => {
  let calls = 0;
  const { client, server } = await connect(async () => (calls++, CART));

  const sc = await callAdd(client, "p1");
  assert.equal(sc.added, true);
  assert.equal(sc.fallback, false);
  assert.equal(sc.cart?.totalCount, 1);
  assert.equal(sc.cart?.items[0].title, "Наушники A");
  assert.equal(calls, 1, "живой клик дёргается ровно один раз");
  assert.ok(sc.fetchedAt, "успешное добавление помечается временем");
  await server.close();
});

test("id and url pass through to the live adder", async () => {
  let seen: { id: string; url?: string | null } | undefined;
  const { client, server } = await connect(async (_page, id, url) => {
    seen = { id, url };
    return CART;
  });
  await callAdd(client, "p1", "https://megamarket.ru/p1");
  assert.deepEqual(seen, { id: "p1", url: "https://megamarket.ru/p1" });
  await server.close();
});

test("click failure → fallback flag, null cart, not added, no throw", async () => {
  const { client, server } = await connect(async () => {
    throw new Error("antibot / кнопка не найдена");
  });
  const sc = await callAdd(client, "редкий-id");
  assert.equal(sc.added, false);
  assert.equal(sc.fallback, true);
  assert.equal(sc.cart, null);
  assert.equal(sc.fetchedAt, null);
  await server.close();
});
