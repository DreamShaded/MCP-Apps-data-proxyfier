import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";
import type { SessionChecker } from "./browser/session-checker.js";
import type { SiteSessionStatus } from "./browser/session-detectors.js";

const FAKE_HTML = "<!doctype html><html><body>scaffold ui</body></html>";

const fakeDriver = {
  withPage: async <T>(fn: (page: never) => Promise<T>): Promise<T> => fn(undefined as never),
  close: async () => {},
};

/** Поднять сервер с подменённой проверкой сессии — браузер не трогаем. */
async function connectWith(checker: SessionChecker) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({
    pingHtml: FAKE_HTML,
    megamarketHtml: FAKE_HTML,
    sessionChecker: checker,
    driver: fakeDriver,
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

const checkerOf = (sites: SiteSessionStatus[]): SessionChecker => ({
  checkSession: async () => sites,
});

test("check_session is listed without a UI resource", async () => {
  const { client, server } = await connectWith(checkerOf([]));
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "check_session");
  assert.ok(tool, "check_session should be listed");
  const ui = (tool?._meta as { ui?: unknown } | undefined)?.ui;
  assert.equal(ui, undefined, "health check has no MCP App UI");
  await server.close();
});

test("ok:true only when every site is logged in", async () => {
  const { client, server } = await connectWith(
    checkerOf([
      { site: "megamarket", label: "Megamarket", loggedIn: true },
      { site: "sber", label: "Сбер", loggedIn: true },
    ]),
  );
  const result = await client.callTool({ name: "check_session", arguments: {} });
  const sc = result.structuredContent as { ok: boolean; sites: SiteSessionStatus[]; checkedAt: string };
  assert.equal(sc.ok, true);
  assert.equal(sc.sites.length, 2);
  assert.match(sc.checkedAt, /\d{4}-\d{2}-\d{2}T/);
  await server.close();
});

test("ok:false when any site is not logged in", async () => {
  const { client, server } = await connectWith(
    checkerOf([
      { site: "megamarket", label: "Megamarket", loggedIn: true },
      { site: "sber", label: "Сбер", loggedIn: false, detail: "видна кнопка входа" },
    ]),
  );
  const result = await client.callTool({ name: "check_session", arguments: {} });
  const sc = result.structuredContent as { ok: boolean };
  assert.equal(sc.ok, false);
  await server.close();
});

test("checker failure degrades gracefully to ok:false, no throw", async () => {
  const failing: SessionChecker = {
    checkSession: async () => {
      throw new Error("профиль занят");
    },
  };
  const { client, server } = await connectWith(failing);
  const result = await client.callTool({ name: "check_session", arguments: {} });
  const sc = result.structuredContent as { ok: boolean; sites: SiteSessionStatus[] };
  assert.equal(sc.ok, false);
  assert.equal(sc.sites[0].loggedIn, null);
  assert.match(String(sc.sites[0].detail), /профиль занят/);
  await server.close();
});
