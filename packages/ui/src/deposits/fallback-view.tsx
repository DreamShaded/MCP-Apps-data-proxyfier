/**
 * Фолбэк-UI: живой источник вкладов упал/не уложился в таймаут, закэшированного
 * примера нет. Аккуратная заглушка вместо зависания — демо никогда не «повисает» в кадре.
 */
export function FallbackView() {
  return (
    <section className="sb-fallback">
      <span className="sb-logo">СБЕР · Вклады</span>
      <div className="sb-fallback__icon" aria-hidden="true">
        ⏳
      </div>
      <h2 className="sb-fallback__title">Не удалось загрузить вклады</h2>
      <p className="sb-fallback__text">
        Сбербанк не ответил вовремя. Это бывает из-за защиты сайта — попробуйте повторить запрос.
      </p>
    </section>
  );
}
