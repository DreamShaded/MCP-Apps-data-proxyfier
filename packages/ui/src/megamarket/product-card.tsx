import type { Product } from "./types";

/** «4990» → «4 990 ₽». Узкие неразрывные пробелы как на сайте Megamarket. */
function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

/** Карточка товара выдачи: фото, скидка, название, цена, рейтинг. Компактная под чат-iframe. */
export function ProductCard({ product }: { product: Product }) {
  const { title, price, oldPrice, discountPercent, imageUrl, rating, reviewCount } = product;
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
      </div>
    </article>
  );
}
