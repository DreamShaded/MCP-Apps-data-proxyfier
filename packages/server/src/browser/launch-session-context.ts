import type { BrowserContext } from "playwright";
import { resolveSessionDir } from "./session-paths.js";
import { applyStealthFingerprint } from "./stealth-init-script.js";

// `playwright` здесь — алиас на rebrowser-playwright (см. package.json): патч убирает
// утечку CDP `Runtime.enable`, по которой антибот Variti палит автоматизацию даже на
// настоящем Chrome. `addBinding` — рекомендованный режим фикса; ставим по умолчанию,
// если не переопределён снаружи. Выставлено до динамического import("playwright") ниже.
process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE ??= "addBinding";

type Chromium = (typeof import("playwright"))["chromium"];
type CdpBrowser = Awaited<ReturnType<Chromium["connectOverCDP"]>>;

/** Значения `MCP_BROWSER_CHANNEL`, трактуемые как «форсировать bundled-Chromium». */
const BUNDLED_CHANNEL_ALIASES = new Set(["", "chromium", "bundled"]);

/**
 * Контексты, полученные attach-ом по CDP → их Browser-хэндл. На завершении сервера
 * такой контекст НЕЛЬЗЯ закрывать (это чужой живой Chrome) — вместо этого
 * отсоединяемся через `browser.close()` (для connected-браузера = disconnect, окно
 * остаётся жить). Свои (launchPersistentContext) контексты тут не лежат — их закрываем.
 */
const cdpBrowsersByContext = new WeakMap<BrowserContext, CdpBrowser>();

/**
 * Поднять headed-браузер на постоянном профиле `./.session/`. Единая точка
 * запуска и для драйвера сервера, и для скрипта бутстрапа — чтобы оба работали
 * на одном профиле с одинаковыми опциями.
 *
 * По умолчанию запускается НАСТОЯЩИЙ системный Chrome (`channel: "chrome"`): у
 * него валидные UA/Client-Hints и проприетарные кодеки, поэтому антибот видит
 * обычный браузер, а не bundled-Chromium Playwright. Если Chrome не установлен —
 * прозрачно откатываемся на bundled. `MCP_BROWSER_CHANNEL`: пусто/`chromium`/
 * `bundled` → форсировать bundled; иное значение (`msedge`, `chrome-beta`, …) →
 * этот канал.
 *
 * Поверх канала снимаем маркеры автоматизации (`--enable-automation` и
 * `AutomationControlled`, последний убирает `navigator.webdriver`) и патчим
 * JS-фингерпринт (см. applyStealthFingerprint). Локаль/таймзона фиксируются под
 * RU — чтобы фингерпринт был непротиворечив.
 *
 * Chromium держит на каталоге профиля singleton-локу: второй запуск на том же
 * профиле (например, сервер при открытом бутстрапе) упадёт здесь с понятной
 * ошибкой — это и есть задокументированная защита от одновременного доступа.
 */
export async function launchSessionContext(): Promise<BrowserContext> {
  // Динамический импорт: модуль драйвера тянется и в тестах (с фейковым
  // контекстом), где реального playwright и браузерных бинарей может не быть.
  const { chromium } = await import("playwright");

  // Режим attach: подключиться к УЖЕ ЗАПУЩЕННОМУ настоящему Chrome по CDP вместо
  // поднятия своего профиля. Нужен, когда антибот (Megamarket/Variti) режет
  // холодный профиль жёстким 403: прогретый вручную профиль уже несёт clearance-
  // cookie, и его переиспользуем живьём. На Chrome 149 cookie с App-Bound-
  // шифрованием расшифровываются только в родном процессе — поэтому attach к
  // живому Chrome, а не копирование профиля.
  const cdpEndpoint = process.env.MCP_CDP_ENDPOINT?.trim();
  if (cdpEndpoint) {
    return await connectOverCdp(chromium, cdpEndpoint);
  }

  const userDataDir = resolveSessionDir();

  const envChannel = process.env.MCP_BROWSER_CHANNEL?.trim();
  const wantBundled =
    envChannel !== undefined && BUNDLED_CHANNEL_ALIASES.has(envChannel.toLowerCase());
  const channel = wantBundled ? undefined : envChannel || "chrome";

  const context = await launchWithFallback(chromium, userDataDir, channel);
  await applyStealthFingerprint(context);
  return context;
}

/**
 * Запустить контекст с заданным каналом; если канал — настоящий браузер и он не
 * найден/не стартовал, откатиться на bundled-Chromium прежде чем сдаваться.
 */
async function launchWithFallback(
  chromium: Chromium,
  userDataDir: string,
  channel: string | undefined,
): Promise<BrowserContext> {
  try {
    return await chromium.launchPersistentContext(userDataDir, launchOptions(channel));
  } catch (cause) {
    // Откат на bundled-Chromium — ТОЛЬКО если настоящий браузер не найден как
    // исполняемый. При занятом профиле (singleton-лок) bundled на том же каталоге
    // упадёт так же, а исходная ошибка про лок информативнее — её и пробрасываем.
    if (channel && isMissingBrowserError(cause)) {
      try {
        return await chromium.launchPersistentContext(userDataDir, launchOptions(undefined));
      } catch (bundledCause) {
        throw profileError(userDataDir, bundledCause);
      }
    }
    throw profileError(userDataDir, cause);
  }
}

/** Ошибка похожа на «канал/исполняемый файл браузера не найден», а не на занятый профиль. */
function isMissingBrowserError(cause: unknown): boolean {
  const message = String((cause as { message?: unknown } | null)?.message ?? cause ?? "");
  return /executable doesn'?t exist|channel .* is not|Failed to launch|No such file|ENOENT|not installed/i.test(
    message,
  );
}

/**
 * Подключиться к запущенному снаружи Chrome по CDP и переиспользовать его
 * существующий (прогретый) контекст. Chrome пользователь стартует сам с
 * `--remote-debugging-port` на ВЫДЕЛЕННОМ профиле (Chrome 136+ запрещает
 * remote-debugging на дефолтном профиле). Browser-хэндл кладём в
 * `cdpBrowsersByContext`, чтобы `closeSessionContext` на завершении сервера
 * отсоединился, а не закрыл чужой Chrome.
 */
async function connectOverCdp(chromium: Chromium, endpoint: string): Promise<BrowserContext> {
  let browser: CdpBrowser;
  try {
    browser = await chromium.connectOverCDP(endpoint);
  } catch (cause) {
    throw new Error(
      `Не удалось подключиться к Chrome по CDP "${endpoint}". Запустите настоящий ` +
        `Chrome с \`--remote-debugging-port\` на выделенном профиле (см. README, ` +
        `«Обход агрессивного антибота») и проверьте хост/порт.`,
      { cause },
    );
  }
  const contexts = browser.contexts();
  const context = contexts[0];
  if (!context) {
    throw new Error(
      `Chrome по CDP "${endpoint}" не отдал ни одного контекста — убедитесь, что ` +
        `окно Chrome открыто с обычным профилем.`,
    );
  }
  // Несколько контекстов = есть incognito/второй профиль; берём дефолтный [0],
  // но предупреждаем — прогретый cookie мог осесть в другом контексте.
  if (contexts.length > 1) {
    console.error(
      `[browser] Chrome по CDP отдал ${contexts.length} контекстов; беру дефолтный. ` +
        `Если прогревали megamarket в incognito — закройте его, cookie там отдельный.`,
    );
  }
  cdpBrowsersByContext.set(context, browser);
  // initScript применится к последующим навигациям; на прогретом реальном Chrome
  // умный stealth подлинных значений не трогает — безвредно и единообразно.
  await applyStealthFingerprint(context);
  return context;
}

/**
 * Корректно завершить контекст. CDP-attach (чужой живой Chrome) → только
 * отсоединяемся (`browser.close()` для connected-браузера = disconnect, окно
 * остаётся). Свой launchPersistentContext → закрываем контекст и освобождаем профиль.
 */
export async function closeSessionContext(context: BrowserContext): Promise<void> {
  const cdpBrowser = cdpBrowsersByContext.get(context);
  if (cdpBrowser) {
    cdpBrowsersByContext.delete(context);
    await cdpBrowser.close();
    return;
  }
  await context.close();
}

/** Опции запуска: headed + снятие маркеров автоматизации + фикс локали/таймзоны. */
function launchOptions(channel: string | undefined) {
  return {
    headless: false,
    channel,
    viewport: { width: 1280, height: 900 },
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    // Убрать switch автоматизации (инфобар + CDP-флаг).
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      // Снимает navigator.webdriver и прочие AutomationControlled-теллы.
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  };
}

function profileError(userDataDir: string, cause: unknown): Error {
  return new Error(
    `Не удалось открыть профиль "${userDataDir}". Вероятно, профиль уже занят ` +
      `другим процессом (запущен сервер или bootstrap:login одновременно), ` +
      `либо не установлены браузеры Playwright (\`pnpm exec playwright install chromium\`).`,
    { cause },
  );
}
