import type { Cart } from "./types";

/** «4990» → «4 990 ₽». Узкие неразрывные пробелы как на сайте Megamarket. */
function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

/**
 * Вью реальной корзины Megamarket: шапка с «Назад», список позиций (фото, название,
 * цена за единицу × количество, сумма по строке) и подвал с итогом. Адаптация под узкий
 * чат-iframe — компактные строки, вертикальная компоновка, без горизонтального скролла.
 *
 * «Назад» — чисто клиентское переключение (родитель держит предыдущую вью в стейте),
 * поэтому обычный onClick без обращения к серверу.
 */
export function CartView({ cart, onBack }: { cart: Cart; onBack: () => void }) {
  const { items, totalCount, totalPrice } = cart;

  return (
    <section className="mm-cart">
      <header className="mm-detail__head">
        <button type="button" className="mm-back" onClick={onBack} aria-label="Назад к покупкам">
          <span className="mm-back__chevron" aria-hidden="true">
            ‹
          </span>
          Назад
        </button>
        <span className="mm-search__logo">Megamarket</span>
      </header>

      <h1 className="mm-cart__title">Корзина</h1>

      {items.length ? (
        <>
          <ul className="mm-cart__list">
            {items.map((item) => (
              <li className="mm-cart__item" key={item.id}>
                <div className="mm-cart__media">
                  {item.imageUrl ? (
                    <img className="mm-cart__img" src={item.imageUrl} alt={item.title} loading="lazy" />
                  ) : (
                    <div className="mm-cart__img mm-card__img--empty" aria-hidden="true" />
                  )}
                </div>
                <div className="mm-cart__info">
                  <h2 className="mm-cart__name" title={item.title}>
                    {item.title}
                  </h2>
                  <span className="mm-cart__unit">
                    {item.price !== null ? formatPrice(item.price) : "Цена по запросу"}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </span>
                </div>
                <span className="mm-cart__line">
                  {item.lineTotal !== null
                    ? formatPrice(item.lineTotal)
                    : item.price !== null
                      ? formatPrice(item.price * item.quantity)
                      : "—"}
                </span>
              </li>
            ))}
          </ul>

          <footer className="mm-cart__footer">
            <span className="mm-cart__total-label">
              Итого{totalCount ? ` · ${totalCount} товаров` : ""}
            </span>
            <span className="mm-cart__total-value">
              {totalPrice !== null ? formatPrice(totalPrice) : "—"}
            </span>
          </footer>
        </>
      ) : (
        <p className="mm-search__empty">Корзина пуста. Добавьте товары из выдачи или карточки.</p>
      )}
    </section>
  );
}
