import { test } from "node:test";
import assert from "node:assert/strict";
import type { BrowserContext, Page } from "playwright";
import { PlaywrightBrowserDriver } from "./playwright-browser-driver.js";

const tick = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Фейковая страница: достаточно для проверки сериализации и переиспользования. */
function fakePage(): Page {
  return { isClosed: () => false } as unknown as Page;
}

/** Фейковый контекст с единственной страницей. */
function fakeContext(page: Page): BrowserContext {
  return {
    pages: () => [page],
    newPage: async () => page,
    close: async () => {},
  } as unknown as BrowserContext;
}

test("withPage serializes access to the single page and launches lazily once", async () => {
  const page = fakePage();
  let launches = 0;
  const driver = new PlaywrightBrowserDriver(async () => {
    launches += 1;
    return fakeContext(page);
  });

  const log: string[] = [];
  const seen: Page[] = [];
  const op = (id: number, delay: number) =>
    driver.withPage(async (p) => {
      seen.push(p);
      log.push(`start-${id}`);
      await tick(delay);
      log.push(`end-${id}`);
    });

  await Promise.all([op(0, 15), op(1, 5)]);

  assert.deepEqual(log, ["start-0", "end-0", "start-1", "end-1"], "операции не должны перекрываться");
  assert.equal(launches, 1, "контекст поднимается лениво и ровно один раз");
  assert.equal(seen[0], seen[1], "переиспользуется одна и та же страница");

  await driver.close();
});

test("close before any use does not launch the browser", async () => {
  let launches = 0;
  const driver = new PlaywrightBrowserDriver(async () => {
    launches += 1;
    return fakeContext(fakePage());
  });
  await driver.close();
  assert.equal(launches, 0);
});
