import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Общий реестр ресурсов-скиллов (`skill://`). В отличие от `ui://`-ресурсов это не MCP
 * Apps — рендерить нечего, это методички для агента. Поэтому регистрируются напрямую
 * через `server.registerResource`, а не через `registerAppResource`.
 *
 * Индекс `skill://index.json` один на сервер, а скиллы живут каждый в своей доменной
 * папке — реестр их собирает, не зная про домены.
 */

/** Индекс доступных скиллов — точка входа, по которой агент находит остальные `skill://`. */
export const SKILLS_INDEX_URI = "skill://index.json";

/** Описание одного скилла: метаданные для индекса + тело методички. */
export interface SkillDefinition {
  /** Машинное имя скилла (`shopping-advisor`), оно же во frontmatter тела. */
  name: string;
  /** Однострочное назначение — попадает и в индекс, и в описание ресурса. */
  description: string;
  /** Канонический `skill://`-URI методички. */
  uri: string;
  /** Тело `SKILL.md` целиком (frontmatter + markdown). */
  body: string;
}

/** Одна запись индекса скиллов (`index.json`). */
interface SkillIndexEntry {
  name: string;
  description: string;
  url: string;
  type: "skill-md";
}

function toIndexEntry(skill: SkillDefinition): SkillIndexEntry {
  return { name: skill.name, description: skill.description, url: skill.uri, type: "skill-md" };
}

/**
 * Зарегистрировать индекс и все переданные скиллы. Индекс собирается из тех же
 * `SkillDefinition`, что и сами ресурсы, — имя/описание не могут разъехаться между
 * индексом и методичкой.
 *
 * @throws при дублирующемся `uri` — иначе вторая регистрация молча затёрла бы первую.
 */
export function registerSkills(server: McpServer, skills: readonly SkillDefinition[]): void {
  const seen = new Set<string>();
  for (const skill of skills) {
    if (seen.has(skill.uri)) throw new Error(`Duplicate skill uri: ${skill.uri}`);
    seen.add(skill.uri);
  }

  const index = { skills: skills.map(toIndexEntry) };

  server.registerResource(
    "Skills index",
    SKILLS_INDEX_URI,
    {
      description: "Индекс доступных skill://-ресурсов сервера.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: SKILLS_INDEX_URI,
          mimeType: "application/json",
          text: JSON.stringify(index, null, 2),
        },
      ],
    }),
  );

  for (const skill of skills) {
    server.registerResource(
      skill.name,
      skill.uri,
      { description: skill.description, mimeType: "text/markdown" },
      async () => ({
        contents: [{ uri: skill.uri, mimeType: "text/markdown", text: skill.body }],
      }),
    );
  }
}
