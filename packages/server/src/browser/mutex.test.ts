import { test } from "node:test";
import assert from "node:assert/strict";
import { Mutex } from "./mutex.js";

const tick = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

test("runExclusive serializes overlapping tasks (no interleaving)", async () => {
  const mutex = new Mutex();
  const log: string[] = [];

  const task = (id: number, delay: number) =>
    mutex.runExclusive(async () => {
      log.push(`start-${id}`);
      await tick(delay);
      log.push(`end-${id}`);
    });

  // Запускаем «параллельно»: без мьютекса начала бы перемешались.
  await Promise.all([task(0, 20), task(1, 5), task(2, 10)]);

  assert.deepEqual(log, ["start-0", "end-0", "start-1", "end-1", "start-2", "end-2"]);
});

test("a rejecting task does not break the queue", async () => {
  const mutex = new Mutex();
  const order: string[] = [];

  const failing = mutex.runExclusive(async () => {
    order.push("failing");
    throw new Error("boom");
  });
  const after = mutex.runExclusive(async () => {
    order.push("after");
    return 42;
  });

  await assert.rejects(failing, /boom/);
  assert.equal(await after, 42);
  assert.deepEqual(order, ["failing", "after"]);
});

test("results are returned to the caller", async () => {
  const mutex = new Mutex();
  assert.equal(await mutex.runExclusive(async () => "value"), "value");
});
