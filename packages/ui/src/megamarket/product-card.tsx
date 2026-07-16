import type { Product } from "./types";

/** «4990» → «4 990 ₽». Узкие неразрывные пробелы как на сайте Megamarket. */
function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

/**
 * Карточка товара выдачи: фото, скидка, название, цена, рейтинг, «В корзину» + «Подробнее».
 * Компактная под чат-iframe. «Подробнее» инициирует app-side `get_product(id)`, «В корзину»
 * — app-side `add_to_cart(id)` через родителя; нового пузыря в чате нет, обновляется тот же
 * App. Во время живого добавления карточка показывает индикатор загрузки в самой кнопке.
 */
export function ProductCard({
  product,
  onOpen,
  onAdd,
  loading,
  adding,
  busy,
}: {
  product: Product;
  onOpen: () => void;
  onAdd: () => void;
  /** Грузится именно эта карточка — показываем «Загружаем…». */
  loading: boolean;
  /** В корзину добавляется именно эта карточка — спиннер в кнопке «В корзину». */
  adding: boolean;
  /** Идёт какая-то операция (деталка/добавление) — кнопки заблокированы против гонки. */
  busy: boolean;
}) {
  const { title, price, oldPrice, discountPercent, imageUrl, rating, reviewCount, delivery } = product;
  return (
    <article className="mm-card">
      <div className="mm-card__media">
        {imageUrl ? (
          <img className="mm-card__img" src={imageUrl} alt={title} loading="lazy" />
        ) : (
          <div className="mm-card__img mm-card__img--empty" aria-hidden="true" />
        )}
        {discountPercent ? <span className="mm-card__discount">−{discountPercent}%</span> : null}
      </div>

      <div className="mm-card__body">
        <div className="mm-card__prices">
          <span className="mm-card__price">{price !== null ? formatPrice(price) : "Цена по запросу"}</span>
          {oldPrice !== null && (price === null || oldPrice > price) ? (
            <span className="mm-card__old-price">{formatPrice(oldPrice)}</span>
          ) : null}
        </div>

        <h3 className="mm-card__title" title={title}>
          {title}
        </h3>

        {rating !== null ? (
          <div className="mm-card__rating">
            <span className="mm-card__star" aria-hidden="true">
              ★
            </span>
            <span className="mm-card__rating-value">{rating.toFixed(1)}</span>
            {reviewCount !== null ? <span className="mm-card__reviews">· {reviewCount}</span> : null}
          </div>
        ) : (
          <div className="mm-card__rating mm-card__rating--empty">Нет оценок</div>
        )}

        {/* На быстрой доставке держится кейс «успеть к сроку» — выделяем её в карточке. */}
        <div className={`mm-card__delivery${delivery.days <= 2 ? " mm-card__delivery--fast" : ""}`}>
          <span className="mm-card__delivery-label">Доставка</span> {delivery.label}
        </div>

        <div className="mm-card__actions">
          <button type="button" className="mm-card__add" onClick={onAdd} disabled={busy}>
            {adding ? (
              <>
                <span className="mm-spinner" aria-hidden="true" />
                Добавляем…
              </>
            ) : (
              "В корзину"
            )}
          </button>
          <button type="button" className="mm-card__more" onClick={onOpen} disabled={busy}>
            {loading ? "Загружаем…" : "Подробнее"}
          </button>
        </div>
      </div>
    </article>
  );
}
