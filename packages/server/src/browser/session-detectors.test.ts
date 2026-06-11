import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSiteLogin, type ProbePage, type SiteDetector } from "./session-detectors.js";

const DETECTOR: SiteDetector = {
  site: "megamarket",
  label: "Megamarket",
  url: "https://example.test/",
  loggedInSelector: "#account",
  loggedOutSelector: "#login",
};

/** Фейковая страница: `visible` — множество селекторов, которые «видны». */
function fakePage(visible: Set<string>, opts: { gotoThrows?: boolean } = {}): ProbePage {
  return {
    goto: async () => {
      if (opts.gotoThrows) throw new Error("net down");
      return null;
    },
    locator: (selector: string) => ({
      first: () => ({
        waitFor: async () => {
          if (!visible.has(selector)) throw new Error("timeout");
        },
      }),
    }),
  };
}

test("logged in: only the account marker is visible", async () => {
  const s = await detectSiteLogin(fakePage(new Set(["#account"])), DETECTOR);
  assert.equal(s.loggedIn, true);
});

test("logged out: only the login marker is visible", async () => {
  const s = await detectSiteLogin(fakePage(new Set(["#login"])), DETECTOR);
  assert.equal(s.loggedIn, false);
});

test("ambiguous: neither marker visible → null with detail", async () => {
  const s = await detectSiteLogin(fakePage(new Set()), DETECTOR);
  assert.equal(s.loggedIn, null);
  assert.match(String(s.detail), /не найдены/);
});

test("both markers visible → prefers logged-in", async () => {
  const s = await detectSiteLogin(fakePage(new Set(["#account", "#login"])), DETECTOR);
  assert.equal(s.loggedIn, true);
});

test("navigation error → null with error detail, never throws", async () => {
  const s = await detectSiteLogin(fakePage(new Set(), { gotoThrows: true }), DETECTOR);
  assert.equal(s.loggedIn, null);
  assert.match(String(s.detail), /ошибка проверки/);
});
