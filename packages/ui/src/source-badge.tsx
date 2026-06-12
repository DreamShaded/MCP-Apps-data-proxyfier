/**
 * Бейдж источника результата — общий для Megamarket и «Вкладов». Показывает,
 * откуда пришли данные: кэш (мгновенно), живой запрос через браузер, либо фолбэк.
 * Это то, что делает разницу «кэш vs вживую» видимой в кадре демо. Источник берётся
 * из `source` ответа инструмента, а НЕ из `stale` — чистый хит из кэша имеет
 * `stale:false`, поэтому раньше визуально не отличался от живого запроса.
 *
 * Чистые хелперы (`SOURCE_META`, `formatFreshness`) вынесены и покрыты юнит-тестами;
 * сам компонент — тонкая presentational-обёртка.
 */
export type ReadSource = "hit" | "miss" | "fallback";

/** Подпись и иконка по источнику. `time:false` — у фолбэка время не показываем. */
export const SOURCE_META: Record<ReadSource, { icon: string; label: string; time: boolean; title: string }> = {
  hit: { icon: "⚡", label: "из кэша", time: true, title: "Отдано из прогретого кэша мгновенно" },
  miss: { icon: "🌐", label: "вживую", time: true, title: "Получено вживую через браузер" },
  fallback: { icon: "⚠", label: "нет связи", time: false, title: "Живой источник не ответил — показан запасной вид" },
};

/** ISO-время → компактная «свежесть» для бейджа; `null`, если времени нет/битое. */
export function formatFreshness(fetchedAt: string | null, now: number): string | null {
  if (!fetchedAt) return null;
  const t = Date.parse(fetchedAt);
  if (Number.isNaN(t)) return null;
  const diffMs = now - t;
  if (diffMs < 60_000) return "только что";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} мин назад`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} ч назад`;
  return `${Math.floor(diffMs / 86_400_000)} дн назад`;
}

export function SourceBadge({
  source,
  fetchedAt,
  now = Date.now(),
}: {
  source: ReadSource;
  fetchedAt: string | null;
  /** Инъекция «сейчас» для детерминированных тестов/снимков. */
  now?: number;
}) {
  const meta = SOURCE_META[source];
  const fresh = meta.time ? formatFreshness(fetchedAt, now) : null;
  return (
    <span className={`src-badge src-badge--${source}`} title={meta.title}>
      <span className="src-badge__icon" aria-hidden="true">
        {meta.icon}
      </span>
      {meta.label}
      {fresh ? <span className="src-badge__time"> · {fresh}</span> : null}
    </span>
  );
}
