import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Канонический `ui://`-URI приложения каркаса. Инструменты ссылаются ровно на это значение. */
export const PING_UI_RESOURCE_URI = "ui://mcp-app-proxyfier/ping.html";

/**
 * Путь по умолчанию к собранному файлу UI (один самодостаточный `index.html`):
 * вычисляется относительно скомпилированного сервера (`packages/server/dist/`) →
 * `packages/ui/dist/index.html`. Переопределяется переменной `MCP_UI_HTML_PATH`
 * (тесты / нестандартная раскладка файлов).
 */
function resolveUiHtmlPath(): string {
  const override = process.env.MCP_UI_HTML_PATH;
  if (override) return override;
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../ui/dist/index.html");
}

/** Прочитать собранный файл UI на старте; при ошибке сразу падаем с понятным сообщением. */
export function loadUiHtml(htmlPath: string = resolveUiHtmlPath()): string {
  try {
    return readFileSync(htmlPath, "utf-8");
  } catch (cause) {
    throw new Error(
      `Failed to read UI bundle at "${htmlPath}". Run \`pnpm build:ui\` first.`,
      { cause },
    );
  }
}

/**
 * Зарегистрировать `ui://`-ресурс с HTML, который хост запрашивает и
 * отрисовывает в своей песочнице-iframe. HTML читается один раз на старте и
 * отдаётся по запросу чтения.
 */
export function registerPingUiResource(server: McpServer, html: string): void {
  registerAppResource(
    server,
    "Ping App",
    PING_UI_RESOURCE_URI,
    { description: "Minimal MCP App rendered for the ping tool." },
    async () => ({
      contents: [
        {
          uri: PING_UI_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: html,
        },
      ],
    }),
  );
}
