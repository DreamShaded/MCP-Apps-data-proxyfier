/**
 * Дизайн-токены Megamarket — единый источник для всех вью флоу (выдача → деталка →
 * корзина → подтверждение). Значения извлечены из реальных CSS живого сайта
 * (`pages/market/*_files/*.css`), не подобраны на глаз.
 *
 * Ключевое: фирменный акцент Megamarket — фиолетовый (`--pui-accent-brand: #8654CC`,
 * подтверждён заливкой логотипа `logo-two-rows.a7be8a.svg`), а не зелёный — узкий
 * зелёный (`#08A652`) в реальном CSS зарезервирован под Sber-элементы (бонусы SberPay
 * и т.п.) и здесь не используется. `brandDark` — производный тёмный оттенок для
 * hover/active (в исходном CSS это отдельная dark-тема, не hover-состояние).
 */
export const megamarketTokens = {
  color: {
    brand: "#8654CC",
    brandDark: "#6E3FA8",
    brandSoft: "#F6F0FF",
    /** Плашка скидки/акции. */
    discountBg: "#EB4650",
    discountText: "#FFFFFF",
    /** Звезда рейтинга. */
    rating: "#FFAC47",
    text: "#15181A",
    textMuted: "#6B7280",
    /** Старая (зачёркнутая) цена. */
    oldPrice: "#9CA6AE",
    cardBg: "#FFFFFF",
    pageBg: "transparent",
    border: "#E4EBF0",
  },
  radius: { card: "16px", chip: "8px", image: "12px" },
  shadow: { card: "0 2px 12px rgba(21, 24, 26, 0.08)" },
  font: {
    // Реальный стек Megamarket (MegaSans — кастомный веб-шрифт, файла которого нет в
    // снапшотах) — системный fallback-хвост подхватывает рендер без загрузки шрифта.
    family: 'MegaSans, Helvetica, Arial, Verdana, Tahoma, sans-serif',
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
