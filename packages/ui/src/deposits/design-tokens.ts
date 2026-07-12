/**
 * Дизайн-токены «Вклады Сбера» — СВОЯ дизайн-система, не общая с Megamarket. Значения
 * извлечены из реального CSS `sberbank.ru` (`pages/bank/*_files/uiKitt.css`), не подобраны
 * на глаз.
 *
 * `brand` — общеизвестный фирменный зелёный `#21A038`: в реальном CSS встречается точечно
 * (`.dk-sbol-button_type_primary-white{background:#21A038}` — «первичная белая» кнопка),
 * но именно он взят как акцент CTA. `brandDark` — соседний «рабочий» зелёный кита
 * (`#148F2B`/`#0D8523`), которым в реальной вёрстке закрашено большинство decorative-элементов.
 */
export const depositsTokens = {
  color: {
    brand: "#21A038",
    brandDark: "#148F2B",
    brandSoft: "#E8F6EC",
    text: "#262626",
    textMuted: "#878B90",
    cardBg: "#FFFFFF",
    pageBg: "transparent",
    border: "#CED1D5",
    /** Заливка трека слайдера до ползунка. */
    trackFill: "#21A038",
    trackBg: "#CED1D5",
  },
  radius: { card: "18px", control: "12px", chip: "8px" },
  shadow: { card: "0 2px 14px rgba(38, 38, 38, 0.08)" },
  font: {
    // Реальный стек Сбера (SBSans* — кастомные веб-шрифты, файлов которых нет в
    // снапшотах) — системный fallback-хвост подхватывает рендер без загрузки шрифта.
    family: 'SBSansInterface, OpenSans, "Helvetica Neue", Helvetica, Arial, sans-serif',
    heading: 'SBSansDisplay, OpenSans, "Helvetica Neue", Helvetica, Arial, sans-serif',
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
    `--sb-font-heading:${t.font.heading}`,
  ];
  return `:root{${vars.join(";")}}`;
}
