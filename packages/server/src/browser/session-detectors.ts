/**
 * Определение залогиненности на сайте по DOM-маркерам. Логика проверки —
 * боевая (навигация + ожидание видимого маркера); сами CSS/text-селекторы —
 * это конфиг, который доводится в ходе HITL-бутстрапа на живых сайтах под
 * реальной сессией (точные селекторы кабинета не видны без входа).
 */

/** Минимальный интерфейс страницы, который структурно реализует Playwright `Page`. */
export interface ProbePage {
  goto(
    url: string,
    options?: {
      waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
      timeout?: number;
    },
  ): Promise<unknown>;
  locator(selector: string): ProbeLocator;
}

export interface ProbeLocator {
  first(): ProbeElement;
}

export interface ProbeElement {
  waitFor(options?: {
    state?: "attached" | "detached" | "visible" | "hidden";
    timeout?: number;
  }): Promise<void>;
}

export interface SiteDetector {
  /** Машинный ключ сайта. */
  site: string;
  /** Человекочитаемая метка для отчёта. */
  label: string;
  /** Страница-зонд. */
  url: string;
  /** Маркер «вошёл» (виден ⇒ залогинен), напр. ссылка на личный кабинет. */
  loggedInSelector: string;
  /** Маркер «не вошёл» (виден ⇒ разлогинен), напр. кнопка «Войти». */
  loggedOutSelector: string;
}

export interface SiteSessionStatus {
  site: string;
  label: string;
  /** `true` — вошёл, `false` — не вошёл, `null` — определить не удалось. */
  loggedIn: boolean | null;
  /** Пояснение для неоднозначных/ошибочных случаев. */
  detail?: string;
}

/** Сколько ждать появления маркера, прежде чем считать его отсутствующим. */
const MARKER_TIMEOUT_MS = 4000;
/** Бюджет навигации до зонд-страницы. */
const NAV_TIMEOUT_MS = 15000;

/**
 * Сайты, чью сессию проверяет `check_session`. Селекторы — HITL-настраиваемые:
 * уточняются на живых сайтах под реальной сессией при бутстрапе.
 *
 * При доводке маркер «вошёл» брать строго внутри шапки и только из
 * аутентифицированного состояния (аватар/имя аккаунта), а не подстрокой по
 * `href` — фрагменты вроде `personal`/`online.sberbank` встречаются и в
 * футере/промо разлогиненной страницы. Опасное направление ошибки —
 * ложноположительный «вошёл»: тул отрапортует `ok:true` перед демо, а сессии
 * на деле нет.
 */
export const SITE_DETECTORS: SiteDetector[] = [
  {
    site: "megamarket",
    label: "Megamarket",
    url: "https://megamarket.ru/",
    loggedInSelector: '[href*="personal"]',
    loggedOutSelector: 'text="Войти"',
  },
  {
    site: "sber",
    label: "Сбер",
    url: "https://www.sberbank.ru/",
    loggedInSelector: '[href*="online.sberbank"]',
    loggedOutSelector: 'text="Войти"',
  },
];

/** Виден ли маркер в пределах таймаута (ожидание видимости, не мгновенная проверка). */
async function isMarkerVisible(page: ProbePage, selector: string): Promise<boolean> {
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeout: MARKER_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

function status(d: SiteDetector, loggedIn: boolean | null, detail?: string): SiteSessionStatus {
  return { site: d.site, label: d.label, loggedIn, detail };
}

/** Открыть зонд-страницу и определить статус входа по маркерам. */
export async function detectSiteLogin(page: ProbePage, d: SiteDetector): Promise<SiteSessionStatus> {
  try {
    await page.goto(d.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    const [loggedIn, loggedOut] = await Promise.all([
      isMarkerVisible(page, d.loggedInSelector),
      isMarkerVisible(page, d.loggedOutSelector),
    ]);
    if (loggedIn && !loggedOut) return status(d, true);
    if (loggedOut && !loggedIn) return status(d, false);
    if (loggedIn && loggedOut) {
      return status(d, true, "видны оба маркера — приоритет у маркера входа");
    }
    return status(d, null, "ни маркер входа, ни маркер выхода не найдены");
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return status(d, null, `ошибка проверки: ${message}`);
  }
}
