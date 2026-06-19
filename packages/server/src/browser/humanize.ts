import type { Page } from "playwright";

/**
 * Имитация обычного пользователя для живого браузера. Антибот Megamarket (Variti)
 * банит по поведению: поток запросов выглядит автоматическим, если навигации идут
 * всплеском без пауз и взаимодействия. Здесь два инструмента:
 *
 *   • NavigationPacer — разносит ЖИВЫЕ навигации во времени (межзапросный интервал);
 *   • actHuman        — короткая пауза + мягкие прокрутки после перехода.
 *
 * Кэш-хиты сюда НЕ попадают (отдаются мгновенно из фикстур) — пейсинг и прокрутки
 * касаются только реальных заходов в браузер (живые мисс/`fresh`, `seed:cache`).
 */

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Часы/сон/рандом — инъекция для детерминированных тестов. */
export interface HumanizeClock {
  now(): number;
  sleep(ms: number): Promise<void>;
  random(): number;
}

const realClock: HumanizeClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: () => Math.random(),
};

/**
 * Гарантирует случайный «человеческий» интервал между последовательными живыми
 * навигациями. Если предыдущая была недавно — ждёт остаток до случайного gap из
 * [minMs, maxMs]. Первый вызов не ждёт (lastAt = -∞).
 */
export class NavigationPacer {
  private lastAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly minMs = numEnv("MCP_HUMANIZE_MIN_MS", 1500),
    private readonly maxMs = numEnv("MCP_HUMANIZE_MAX_MS", 3500),
    private readonly clock: HumanizeClock = realClock,
  ) {}

  async pace(): Promise<void> {
    const gap = this.minMs + this.clock.random() * Math.max(0, this.maxMs - this.minMs);
    const elapsed = this.clock.now() - this.lastAt;
    if (elapsed < gap) await this.clock.sleep(gap - elapsed);
    this.lastAt = this.clock.now();
  }
}

/** Глобальный пейсер боевой композиции (один на процесс). */
export const navigationPacer = new NavigationPacer();

/**
 * Лёгкая имитация человека после перехода: короткая пауза + пара мягких прокруток
 * вниз и чуть вверх. Заодно дотягивает ленивые карточки/картинки. Любая ошибка
 * глотается — имитация не должна валить скрейп.
 */
export async function actHuman(page: Page, clock: HumanizeClock = realClock): Promise<void> {
  try {
    await clock.sleep(300 + clock.random() * 600);
    for (let i = 0; i < 2; i++) {
      await page.mouse.wheel(0, 500 + Math.round(clock.random() * 600));
      await clock.sleep(250 + clock.random() * 450);
    }
    await page.mouse.wheel(0, -250);
  } catch {
    /* имитация не критична */
  }
}
