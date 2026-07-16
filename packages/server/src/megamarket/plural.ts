/**
 * Согласование русских числительных. Нужно потому, что сводки инструментов уходят в
 * текстовый канал чата — «1 товаров» зритель читает на экране.
 *
 * Правило: 1, 21, 31… — единственное; 2–4, 22–24… — родительный единственного;
 * 0, 5–20, 25–30… — родительный множественного. Исключение — 11–14, они всегда
 * множественные, поэтому проверяются до последней цифры.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count) % 100;
  if (n >= 11 && n <= 14) return many;
  const last = n % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** «1 товар», «2 товара», «9 товаров». */
export function goods(count: number): string {
  return `${count} ${plural(count, "товар", "товара", "товаров")}`;
}
