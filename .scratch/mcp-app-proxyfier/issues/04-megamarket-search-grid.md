# 04 — Megamarket: search_products → грид-вью рендерится

Status: ready-for-agent
Type: HITL

## Parent

PRD: `.scratch/mcp-app-proxyfier/PRD.md`

## What to build

Первый реальный флоу Megamarket как мини-SPA MCP App. Инструмент `search_products(query, filters)` через кэш-слой (хит → мгновенно; мисс → live Playwright по megamarket.ru) возвращает `structuredContent` со списком товаров. UI рендерит **грид карточек** (фото, название, цена, рейтинг) в песочнице-iframe Claude Desktop. Запросы из золотого набора отдаются из кэша; произвольные — вживую. Инструмент обёрнут таймаутом+фолбэк-UI.

## Acceptance criteria

- [ ] `search_products` возвращает структурированный список товаров (фото, название, цена, рейтинг)
- [ ] Чтение идёт через кэш-слой (хит/мисс)
- [ ] Произвольный запрос проходит вживую через Playwright под сессией
- [ ] Таймаут/сбой → фолбэк-UI, без зависания
- [ ] **HITL:** в Claude Desktop рендерится грид карточек товаров
- [ ] Тест слоя инструмента через шов с фейковым/записанным Playwright-драйвером (вход — аргументы, выход — structuredContent)

## Blocked by

- 02
- 03
