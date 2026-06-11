# 02 — Бутстрап сессии: логин один раз + persistent context + check_session

Status: awaiting-hitl-verification
Type: HITL

## Parent

PRD: `.scratch/mcp-app-proxyfier/PRD.md`

## What to build

Слой браузера на Playwright как библиотеке внутри сервера: `launchPersistentContext` с профилем в `./.session/` (headed). CLI-скрипт `pnpm bootstrap:login` поднимает видимый браузер на этом профиле, человек **вручную** логинится в Сбер/Megamarket (телефон+SMS, капча), закрывает — профиль теперь держит сессию. MCP-сервер запускается на **том же** профиле и работает под готовой сессией. Инструмент `check_session` проверяет залогиненность (открыт ли логин на сайтах) и сообщает статус. Один контекст / одна страница; вызовы инструментов **сериализуются мьютексом**.

Профиль — секрет: уже в `.gitignore` (`.session/*` кроме `.gitkeep`).

## Acceptance criteria

- [~] `pnpm bootstrap:login` открывает headed-браузер на профиле `./.session/` — скрипт реализован; визуальная проверка headed-окна = HITL
- [~] После ручного логина и перезапуска сессия переиспользуется (куки/localStorage сохранены) — обеспечено `launchPersistentContext` на одном профиле; проверка после ручного входа = HITL
- [x] Сервер и `bootstrap:login` не запускаются одновременно на одном профиле (профиль залочен) — singleton-лока Chromium + понятная ошибка в `launchSessionContext`, драйвер закрывается на SIGINT/SIGTERM; задокументировано в README
- [~] `check_session` возвращает корректный статус залогиненности для Сбер и Megamarket — инструмент + детекторы реализованы и покрыты тестами через фейк; точность селекторов на живых сайтах = HITL-доводка
- [x] Драйвер браузера сериализует операции мьютексом (нет параллельных действий по одной странице) — `Mutex` + `withPage`, покрыто тестами
- [x] Профиль не попадает в гит (проверено `git status` / `git check-ignore .session/Default/Cookies`)

## Implementation notes

Слой браузера: `packages/server/src/browser/` — `Mutex` (сериализация),
`BrowserDriver`/`PlaywrightBrowserDriver` (один контекст/страница, ленивый
запуск, инъектируемая фабрика), `launchSessionContext` (headed
`launchPersistentContext` на `./.session/`, общий для драйвера и бутстрапа),
`session-detectors` (зонд-проверка входа по DOM-маркерам), `session-checker`
(заход одним эксклюзивным `withPage`), `create-session` (композиция). Инструмент
`check_session` (`check-session-tool.ts`) без UI-ресурса, никогда не бросает —
ошибка браузера → `ok:false` с пояснением. CLI `pnpm bootstrap:login`
(`bootstrap-login.ts`) открывает Сбер+Megamarket для ручного входа, ждёт
закрытия окна (слушает `close`+`disconnected`). Добавлена зависимость
`playwright`. Тесты (19/19): мьютекс (сериализация/изоляция ошибок), драйвер
(ленивый запуск/переиспользование страницы), детекторы (4 ветки + ошибка),
инструмент через in-memory MCP-клиент с фейк-чекером.

**Remaining (HITL):** `pnpm exec playwright install chromium` → `pnpm
bootstrap:login` → войти вручную в Сбер/Megamarket → перезапуск → `check_session`
показывает «вошёл». Довести селекторы входа в `session-detectors.ts` на живых
сайтах (опасное направление ошибки — ложноположительный «вошёл»).

## Blocked by

- 01
