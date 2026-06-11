import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SessionChecker } from "./browser/session-checker.js";
import type { SiteSessionStatus } from "./browser/session-detectors.js";

/**
 * Хелсчек сессии перед демо: проверяет, залогинены ли Сбер и Megamarket под
 * текущим профилем браузера. Без UI-ресурса — это диагностика, а не вью.
 * Никогда не бросает наружу: ошибка браузера (профиль занят, нет бинарей,
 * таймаут) превращается в `ok:false` с пояснением, чтобы демо не зависало.
 */
export function registerCheckSessionTool(server: McpServer, checker: SessionChecker): void {
  server.registerTool(
    "check_session",
    {
      title: "Check session",
      description:
        "Проверяет залогиненность Сбера и Megamarket под текущим профилем браузера перед демо.",
      inputSchema: {},
      outputSchema: {
        ok: z.boolean(),
        sites: z.array(
          z.object({
            site: z.string(),
            label: z.string(),
            loggedIn: z.boolean().nullable(),
            detail: z.string().optional(),
          }),
        ),
        checkedAt: z.string(),
      },
    },
    async () => {
      const checkedAt = new Date().toISOString();
      let sites: SiteSessionStatus[];
      try {
        sites = await checker.checkSession();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        sites = [{ site: "browser", label: "Браузер", loggedIn: null, detail: message }];
      }
      const ok = sites.length > 0 && sites.every((s) => s.loggedIn === true);
      return {
        content: [{ type: "text", text: summarize(ok, sites) }],
        structuredContent: { ok, sites, checkedAt },
      };
    },
  );
}

/** Человекочитаемая сводка для текстового канала. */
function summarize(ok: boolean, sites: SiteSessionStatus[]): string {
  const lines = sites.map((s) => {
    const mark = s.loggedIn === true ? "✓ вошёл" : s.loggedIn === false ? "✗ не вошёл" : "? неизвестно";
    return `${s.label}: ${mark}${s.detail ? ` (${s.detail})` : ""}`;
  });
  const head = ok ? "Сессии активны — можно начинать демо." : "Внимание: не все сессии активны.";
  return [head, ...lines].join("\n");
}
