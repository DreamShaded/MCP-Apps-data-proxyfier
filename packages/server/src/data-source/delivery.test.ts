import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCalendar, buildDelivery, deliveryDaysFor } from "./delivery.js";

// Среда, 15 июля 2026 — фиксированная точка отсчёта: «завтра» обязано быть 16-м.
const WED = new Date(2026, 6, 15, 12, 0, 0);

test("explicit ids take their days from delivery.json", () => {
  assert.equal(deliveryDaysFor("700008245036"), 1);
  assert.equal(deliveryDaysFor("100061445418"), 14);
});

// Иначе выдача «дышала» бы: один и тот же товар менял бы срок между вызовами.
test("unlisted ids get a stable, in-range fallback", () => {
  const first = deliveryDaysFor("no-such-id-42");
  assert.equal(deliveryDaysFor("no-such-id-42"), first, "must be deterministic");
  assert.ok(first >= 1 && first <= 14, `expected 1..14, got ${first}`);
});

test("delivery date is today plus the product's days", () => {
  assert.equal(buildDelivery("700008245036", WED).date, "2026-07-16");
  assert.equal(buildDelivery("600005366927", WED).date, "2026-07-17");
  assert.equal(buildDelivery("100061445418", WED).date, "2026-07-29");
});

// Сайт пишет только «Сегодня», «Завтра» и дату — «Послезавтра» у него нет.
test("labels follow the real site's wording", () => {
  assert.equal(buildDelivery("700008245036", WED).label, "Завтра");
  assert.equal(buildDelivery("600005366927", WED).label, "17 июля");
  assert.equal(buildDelivery("100061445418", WED).label, "29 июля");
});

test("calendar resolves today, tomorrow and names the weekdays", () => {
  const c = buildCalendar(WED);
  assert.equal(c.today.date, "2026-07-15");
  assert.equal(c.today.weekday, "среда");
  assert.equal(c.tomorrow.date, "2026-07-16");
  assert.equal(c.tomorrow.weekday, "четверг");
});

// Ровно этот шаг и делает агент, разрешая «до пятницы» в дату.
test("calendar lets the agent resolve «пятница» to a concrete date", () => {
  const friday = buildCalendar(WED).upcoming.find((d) => d.weekday === "пятница");
  assert.ok(friday, "the next 7 days must contain a Friday");
  assert.equal(friday.date, "2026-07-17");
  assert.equal(friday.inDays, 2);
});

test("upcoming covers the next 7 days without repeating today", () => {
  const c = buildCalendar(WED);
  assert.equal(c.upcoming.length, 7);
  assert.deepEqual(c.upcoming.map((d) => d.inDays), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(!c.upcoming.some((d) => d.date === c.today.date));
});

// Дата-арифметика в UTC — перевод часов не должен «съедать» или добавлять день.
test("crossing a DST boundary still advances by whole days", () => {
  // В Европе переход на летнее время — последнее воскресенье марта (29.03.2026).
  const beforeDst = new Date(2026, 2, 28, 12, 0, 0);
  assert.equal(buildDelivery("700008245036", beforeDst).date, "2026-03-29");
  assert.equal(buildDelivery("600005366927", beforeDst).date, "2026-03-30");
});

test("a year boundary rolls over correctly", () => {
  const nye = new Date(2026, 11, 31, 12, 0, 0);
  assert.equal(buildDelivery("700008245036", nye).date, "2027-01-01");
  assert.equal(buildDelivery("700008245036", nye).label, "Завтра");
});
