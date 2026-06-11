import type { BrowserContext } from "playwright";
import { resolveSessionDir } from "./session-paths.js";

/**
 * Поднять headed-браузер на постоянном профиле `./.session/`. Единая точка
 * запуска и для драйвера сервера, и для скрипта бутстрапа — чтобы оба работали
 * на одном профиле с одинаковыми опциями.
 *
 * Chromium держит на каталоге профиля singleton-локу: второй запуск на том же
 * профиле (например, сервер при открытом бутстрапе) упадёт здесь с понятной
 * ошибкой — это и есть задокументированная защита от одновременного доступа.
 *
 * `MCP_BROWSER_CHANNEL` (напр. `chrome`) переключает на установленный Chrome —
 * он мягче для антибота, чем bundled-Chromium.
 */
export async function launchSessionContext(): Promise<BrowserContext> {
  // Динамический импорт: модуль драйвера тянется и в тестах (с фейковым
  // контекстом), где реального playwright и браузерных бинарей может не быть.
  const { chromium } = await import("playwright");
  const userDataDir = resolveSessionDir();
  const channel = process.env.MCP_BROWSER_CHANNEL;

  try {
    return await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: channel || undefined,
      viewport: { width: 1280, height: 900 },
    });
  } catch (cause) {
    throw new Error(
      `Не удалось открыть профиль "${userDataDir}". Вероятно, профиль уже занят ` +
        `другим процессом (запущен сервер или bootstrap:login одновременно), ` +
        `либо не установлены браузеры Playwright (\`pnpm exec playwright install chromium\`).`,
      { cause },
    );
  }
}
