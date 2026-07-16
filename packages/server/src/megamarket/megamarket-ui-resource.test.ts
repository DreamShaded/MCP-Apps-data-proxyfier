import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";
import { MEGAMARKET_UI_RESOURCE_URI } from "./megamarket-ui-resource.js";
import { PING_UI_RESOURCE_URI } from "../ui-resource.js";
import { SEARCH_PRODUCTS_TOOL } from "./search-products-tool.js";
import type { SearchResult } from "./product.js";

const FAKE_HTML = "<!doctype html><html><body>ui</body></html>";

async function connectTestClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ pingHtml: FAKE_HTML, megamarketHtml: FAKE_HTML });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

type UiMeta = { ui?: { csp?: { resourceDomains?: string[] } } };

/**
 * Песочница-iframe по умолчанию не пускает приложение **никуда**: «empty or omitted → no
 * network resources». Не объявим CDN — грид отрисуется без единой фотографии, и увидим мы
 * это только на сцене.
 */
test("megamarket app declares the photo CDN in its CSP", async () => {
  const { client, server } = await connectTestClient();
  const { contents } = await client.readResource({ uri: MEGAMARKET_UI_RESOURCE_URI });
  const csp = (contents[0] as { _meta?: UiMeta })._meta?.ui?.csp;
  assert.deepEqual(csp?.resourceDomains, ["https://main-cdn.sbermegamarket.ru"]);
  await server.close();
});

// Хост читает `resources/list` при подключении — требования должны быть видны и там.
test("the CSP is visible on the resource listing, not only on read", async () => {
  const { client, server } = await connectTestClient();
  const { resources } = await client.listResources();
  const entry = resources.find((r) => r.uri === MEGAMARKET_UI_RESOURCE_URI);
  const domains = (entry?._meta as UiMeta | undefined)?.ui?.csp?.resourceDomains;
  assert.deepEqual(domains, ["https://main-cdn.sbermegamarket.ru"]);
  await server.close();
});

/** Разрешать origin, откуда ничего не грузится, незачем — это лишняя дыра в песочнице. */
test("the ping app declares no CSP — it has nothing external to load", async () => {
  const { client, server } = await connectTestClient();
  const { contents } = await client.readResource({ uri: PING_UI_RESOURCE_URI });
  assert.equal((contents[0] as { _meta?: UiMeta })._meta?.ui?.csp, undefined);
  await server.close();
});

/**
 * Ловит расхождение данных и CSP: появится картинка с другого хоста — тест упадёт здесь,
 * а не пустой плашкой в кадре.
 */
test("every image the catalog serves comes from the declared origin", async () => {
  const { client, server } = await connectTestClient();
  const { contents } = await client.readResource({ uri: MEGAMARKET_UI_RESOURCE_URI });
  const allowed = (contents[0] as { _meta?: UiMeta })._meta?.ui?.csp?.resourceDomains ?? [];

  const result = await client.callTool({ name: SEARCH_PRODUCTS_TOOL, arguments: { query: "наушники" } });
  const { products } = result.structuredContent as unknown as SearchResult;

  const urls: string[] = [];
  for (const p of products) {
    if (p.imageUrl) urls.push(p.imageUrl);
    const detail = await client.callTool({ name: "get_product", arguments: { id: p.id } });
    const images = (detail.structuredContent as { product?: { images?: string[] } }).product?.images ?? [];
    urls.push(...images);
  }

  assert.ok(urls.length > 0, "в выдаче обязаны быть картинки — иначе тест ничего не проверяет");
  for (const url of urls) {
    const origin = new URL(url).origin;
    assert.ok(allowed.includes(origin), `${origin} не объявлен в CSP — картинка будет отрезана песочницей`);
  }
  await server.close();
});
