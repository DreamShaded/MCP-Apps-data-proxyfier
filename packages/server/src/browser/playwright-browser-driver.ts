import type { BrowserContext, Page } from "playwright";
import type { BrowserDriver } from "./browser-driver.js";
import { Mutex } from "./mutex.js";
import { launchSessionContext } from "./launch-session-context.js";

/** Фабрика контекста — точка подмены в тестах (без реального браузера). */
export type SessionContextFactory = () => Promise<BrowserContext>;

/**
 * Боевой драйвер: один постоянный контекст на профиле `./.session/`, одна
 * страница, доступ сериализован мьютексом. Браузер поднимается лениво — при
 * первом `withPage`, поэтому простое создание драйвера (и тесты, не трогающие
 * браузер) не запускают Chromium и не занимают профиль.
 */
export class PlaywrightBrowserDriver implements BrowserDriver {
  private readonly mutex = new Mutex();
  private context?: BrowserContext;
  private page?: Page;

  constructor(private readonly launch: SessionContextFactory = launchSessionContext) {}

  withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    return this.mutex.runExclusive(async () => {
      const page = await this.ensurePage();
      return fn(page);
    });
  }

  async close(): Promise<void> {
    const context = this.context;
    this.context = undefined;
    this.page = undefined;
    if (context) await context.close();
  }

  /** Лениво поднять контекст и переиспользовать единственную страницу. */
  private async ensurePage(): Promise<Page> {
    if (!this.context) {
      this.context = await this.launch();
    }
    if (!this.page || this.page.isClosed()) {
      const [existing] = this.context.pages();
      this.page = existing ?? (await this.context.newPage());
    }
    return this.page;
  }
}
