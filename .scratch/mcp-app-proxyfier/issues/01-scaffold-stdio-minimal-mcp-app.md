# 01 — Каркас + stdio-транспорт + минимальный MCP App рендерится в Claude Desktop

Status: awaiting-hitl-verification
Type: HITL

## Parent

PRD: `.scratch/mcp-app-proxyfier/PRD.md`

## What to build

Фундаментальный tracer bullet, прошивающий весь конвейер насквозь: TypeScript + pnpm workspace, MCP-сервер на `@modelcontextprotocol/sdk` со **stdio**-транспортом, абстрагированным за интерфейс (чтобы позже добавить HTTP без правки инструментов), один тривиальный инструмент (напр. `ping`), который объявляет `_meta.ui.resourceUri` и отдаёт минимальный `ui://` ресурс. UI — одно React+Vite приложение, собираемое в **один self-contained `index.html`** через `vite-plugin-singlefile`; сервер на старте читает готовый HTML и регистрирует как `ui://` ресурс. Сервер прописывается в `claude_desktop_config.json` и **рендерится в Claude Desktop в песочнице-iframe**.

Цель — рано де-рискнуть баг рендера iframe (ext-apps issue #671) на боевой сборке Claude Desktop.

## Acceptance criteria

- [x] `pnpm install` и `pnpm build` собирают сервер и UI без ошибок
- [x] UI собирается в единственный self-contained `index.html` (JS/CSS инлайн, без внешних script-источников)
- [x] Сервер поднимается по stdio и проходит handshake с MCP-клиентом
- [x] Инструмент `ping` объявляет UI-ресурс через `_meta.ui.resourceUri`
- [x] Транспорт спрятан за интерфейс — добавление второго транспорта не требует правки кода инструмента
- [ ] **HITL:** в Claude Desktop вызов инструмента рисует интерактивный iframe (а не только текст); подтверждено визуально на актуальной сборке
- [x] README фиксирует, как прописать сервер в `claude_desktop_config.json`

## Implementation notes

Built: pnpm workspace (`packages/ui` + `packages/server`), `@modelcontextprotocol/sdk@1.29.0`
+ `@modelcontextprotocol/ext-apps@1.7.4`. UI bundled single-file via `vite-plugin-singlefile`
(0 external refs, ~539 KB). Server registers `ui://mcp-app-proxyfier/ping.html` (mime
`text/html;profile=mcp-app`) + `ping` tool (`_meta.ui.resourceUri`, typed `outputSchema`).
Transport behind `ServerTransportProvider` (`StdioTransportProvider`); HTTP = new provider,
no tool edits. 5/5 tests pass (in-memory MCP client black-box). Real stdio handshake verified.

**Remaining (HITL only):** register `packages/server/dist/index.js` in `claude_desktop_config.json`
(see README) and visually confirm the iframe renders in Claude Desktop — the de-risk goal (#671).

## Blocked by

None - can start immediately
