/**
 * Фолбэк-UI: живой источник упал/не уложился в таймаут, а закэшированного примера
 * нет. Аккуратная заглушка вместо зависания — демо никогда не «повисает» в кадре.
 */
export function FallbackView({ query }: { query: string }) {
  return (
    <section className="mm-fallback">
      <span className="mm-search__logo">Megamarket</span>
      <div className="mm-fallback__icon" aria-hidden="true">
        ⚡
      </div>
      <h2 className="mm-fallback__title">Не удалось загрузить выдачу</h2>
      <p className="mm-fallback__text">
        Megamarket не ответил вовремя по запросу «{query}». Это бывает из-за защиты сайта —
        попробуйте повторить запрос.
      </p>
    </section>
  );
}
