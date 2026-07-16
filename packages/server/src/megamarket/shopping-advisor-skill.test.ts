import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";
import { SHOPPING_ADVISOR_SKILL_URI } from "./shopping-advisor-skill.js";
import { SKILLS_INDEX_URI } from "../skills/skill-registry.js";
import { SEARCH_PRODUCTS_ADVISED_TOOL } from "./search-products-tool.js";

const FAKE_HTML = "<!doctype html><html><body>scaffold ui</body></html>";

async function connectTestClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ pingHtml: FAKE_HTML, megamarketHtml: FAKE_HTML });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function readSkill(client: Client): Promise<string> {
  const { contents } = await client.readResource({ uri: SHOPPING_ADVISOR_SKILL_URI });
  return String((contents[0] as { text?: string }).text);
}

test("createServer serves the shopping-advisor skill as markdown", async () => {
  const { client, server } = await connectTestClient();
  const { contents } = await client.readResource({ uri: SHOPPING_ADVISOR_SKILL_URI });
  const entry = contents[0] as { uri: string; mimeType?: string };
  assert.equal(entry.uri, SHOPPING_ADVISOR_SKILL_URI);
  assert.equal(entry.mimeType, "text/markdown");
  assert.match(await readSkill(client), /name: shopping-advisor/);
  await server.close();
});

// Индекс — единственная точка входа агента к скиллам.
test("the skill index points at the shopping-advisor skill", async () => {
  const { client, server } = await connectTestClient();
  const { contents } = await client.readResource({ uri: SKILLS_INDEX_URI });
  const parsed = JSON.parse(String((contents[0] as { text?: string }).text)) as {
    skills: Array<{ name: string; url: string }>;
  };
  const byUrl = new Map(parsed.skills.map((s) => [s.url, s.name]));
  assert.equal(byUrl.get(SHOPPING_ADVISOR_SKILL_URI), "shopping-advisor");
  await server.close();
});

test("the skill names the tool the agent is meant to call", async () => {
  const { client, server } = await connectTestClient();
  assert.match(await readSkill(client), new RegExp(SEARCH_PRODUCTS_ADVISED_TOOL));
  await server.close();
});

// Методичка, обещающая несуществующий инструмент, уводит агента в вымышленный вызов.
test("the skill references only tools this server actually registers", async () => {
  const { client, server } = await connectTestClient();
  const body = await readSkill(client);
  const { tools } = await client.listTools();
  const registered = new Set(tools.map((t) => t.name));

  const mentioned = new Set(body.match(/\b[a-z_]+(?=\()/g) ?? []);
  for (const name of mentioned) {
    assert.ok(registered.has(name), `skill mentions "${name}()", which is not a registered tool`);
  }
  await server.close();
});
