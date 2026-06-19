import { test } from "node:test";
import assert from "node:assert/strict";
import { NavigationPacer, type HumanizeClock } from "./humanize.js";

/** Управляемые часы: время двигается только нашим sleep, рандом фиксирован. */
function fakeClock(random: number): { clock: HumanizeClock; slept: number[] } {
  const slept: number[] = [];
  let t = 0;
  return {
    slept,
    clock: {
      now: () => t,
      sleep: async (ms) => {
        slept.push(ms);
        t += ms;
      },
      random: () => random,
    },
  };
}

test("first pace does not wait", async () => {
  const { clock, slept } = fakeClock(0);
  const pacer = new NavigationPacer(1000, 3000, clock);
  await pacer.pace();
  assert.deepEqual(slept, [], "первая навигация идёт без задержки");
});

test("rapid second pace waits the remaining gap (random=0 → min gap)", async () => {
  const { clock, slept } = fakeClock(0);
  const pacer = new NavigationPacer(1000, 3000, clock);
  await pacer.pace(); // t=0, lastAt=0
  await pacer.pace(); // elapsed 0 < gap 1000 → ждём 1000
  assert.deepEqual(slept, [1000]);
});

test("random=1 widens the gap to maxMs", async () => {
  const { clock, slept } = fakeClock(1);
  const pacer = new NavigationPacer(1000, 3000, clock);
  await pacer.pace();
  await pacer.pace();
  assert.deepEqual(slept, [3000], "при random=1 интервал = maxMs");
});

test("no wait when enough time already elapsed", async () => {
  const slept: number[] = [];
  let t = 0;
  const clock: HumanizeClock = {
    now: () => t,
    sleep: async (ms) => {
      slept.push(ms);
      t += ms;
    },
    random: () => 0,
  };
  const pacer = new NavigationPacer(1000, 3000, clock);
  await pacer.pace(); // lastAt=0
  t = 5000; // прошло больше gap
  await pacer.pace();
  assert.deepEqual(slept, [], "если интервал уже выдержан — не ждём");
});
