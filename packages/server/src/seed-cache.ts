/**
 * Скелет наполнения кэша «золотыми» сценариями (`pnpm seed:cache`).
 *
 * Реальный прогон — живьём через Playwright под залогиненной сессией — это
 * срез 09, который зависит от готовых инструментов чтения (04 search, 05 деталка,
 * 08 вклады). Здесь только каркас и точки-заглушки: список золотых сценариев и
 * запись их в коммитимые фикстуры. Каждая точка наполнения помечена TODO(09).
 *
 * Скелет идемпотентен по форме: повторный прогон перезаписал бы те же фикстуры
 * по тем же ключам (запись по нормализованному ключу — без дублей).
 */
import { buildCacheKey } from "./cache/cache-key.js";

/** Золотой сценарий: инструмент + аргументы, ответ которого должен отдаваться мгновенно. */
interface GoldenScenario {
  tool: string;
  args: Record<string, unknown>;
  note: string;
}

/** Минимальный золотой набор из PRD (деталки товаров добавит срез 09 по факту выдачи). */
const GOLDEN_SCENARIOS: GoldenScenario[] = [
  { tool: "search_products", args: { query: "беспроводные наушники", maxPrice: 5000 }, note: "наушники до 5000 ₽" },
  { tool: "search_deposits", args: { amount: 500_000, termMonths: 12 }, note: "вклад 500к на год" },
];

async function seed(): Promise<void> {
  console.error("[seed:cache] Скелет наполнения. Живой прогон через Playwright — срез 09.");
  for (const scenario of GOLDEN_SCENARIOS) {
    const { id } = buildCacheKey(scenario.tool, scenario.args);
    console.error(`[seed:cache] (заглушка) ${scenario.note} → ${id}.json`);
    // TODO(09): вызвать живой инструмент и записать ответ как золотую фикстуру
    //   store.set(id, { ..., golden: true, ttlMs: null }).
  }
  console.error(`[seed:cache] Точек наполнения: ${GOLDEN_SCENARIOS.length} (все — заглушки).`);
}

seed().catch((error) => {
  console.error("[seed:cache] fatal:", error);
  process.exit(1);
});
