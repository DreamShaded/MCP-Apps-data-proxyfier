import type { BrowserDriver } from "./browser-driver.js";
import { PlaywrightBrowserDriver } from "./playwright-browser-driver.js";
import { PlaywrightSessionChecker, type SessionChecker } from "./session-checker.js";
import { navigationPacer } from "./humanize.js";

/**
 * Композиционный корень слоя браузера: один общий драйвер (один контекст /
 * одна страница / мьютекс) и проверка сессии поверх него. Драйвер ленивый —
 * Chromium не поднимается, пока инструмент реально не пойдёт в браузер.
 *
 * Драйвер возвращается отдельно, чтобы будущие инструменты (`search_products`
 * и т.д.) переиспользовали ту же сериализованную сессию.
 */
export function createBrowserSession(): {
  driver: BrowserDriver;
  sessionChecker: SessionChecker;
} {
  // Боевой драйвер с пейсингом живых навигаций (анти-всплеск для антибота).
  const driver = new PlaywrightBrowserDriver(undefined, () => navigationPacer.pace());
  return { driver, sessionChecker: new PlaywrightSessionChecker(driver) };
}
