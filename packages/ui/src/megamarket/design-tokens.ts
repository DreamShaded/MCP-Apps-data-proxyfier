/**
 * Дизайн-токены Megamarket — единый источник для всех вью флоу (выдача → деталка →
 * корзина). Бренд Megamarket — фиолетовый с градиентом; цена/скидка/рейтинг —
 * фирменные плашки.
 *
 * ВНИМАНИЕ (HITL): значения подобраны по фирменному стилю Megamarket, но финальная
 * визуальная сверка — ручная, на боевой сборке Claude Desktop. Точные hex берутся со
 * скриншота живого сайта (Playwright-сессия + ai-multimodal); правятся здесь —
 * одна точка, все вью подхватывают через CSS-переменные.
 */
export const megamarketTokens = {
  color: {
    /** Фирменный фиолетовый — основные акценты, цена-выгода, активные элементы. */
    brand: "#7000FF",
    brandDark: "#5A00CC",
    brandSoft: "#F0E6FF",
    /** Градиент бренда (логотип/CTA). */
    gradientFrom: "#7000FF",
    gradientTo: "#A100FF",
    /** Плашка скидки — пурпурно-розовая «выгода». */
    discountBg: "#F5167E",
    discountText: "#FFFFFF",
    /** Звезда рейтинга. */
    rating: "#FF9500",
    text: "#1A1A2E",
    textMuted: "#6B6B7B",
    /** Старая (зачёркнутая) цена. */
    oldPrice: "#9A9AA8",
    cardBg: "#FFFFFF",
    pageBg: "transparent",
    border: "#ECECF2",
  },
  radius: { card: "16px", chip: "8px", image: "12px" },
  shadow: { card: "0 2px 12px rgba(34, 0, 80, 0.08)" },
  font: {
    // Системный стек без CDN (требование песочницы-iframe), близкий к гротеску бренда.
    family: '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif',
  },
} as const;

export type MegamarketTokens = typeof megamarketTokens;

/**
 * Развернуть токены в строку CSS-переменных под `:root`. UI рендерит её один раз в
 * `<style>`, дальше вёрстка ссылается на `var(--mm-*)` — TS остаётся единственным
 * источником значений (DRY между всеми вью Megamarket).
 */
export function tokensToCssVars(t: MegamarketTokens = megamarketTokens): string {
  const vars: string[] = [
    `--mm-brand:${t.color.brand}`,
    `--mm-brand-dark:${t.color.brandDark}`,
    `--mm-brand-soft:${t.color.brandSoft}`,
    `--mm-gradient-from:${t.color.gradientFrom}`,
    `--mm-gradient-to:${t.color.gradientTo}`,
    `--mm-discount-bg:${t.color.discountBg}`,
    `--mm-discount-text:${t.color.discountText}`,
    `--mm-rating:${t.color.rating}`,
    `--mm-text:${t.color.text}`,
    `--mm-text-muted:${t.color.textMuted}`,
    `--mm-old-price:${t.color.oldPrice}`,
    `--mm-card-bg:${t.color.cardBg}`,
    `--mm-page-bg:${t.color.pageBg}`,
    `--mm-border:${t.color.border}`,
    `--mm-radius-card:${t.radius.card}`,
    `--mm-radius-chip:${t.radius.chip}`,
    `--mm-radius-image:${t.radius.image}`,
    `--mm-shadow-card:${t.shadow.card}`,
    `--mm-font:${t.font.family}`,
  ];
  return `:root{${vars.join(";")}}`;
}
