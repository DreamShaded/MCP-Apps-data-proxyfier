import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerGetProductTool } from "./get-product-tool.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import type { GetProductResult } from "./product.js";

/** Поднять сервер с одним инструментом `get_product` и связать с in-memory клиентом. */
async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerGetProductTool(server);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callGet(client: Client, id: string) {
  const result = await client.callTool({ name: "get_product", arguments: { id } });
  return result.structuredContent as unknown as GetProductResult;
}

test("get_product declares its UI via _meta.ui.resourceUri (same Megamarket app)", async () => {
  const { client, server } = await connect();
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "get_product");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, MEGAMARKET_UI_RESOURCE_URI);
  await server.close();
});

test("get_product returns the rich detail from the static catalog", async () => {
  const { client, server } = await connect();
  const sc = await callGet(client, "600018869646");
  assert.equal(sc.product?.title, "Беспроводные наушники Marshall Major V Black (5602)");
  assert.ok((sc.product?.specs.length ?? 0) > 0);
  assert.ok((sc.product?.images.length ?? 0) > 0);
  await server.close();
});

test("get_product returns null product, not a throw, for an unknown id", async () => {
  const { client, server } = await connect();
  const sc = await callGet(client, "редкий-id");
  assert.equal(sc.product, null);
  await server.close();
});
