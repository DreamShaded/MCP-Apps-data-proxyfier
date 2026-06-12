import { test } from "node:test";
import assert from "node:assert/strict";
import { formatFreshness, SOURCE_META } from "./source-badge";

const NOW = Date.parse("2026-06-11T12:00:00.000Z");

test("каждый источник имеет подпись; время скрыто только у фолбэка", () => {
  assert.equal(SOURCE_META.hit.label, "из кэша");
  assert.equal(SOURCE_META.miss.label, "вживую");
  assert.equal(SOURCE_META.fallback.label, "нет связи");
  assert.equal(SOURCE_META.hit.time, true);
  assert.equal(SOURCE_META.miss.time, true);
  assert.equal(SOURCE_META.fallback.time, false);
});

test("свежесть: пороги только что / минуты / часы / дни", () => {
  assert.equal(formatFreshness(new Date(NOW - 5_000).toISOString(), NOW), "только что");
  assert.equal(formatFreshness(new Date(NOW - 5 * 60_000).toISOString(), NOW), "5 мин назад");
  assert.equal(formatFreshness(new Date(NOW - 3 * 3_600_000).toISOString(), NOW), "3 ч назад");
  assert.equal(formatFreshness(new Date(NOW - 2 * 86_400_000).toISOString(), NOW), "2 дн назад");
});

test("свежесть: нет времени или битая метка → null", () => {
  assert.equal(formatFreshness(null, NOW), null);
  assert.equal(formatFreshness("не-дата", NOW), null);
});

test("свежесть: время в будущем (рассинхрон часов) → «только что», без отрицательных", () => {
  assert.equal(formatFreshness(new Date(NOW + 10_000).toISOString(), NOW), "только что");
});
