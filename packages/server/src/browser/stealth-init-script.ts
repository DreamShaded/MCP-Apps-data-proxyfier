import type { BrowserContext } from "playwright";

/**
 * Маскировка фингерпринта автоматизации. Через `addInitScript` патчит
 * JS-поверхность страницы ДО выполнения скриптов сайта, убирая типичные теллы
 * Playwright/headless, по которым антиботы Сбера/Megamarket блокируют ещё до
 * ручного логина.
 *
 * Стратегия — УМНЫЙ stealth, а не blanket-спуф. На НАСТОЯЩЕМ Chrome (дефолтный
 * канал) plugins / WebGL-GPU / permissions уже подлинные и самосогласованные —
 * перезапись их фейками делает фингерпринт ЗАМЕТНЕЕ, не наоборот. Поэтому:
 *
 *   • всегда       — webdriver, languages, window.chrome.runtime (безвредно/полезно
 *                    на любом канале);
 *   • по условию   — plugins/mimeTypes только при пустом navigator.plugins;
 *                    WebGL-vendor только при софт-рендере (SwiftShader/llvmpipe);
 *                    permissions только когда канал выглядит как bundled.
 *
 * Строку UA здесь НЕ трогаем: подмена UA рассинхронила бы Client-Hints — сам по
 * себе маркер. Каждый патч обёрнут в try/catch: маскировка не должна ронять страницу.
 */
export async function applyStealthFingerprint(context: BrowserContext): Promise<void> {
  await context.addInitScript(stealthBrowserScript);
}

/**
 * Тело выполняется в контексте страницы (браузер), НЕ в Node. Сервер собирается
 * под Node-tsconfig без DOM-либы, поэтому ко всем браузерным глобалам обращаемся
 * через слабо-типизированный `globalThis` — типов DOM здесь нет намеренно.
 * Playwright сериализует эту функцию и запускает на каждом документе до скриптов
 * сайта (функция замкнута только на глобалы/локалы — сериализация безопасна).
 */
function stealthBrowserScript(): void {
  const g = globalThis as any;

  // ── Универсальные патчи (любой канал) ─────────────────────────────────────

  // navigator.webdriver НЕ трогаем: `--disable-blink-features=AutomationControlled`
  // + rebrowser дают нативное `false` (человеческое значение). Подмена на
  // `undefined` — анти-паттерн: детекторы флагуют «свойство удалили вручную».

  // navigator.languages — согласованно с locale ru-RU.
  try {
    Object.defineProperty(g.Navigator.prototype, "languages", {
      get: () => ["ru-RU", "ru"],
      configurable: true,
    });
  } catch {
    /* noop */
  }

  // window.chrome.runtime — у настоящего Chrome присутствует; bundled может не иметь.
  try {
    if (!g.chrome) g.chrome = {};
    if (!g.chrome.runtime) g.chrome.runtime = {};
  } catch {
    /* noop */
  }

  // ── Сигнал «канал похож на bundled-Chromium» ──────────────────────────────
  // Реальный Chrome → ничего из условных патчей не трогаем (значения подлинные).
  // Читаем настоящий UNMASKED_RENDERER WebGL ИНЛАЙНОМ: вся логика обязана жить
  // внутри этой функции — Playwright сериализует только её (внешних хелперов в
  // браузере не будет).
  let realRenderer = "";
  try {
    const canvas = g.document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) realRenderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "");
  } catch {
    /* noop */
  }
  const isSoftwareGl = /swiftshader|llvmpipe|software/i.test(realRenderer);
  let noPlugins = false;
  try {
    noPlugins = g.navigator.plugins.length === 0;
  } catch {
    /* noop */
  }
  const looksBundled = isSoftwareGl || noPlugins;

  // ── Условные патчи (только bundled) ───────────────────────────────────────

  // plugins/mimeTypes — только если набор реально пуст (bundled). На Chrome там
  // уже 5 подлинных Chrome-плагинов, перезапись фейками — анти-паттерн.
  if (noPlugins) {
    try {
      const pdfNames = [
        "PDF Viewer",
        "Chrome PDF Viewer",
        "Chromium PDF Viewer",
        "Microsoft Edge PDF Viewer",
        "WebKit built-in PDF",
      ];
      const plugins = pdfNames.map((name) => ({
        name,
        filename: "internal-pdf-viewer",
        description: "Portable Document Format",
        length: 1,
      }));
      Object.defineProperty(g.Navigator.prototype, "plugins", {
        get: () => plugins,
        configurable: true,
      });
      Object.defineProperty(g.Navigator.prototype, "mimeTypes", {
        get: () => [
          { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format" },
          { type: "text/pdf", suffixes: "pdf", description: "Portable Document Format" },
        ],
        configurable: true,
      });
    } catch {
      /* noop */
    }
  }

  // WebGL UNMASKED_VENDOR/RENDERER — только при софт-рендере (bundled/headless
  // отдаёт "Google SwiftShader" — явный телл). Реальный Chrome отдаёт настоящую
  // GPU — её НЕ трогаем. Подменяем на распространённую интегрированную графику.
  if (isSoftwareGl) {
    try {
      const VENDOR = 0x9245; // UNMASKED_VENDOR_WEBGL
      const RENDERER = 0x9246; // UNMASKED_RENDERER_WEBGL
      const patch = (ctor: { prototype: { getParameter: (p: number) => unknown } } | undefined) => {
        if (!ctor) return;
        const original = ctor.prototype.getParameter;
        ctor.prototype.getParameter = function (parameter: number): unknown {
          if (parameter === VENDOR) return "Google Inc. (Intel)";
          if (parameter === RENDERER) {
            return "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)";
          }
          return original.call(this, parameter);
        };
      };
      patch(g.WebGLRenderingContext);
      patch(g.WebGL2RenderingContext);
    } catch {
      /* noop */
    }
  }

  // permissions.query(notifications): headless отдаёт "denied" при
  // Notification.permission === "default" — рассинхрон. Чиним только на bundled,
  // чтобы на реальном Chrome не подменять нативную query (теряется toString).
  if (looksBundled) {
    try {
      const perms = g.navigator.permissions;
      const originalQuery = perms.query.bind(perms);
      perms.query = (descriptor: { name?: string }) => {
        if (descriptor && descriptor.name === "notifications") {
          return Promise.resolve({ state: g.Notification.permission });
        }
        return originalQuery(descriptor);
      };
    } catch {
      /* noop */
    }
  }
}
