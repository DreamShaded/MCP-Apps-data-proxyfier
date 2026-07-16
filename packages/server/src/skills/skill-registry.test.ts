import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerSkills, SKILLS_INDEX_URI, type SkillDefinition } from "./skill-registry.js";

const ALPHA: SkillDefinition = {
  name: "alpha",
  description: "Первый тестовый скилл",
  uri: "skill://alpha/SKILL.md",
  body: "---\nname: alpha\n---\nтело альфы",
};

const BETA: SkillDefinition = {
  name: "beta",
  description: "Второй тестовый скилл",
  uri: "skill://beta/SKILL.md",
  body: "---\nname: beta\n---\nтело беты",
};

async function connect(skills: readonly SkillDefinition[]) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "t", version: "1.0.0" });
  registerSkills(server, skills);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test("index lists every registered skill", async () => {
  const { client, server } = await connect([ALPHA, BETA]);
  const { contents } = await client.readResource({ uri: SKILLS_INDEX_URI });
  const parsed = JSON.parse(String((contents[0] as { text?: string }).text)) as {
    skills: Array<{ name: string; url: string; type: string; description: string }>;
  };
  assert.deepEqual(
    parsed.skills.map((s) => s.name).sort(),
    ["alpha", "beta"],
    "both skills must appear in the index",
  );
  assert.equal(parsed.skills.find((s) => s.name === "alpha")?.url, ALPHA.uri);
  assert.equal(parsed.skills.every((s) => s.type === "skill-md"), true);
  await server.close();
});

// Индекс и ресурс собираются из одного SkillDefinition — разъехаться они не могут.
test("index description matches the skill definition", async () => {
  const { client, server } = await connect([ALPHA]);
  const { contents } = await client.readResource({ uri: SKILLS_INDEX_URI });
  const parsed = JSON.parse(String((contents[0] as { text?: string }).text)) as {
    skills: Array<{ description: string }>;
  };
  assert.equal(parsed.skills[0].description, ALPHA.description);
  await server.close();
});

test("each skill body is served as markdown at its own uri", async () => {
  const { client, server } = await connect([ALPHA, BETA]);
  const { contents } = await client.readResource({ uri: BETA.uri });
  const entry = contents[0] as { uri: string; text?: string; mimeType?: string };
  assert.equal(entry.uri, BETA.uri);
  assert.equal(entry.mimeType, "text/markdown");
  assert.equal(entry.text, BETA.body);
  await server.close();
});

test("registered skills are discoverable via resources/list", async () => {
  const { client, server } = await connect([ALPHA, BETA]);
  const { resources } = await client.listResources();
  const uris = resources.map((r) => r.uri);
  for (const uri of [SKILLS_INDEX_URI, ALPHA.uri, BETA.uri]) {
    assert.ok(uris.includes(uri), `${uri} should be listed`);
  }
  await server.close();
});

// Молчаливая перезапись второго скилла первым — как раз то, что тут ловится.
test("a duplicate skill uri is rejected rather than silently overwritten", () => {
  const server = new McpServer({ name: "t", version: "1.0.0" });
  assert.throws(() => registerSkills(server, [ALPHA, { ...ALPHA, name: "clone" }]), /Duplicate skill uri/);
});
