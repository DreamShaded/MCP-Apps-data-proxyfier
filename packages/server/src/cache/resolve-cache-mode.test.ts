import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCacheMode } from "./create-cache.js";

test("пустой env → auto", () => {
  assert.equal(resolveCacheMode(undefined), "auto");
  assert.equal(resolveCacheMode(""), "auto");
});

test("валидные значения проходят как есть", () => {
  assert.equal(resolveCacheMode("auto"), "auto");
  assert.equal(resolveCacheMode("live"), "live");
  assert.equal(resolveCacheMode("cache"), "cache");
});

test("мусор → внятная ошибка, а не тихий auto", () => {
  assert.throws(() => resolveCacheMode("offline"), /invalid MCP_CACHE_MODE/);
});
