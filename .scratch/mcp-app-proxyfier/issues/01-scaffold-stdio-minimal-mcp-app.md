# 01 — Каркас + stdio-транспорт + минимальный MCP App рендерится в Claude Desktop

Status: ready-for-agent
Type: HITL

## Parent

PRD: `.scratch/mcp-app-proxyfier/PRD.md`

## What to build

Фундаментальный tracer bullet, прошивающий весь конвейер насквозь: TypeScript + pnpm workspace, MCP-сервер на `@modelcontextprotocol/sdk` со **stdio**-транспортом, абстрагированным за интерфейс (чтобы позже добавить HTTP без правки инструментов), один тривиальный инструмент (напр. `ping`), который объявляет `_meta.ui.resourceUri` и отдаёт минимальный `ui://` ресурс. UI — одно React+Vite приложение, собираемое в **один self-contained `index.html`** через `vite-plugin-singlefile`; сервер на старте читает готовый HTML и регистрирует как `ui://` ресурс. Сервер прописывается в `claude_desktop_config.json` и **рендерится в Claude Desktop в песочнице-iframe**.

Цель — рано де-рискнуть баг рендера iframe (ext-apps issue #671) на боевой сборке Claude Desktop.

## Acceptance criteria

- [ ] `pnpm install` и `pnpm build` собирают сервер и UI без ошибок
- [ ] UI собирается в единственный self-contained `index.html` (JS/CSS инлайн, без внешних script-источников)
- [ ] Сервер поднимается по stdio и проходит handshake с MCP-клиентом
- [ ] Инструмент `ping` объявляет UI-ресурс через `_meta.ui.resourceUri`
- [ ] Транспорт спрятан за интерфейс — добавление второго транспорта не требует правки кода инструмента
- [ ] **HITL:** в Claude Desktop вызов инструмента рисует интерактивный iframe (а не только текст); подтверждено визуально на актуальной сборке
- [ ] README фиксирует, как прописать сервер в `claude_desktop_config.json`

## Blocked by

None - can start immediately
