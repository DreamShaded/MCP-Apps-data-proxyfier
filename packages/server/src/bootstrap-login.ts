import { launchSessionContext } from "./browser/launch-session-context.js";
import { resolveSessionDir } from "./browser/session-paths.js";

/**
 * Разовый ручной логин. Поднимает headed-браузер на профиле `./.session/`,
 * открывает Сбер и Megamarket — человек вручную логинится (телефон+SMS, капча),
 * после чего закрывает окно. Куки/localStorage остаются в профиле, и сервер
 * затем работает под уже готовой сессией на том же профиле.
 *
 * Сервер и этот скрипт нельзя запускать одновременно: Chromium держит на
 * профиле singleton-локу, второй запуск упадёт в `launchSessionContext`.
 */
const SITES = ["https://megamarket.ru/", "https://www.sberbank.ru/"];

async function main(): Promise<void> {
  console.error(`[bootstrap:login] профиль: ${resolveSessionDir()}`);
  const context = await launchSessionContext();

  // Открыть оба сайта в отдельных вкладках для ручного входа.
  const [first] = context.pages();
  const page = first ?? (await context.newPage());
  await page.goto(SITES[0]).catch(() => {});
  for (const url of SITES.slice(1)) {
    const tab = await context.newPage();
    await tab.goto(url).catch(() => {});
  }

  console.error(
    "[bootstrap:login] Войдите вручную в Сбер и Megamarket (телефон+SMS, капча), " +
      "затем закройте окно браузера — сессия сохранится в профиле.",
  );

  // Ждём, пока человек закроет браузер. Слушаем оба события: при ручном
  // закрытии окна context-`close` приходит не во всех версиях Playwright,
  // поэтому страхуемся отключением самого браузера.
  await new Promise<void>((resolve) => {
    context.on("close", () => resolve());
    context.browser()?.on("disconnected", () => resolve());
  });
  console.error("[bootstrap:login] браузер закрыт, сессия сохранена.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("[bootstrap:login] ошибка:", error);
    process.exit(1);
  },
);
