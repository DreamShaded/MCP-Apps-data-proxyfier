/** Заглушка: статическая линейка вкладов не содержит подходящих вариантов. */
export function FallbackView() {
  return (
    <section className="sb-fallback">
      <span className="sb-logo">СБЕР · Вклады</span>
      <div className="sb-fallback__icon" aria-hidden="true">
        🔍
      </div>
      <h2 className="sb-fallback__title">Вкладов не нашлось</h2>
      <p className="sb-fallback__text">По вашему запросу подходящих вкладов нет.</p>
    </section>
  );
}
