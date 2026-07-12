import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerSearchDepositsTool } from "./search-deposits-tool.js";
import { DEPOSITS_UI_RESOURCE_URI } from "./deposits-ui-resource.js";
import type { SearchDepositsResult } from "./deposit.js";

/** Поднять сервер с одним инструментом `search_deposits` и связать с in-memory клиентом. */
async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerSearchDepositsTool(server);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function callSearch(client: Client, amount: number, termMonths: number) {
  const result = await client.callTool({ name: "search_deposits", arguments: { amount, termMonths } });
  return result.structuredContent as unknown as SearchDepositsResult;
}

test("search_deposits declares its own UI via _meta.ui.resourceUri", async () => {
  const { client, server } = await connect();
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "search_deposits");
  const ui = (tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, DEPOSITS_UI_RESOURCE_URI);
  await server.close();
});

test("returns the full static deposit lineup, echoing the request amount/term", async () => {
  const { client, server } = await connect();
  const sc = await callSearch(client, 500_000, 12);
  assert.equal(sc.amount, 500_000);
  assert.equal(sc.termMonths, 12);
  assert.ok(sc.deposits.length > 0);
  assert.ok(sc.deposits.every((d) => d.rates.length > 0));
  await server.close();
});
