/** Форматирование для карточек вкладов. Чистые функции, без состояния. */

/** «116000» → «116 000 ₽». Узкие неразрывные пробелы как в банковском UI. */
export function formatRubles(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(value))} ₽`;
}

/** «16.5» → «16,5%». Запятая — десятичный разделитель по-русски. */
export function formatRate(value: number): string {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`;
}

/** Срок в месяцах → «6 мес», «1 год», «1 год 6 мес», «2 года». */
export function formatTerm(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${plural(years, "год", "года", "лет")}`);
  if (rest > 0 || years === 0) parts.push(`${rest || months} мес`);
  return parts.join(" ");
}

/** Русское склонение по числу: 1 год / 2 года / 5 лет. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
