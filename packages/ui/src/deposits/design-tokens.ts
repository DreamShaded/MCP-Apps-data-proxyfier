/**
 * Дизайн-токены «Вклады Сбера» — СВОЯ дизайн-система, не общая с Megamarket.
 * Бренд Сбера: фирменный зелёный, мягкие скругления, спокойный «банковский» контраст;
 * рейтинг/выгода без кричащих плашек.
 *
 * ВНИМАНИЕ (HITL): значения подобраны по фирменному стилю Сбера, но финальная
 * визуальная сверка — ручная, на боевой сборке Claude Desktop. Точные hex берутся со
 * скриншота живого sberbank.ru (Playwright-сессия + ai-multimodal); правятся здесь —
 * одна точка, все вью подхватывают через CSS-переменные `--sb-*`.
 */
export const depositsTokens = {
  color: {
    /** Фирменный зелёный Сбера — основные акценты, ставка, активные элементы. */
    brand: "#21A038",
    brandDark: "#178a2c",
    brandSoft: "#E8F6EC",
    /** Градиент бренда (логотип/шапка): зелёный → фирменный бирюзовый. */
    gradientFrom: "#21A038",
    gradientTo: "#00B2A9",
    /** Жёлтый Сбера — тонкий акцент (значок капитализации/выгоды). */
    accent: "#FAE000",
    text: "#1F1F22",
    textMuted: "#8B8B95",
    cardBg: "#FFFFFF",
    pageBg: "transparent",
    border: "#E8E8EE",
    /** Заливка трека слайдера до ползунка. */
    trackFill: "#21A038",
    trackBg: "#E3E8E5",
  },
  radius: { card: "18px", control: "12px", chip: "8px" },
  shadow: { card: "0 2px 14px rgba(0, 60, 20, 0.08)" },
  font: {
    // Системный стек без CDN (требование песочницы-iframe), близкий к SB Sans.
    family: '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif',
  },
} as const;

export type DepositsTokens = typeof depositsTokens;

/**
 * Развернуть токены в строку CSS-переменных под `:root`. UI рендерит её один раз в
 * `<style>`, дальше вёрстка ссылается на `var(--sb-*)` — TS остаётся единственным
 * источником значений (DRY между всеми вью вкладов).
 */
export function tokensToCssVars(t: DepositsTokens = depositsTokens): string {
  const vars: string[] = [
    `--sb-brand:${t.color.brand}`,
    `--sb-brand-dark:${t.color.brandDark}`,
    `--sb-brand-soft:${t.color.brandSoft}`,
    `--sb-gradient-from:${t.color.gradientFrom}`,
    `--sb-gradient-to:${t.color.gradientTo}`,
    `--sb-accent:${t.color.accent}`,
    `--sb-text:${t.color.text}`,
    `--sb-text-muted:${t.color.textMuted}`,
    `--sb-card-bg:${t.color.cardBg}`,
    `--sb-page-bg:${t.color.pageBg}`,
    `--sb-border:${t.color.border}`,
    `--sb-track-fill:${t.color.trackFill}`,
    `--sb-track-bg:${t.color.trackBg}`,
    `--sb-radius-card:${t.radius.card}`,
    `--sb-radius-control:${t.radius.control}`,
    `--sb-radius-chip:${t.radius.chip}`,
    `--sb-shadow-card:${t.shadow.card}`,
    `--sb-font:${t.font.family}`,
  ];
  return `:root{${vars.join(";")}}`;
}
