import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";
import { PING_UI_RESOURCE_URI } from "./ui-resource.js";
import { DEPOSITS_UI_RESOURCE_URI } from "./deposits/deposits-ui-resource.js";
import { StdioTransportProvider } from "./transport/stdio-transport-provider.js";

const FAKE_HTML = "<!doctype html><html><body>scaffold ui</body></html>";

/** Фейк-драйвер браузера: тесты уровня каркаса не должны поднимать Chromium. */
const fakeDriver = {
  withPage: async <T>(fn: (page: never) => Promise<T>): Promise<T> => fn(undefined as never),
  close: async () => {},
};
const fakeSessionChecker = { checkSession: async () => [] };

/** Поднять сервер, связанный с in-memory клиентом, — тестовая граница на уровне инструментов MCP. */
async function connectTestClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({
    pingHtml: FAKE_HTML,
    megamarketHtml: FAKE_HTML,
    depositsHtml: FAKE_HTML,
    sessionChecker: fakeSessionChecker,
    driver: fakeDriver,
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test("handshake succeeds and exposes the ping tool", async () => {
  const { client, server } = await connectTestClient();
  const { tools } = await client.listTools();
  const ping = tools.find((t) => t.name === "ping");
  assert.ok(ping, "ping tool should be listed after handshake");
  await server.close();
});

test("ping tool declares its UI via _meta.ui.resourceUri", async () => {
  const { client, server } = await connectTestClient();
  const { tools } = await client.listTools();
  const ping = tools.find((t) => t.name === "ping");
  const ui = (ping?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, PING_UI_RESOURCE_URI);
  await server.close();
});

test("ping returns pong and echoes the input in structuredContent", async () => {
  const { client, server } = await connectTestClient();
  const result = await client.callTool({ name: "ping", arguments: { echo: "hello" } });
  const structured = result.structuredContent as { message: string; echo: string | null };
  assert.equal(structured.message, "pong");
  assert.equal(structured.echo, "hello");
  await server.close();
});

test("ui:// resource serves the bundled HTML with the MCP-app mime type", async () => {
  const { client, server } = await connectTestClient();
  const { contents } = await client.readResource({ uri: PING_UI_RESOURCE_URI });
  const entry = contents[0] as { uri: string; text?: string; mimeType?: string };
  assert.equal(entry.uri, PING_UI_RESOURCE_URI);
  assert.equal(entry.text, FAKE_HTML);
  assert.match(String(entry.mimeType), /text\/html;profile=mcp-app/);
  await server.close();
});

test("createServer wires the deposits app: search_deposits tool + its ui:// resource", async () => {
  const { client, server } = await connectTestClient();
  const { tools } = await client.listTools();
  const deposits = tools.find((t) => t.name === "search_deposits");
  assert.ok(deposits, "search_deposits tool should be registered by createServer");
  const ui = (deposits?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
  assert.equal(ui?.resourceUri, DEPOSITS_UI_RESOURCE_URI);

  const { contents } = await client.readResource({ uri: DEPOSITS_UI_RESOURCE_URI });
  assert.equal((contents[0] as { text?: string }).text, FAKE_HTML);
  await server.close();
});

test("stdio transport provider exposes a swappable seam", () => {
  const provider = new StdioTransportProvider();
  assert.equal(provider.name, "stdio");
  const transport = provider.create();
  assert.ok(transport, "provider should produce a transport instance");
  assert.equal(typeof transport.start, "function", "must satisfy the SDK Transport interface");
});
