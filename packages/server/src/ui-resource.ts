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
 * Путь к собранному self-contained HTML по имени входа Vite: `dist/<name>.html`.
 * Каждое приложение (`index` — каркас-пинг, `megamarket` — флоу Megamarket) собирается
 * отдельным проходом в свой файл. Базовый каталог переопределяется `MCP_UI_DIST_DIR`
 * (тесты / нестандартная раскладка).
 */
function resolveUiHtmlPath(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const distDir = process.env.MCP_UI_DIST_DIR ?? resolve(here, "../../ui/dist");
  return resolve(distDir, `${name}.html`);
}

/** Прочитать собранный файл UI на старте; при ошибке сразу падаем с понятным сообщением. */
export function loadUiHtml(name: string = "index"): string {
  const htmlPath = resolveUiHtmlPath(name);
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
 * отдаётся по запросу чтения. Общий помощник для всех MCP-приложений репозитория.
 */
export function registerAppHtmlResource(
  server: McpServer,
  name: string,
  uri: string,
  html: string,
  description: string,
  /**
   * Origins, с которых приложению разрешено тянуть картинки/шрифты/медиа. По умолчанию
   * песочница не пускает **никуда**: «empty or omitted → no network resources» (спека
   * `McpUiResourceCsp.resourceDomains`). Не объявишь — фото товаров не загрузятся.
   */
  resourceDomains?: string[],
): void {
  const ui = resourceDomains?.length ? { csp: { resourceDomains } } : undefined;
  registerAppResource(
    server,
    name,
    uri,
    // В листинге — чтобы хост видел требования ещё на `resources/list`; на content-item —
    // потому что там значение авторитетное (оно перекрывает листинг).
    ui ? { description, _meta: { ui } } : { description },
    async () => ({
      contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html, ...(ui ? { _meta: { ui } } : {}) }],
    }),
  );
}

/** UI-ресурс каркасного `ping`-приложения. */
export function registerPingUiResource(server: McpServer, html: string): void {
  registerAppHtmlResource(
    server,
    "Ping App",
    PING_UI_RESOURCE_URI,
    html,
    "Minimal MCP App rendered for the ping tool.",
  );
}
