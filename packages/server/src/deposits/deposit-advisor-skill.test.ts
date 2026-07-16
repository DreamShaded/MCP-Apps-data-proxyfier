import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";
import {
  DEPOSIT_ADVISOR_SKILL_URI,
  SKILLS_INDEX_URI,
} from "./deposit-advisor-skill.js";

const FAKE_HTML = "<!doctype html><html><body>scaffold ui</body></html>";

/** Поднять сервер, связанный с in-memory клиентом, — тестовая граница на уровне MCP. */
async function connectTestClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ pingHtml: FAKE_HTML, megamarketHtml: FAKE_HTML, depositsHtml: FAKE_HTML });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test("skill index and deposit-advisor skill are listed as resources", async () => {
  const { client, server } = await connectTestClient();
  const { resources } = await client.listResources();
  const uris = resources.map((r) => r.uri);
  assert.ok(uris.includes(SKILLS_INDEX_URI), "index.json skill resource should be listed");
  assert.ok(uris.includes(DEPOSIT_ADVISOR_SKILL_URI), "deposit-advisor SKILL.md should be listed");
  await server.close();
});

test("skill://index.json returns valid JSON pointing at the deposit-advisor skill", async () => {
  const { client, server } = await connectTestClient();
  const { contents } = await client.readResource({ uri: SKILLS_INDEX_URI });
  const entry = contents[0] as { uri: string; text?: string; mimeType?: string };
  assert.equal(entry.uri, SKILLS_INDEX_URI);
  assert.equal(entry.mimeType, "application/json");
  const parsed = JSON.parse(String(entry.text)) as {
    skills: Array<{ name: string; url: string; type: string }>;
  };
  const advisor = parsed.skills.find((s) => s.name === "deposit-advisor");
  assert.ok(advisor, "index must list the deposit-advisor skill");
  assert.equal(advisor?.url, DEPOSIT_ADVISOR_SKILL_URI);
  assert.equal(advisor?.type, "skill-md");
  await server.close();
});

test("skill://deposit-advisor/SKILL.md serves the markdown methodology", async () => {
  const { client, server } = await connectTestClient();
  const { contents } = await client.readResource({ uri: DEPOSIT_ADVISOR_SKILL_URI });
  const entry = contents[0] as { uri: string; text?: string; mimeType?: string };
  assert.equal(entry.uri, DEPOSIT_ADVISOR_SKILL_URI);
  assert.equal(entry.mimeType, "text/markdown");
  const text = String(entry.text);
  // Методичка должна ссылаться на реальный инструмент и нести frontmatter скилла.
  assert.match(text, /name: deposit-advisor/);
  assert.match(text, /search_deposits/);
  await server.close();
});
