import type { BrowserDriver } from "./browser-driver.js";
import {
  detectSiteLogin,
  SITE_DETECTORS,
  type SiteDetector,
  type SiteSessionStatus,
} from "./session-detectors.js";

/**
 * Шов проверки сессии, от которого зависит инструмент `check_session`.
 * В тестах инструмент получает фейковый `SessionChecker` и не трогает браузер.
 */
export interface SessionChecker {
  checkSession(): Promise<SiteSessionStatus[]>;
}

/**
 * Боевая проверка: один эксклюзивный заход на единственную страницу,
 * сайты проверяются последовательно (одна вкладка под одной сессией).
 */
export class PlaywrightSessionChecker implements SessionChecker {
  constructor(
    private readonly driver: BrowserDriver,
    private readonly detectors: SiteDetector[] = SITE_DETECTORS,
  ) {}

  checkSession(): Promise<SiteSessionStatus[]> {
    return this.driver.withPage(async (page) => {
      const statuses: SiteSessionStatus[] = [];
      for (const d of this.detectors) {
        statuses.push(await detectSiteLogin(page, d));
      }
      return statuses;
    });
  }
}
