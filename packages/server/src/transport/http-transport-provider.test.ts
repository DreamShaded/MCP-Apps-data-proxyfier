import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "../server.js";
import { PING_UI_RESOURCE_URI } from "../ui-resource.js";
import { HttpTransportProvider } from "./http-transport-provider.js";

const FAKE_HTML = "<!doctype html><html><body>scaffold ui</body></html>";

/** Те же фейки, что в server.test.ts: каркасный тест не поднимает Chromium. */
const fakeDriver = {
  withPage: async <T>(fn: (page: never) => Promise<T>): Promise<T> => fn(undefined as never),
  close: async () => {},
};
const fakeSessionChecker = { checkSession: async () => [] };

/**
 * Поднять сервер по HTTP-транспорту на свободном порту (`port: 0`) и подключить
 * реальный SDK-клиент по Streamable HTTP — граница «те же инструменты/ресурсы
 * доступны по HTTP без правок кода инструментов».
 */
async function connectOverHttp() {
  const provider = new HttpTransportProvider({ port: 0 });
  const server = createServer({
    pingHtml: FAKE_HTML,
    megamarketHtml: FAKE_HTML,
    depositsHtml: FAKE_HTML,
    sessionChecker: fakeSessionChecker,
    driver: fakeDriver,
  });
  const transport = await provider.create();
  await server.connect(transport);

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(provider.url!)));

  const teardown = async () => {
    await client.close();
    await server.close();
    await provider.close();
  };
  return { client, provider, teardown };
}

test("http provider exposes a swappable seam with a bound url", async () => {
  const provider = new HttpTransportProvider({ port: 0 });
  assert.equal(provider.name, "http");
  assert.equal(provider.url, undefined, "url is unknown before create()");
  const transport = await provider.create();
  assert.equal(typeof transport.start, "function", "must satisfy the SDK Transport interface");
  assert.match(String(provider.url), /^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  await provider.close();
});

test("same tools are listed over the http transport", async () => {
  const { client, teardown } = await connectOverHttp();
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const expected of ["ping", "search_products", "search_deposits"]) {
    assert.ok(names.includes(expected), `${expected} should be listed over http`);
  }
  await teardown();
});

test("ui:// resource serves the bundled HTML over the http transport", async () => {
  const { client, teardown } = await connectOverHttp();
  const { contents } = await client.readResource({ uri: PING_UI_RESOURCE_URI });
  const entry = contents[0] as { uri: string; text?: string; mimeType?: string };
  assert.equal(entry.uri, PING_UI_RESOURCE_URI);
  assert.equal(entry.text, FAKE_HTML);
  assert.match(String(entry.mimeType), /text\/html;profile=mcp-app/);
  await teardown();
});

test("ping tool round-trips structuredContent over http", async () => {
  const { client, teardown } = await connectOverHttp();
  const result = await client.callTool({ name: "ping", arguments: { echo: "hello" } });
  const structured = result.structuredContent as { message: string; echo: string | null };
  assert.equal(structured.message, "pong");
  assert.equal(structured.echo, "hello");
  await teardown();
});

test("the routed path is the only one served; others 404", async () => {
  const provider = new HttpTransportProvider({ port: 0, path: "/mcp" });
  await provider.create();
  const base = provider.url!.replace(/\/mcp$/, "");
  const res = await fetch(`${base}/not-mcp`);
  assert.equal(res.status, 404);
  await provider.close();
});

test("a configured token rejects requests without the matching bearer", async () => {
  const provider = new HttpTransportProvider({ port: 0, token: "s3cret" });
  await provider.create();
  const url = provider.url!;
  const init = {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "c", version: "0" } },
    }),
  };

  const noAuth = await fetch(url, init);
  assert.equal(noAuth.status, 401, "missing bearer is rejected");

  const wrong = await fetch(url, { ...init, headers: { ...init.headers, authorization: "Bearer nope" } });
  assert.equal(wrong.status, 401, "wrong bearer is rejected");

  // Сервер ещё не подключён (этот тест проверяет только гейт), так что
  // правильный токен пройдёт гейт и упрётся уже в обработку SDK — не 401.
  const right = await fetch(url, { ...init, headers: { ...init.headers, authorization: "Bearer s3cret" } });
  assert.notEqual(right.status, 401, "correct bearer passes the gate");
  await provider.close();
});
