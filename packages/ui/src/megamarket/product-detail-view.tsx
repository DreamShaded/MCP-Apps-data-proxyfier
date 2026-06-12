import { useState } from "react";
import type { ProductDetail } from "./types";
import { SourceBadge, type ReadSource } from "../source-badge";

/** «4990» → «4 990 ₽». Узкие неразрывные пробелы как на сайте Megamarket. */
function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

/**
 * Вью деталки товара: шапка с «Назад», галерея (главное фото + превью), блок цены,
 * рейтинг, характеристики таблицей, описание и кнопка «в корзину». Вертикальная
 * компоновка вместо широкой десктопной — адаптация под узкий чат-iframe.
 *
 * «Назад» — чисто клиентское переключение (родитель держит выдачу в стейте), поэтому
 * это обычный onClick без обращения к серверу. «В корзину» инициирует app-side
 * `add_to_cart(id)` через родителя; во время живого добавления кнопка показывает спиннер.
 */
export function ProductDetailView({
  detail,
  onBack,
  onAddToCart,
  adding,
  source,
  fetchedAt,
}: {
  detail: ProductDetail;
  onBack: () => void;
  onAddToCart: () => void;
  /** Идёт живое добавление этой карточки в корзину — спиннер в CTA. */
  adding: boolean;
  /** Источник деталки (как была получена) — для бейджа кэш/вживую. */
  source?: ReadSource;
  fetchedAt?: string | null;
}) {
  const { title, price, oldPrice, discountPercent, rating, reviewCount, images, specs, description } = detail;
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0] ?? null;

  return (
    <section className="mm-detail">
      <header className="mm-detail__head">
        <button type="button" className="mm-back" onClick={onBack} aria-label="Назад к выдаче">
          <span className="mm-back__chevron" aria-hidden="true">
            ‹
          </span>
          Назад
        </button>
        <span className="mm-search__logo">Megamarket</span>
        {source ? <SourceBadge source={source} fetchedAt={fetchedAt ?? null} /> : null}
      </header>

      <div className="mm-detail__gallery">
        <div className="mm-detail__stage">
          {main ? (
            <img className="mm-detail__img" src={main} alt={title} />
          ) : (
            <div className="mm-detail__img mm-card__img--empty" aria-hidden="true" />
          )}
          {discountPercent ? <span className="mm-card__discount">−{discountPercent}%</span> : null}
        </div>
        {images.length > 1 ? (
          <div className="mm-detail__thumbs">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                className={`mm-detail__thumb${i === active ? " mm-detail__thumb--active" : ""}`}
                onClick={() => setActive(i)}
                aria-label={`Фото ${i + 1}`}
              >
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <h1 className="mm-detail__title">{title}</h1>

      {rating !== null ? (
        <div className="mm-card__rating mm-detail__rating">
          <span className="mm-card__star" aria-hidden="true">
            ★
          </span>
          <span className="mm-card__rating-value">{rating.toFixed(1)}</span>
          {reviewCount !== null ? <span className="mm-card__reviews">· {reviewCount} отзывов</span> : null}
        </div>
      ) : null}

      <div className="mm-detail__prices">
        <span className="mm-detail__price">{price !== null ? formatPrice(price) : "Цена по запросу"}</span>
        {oldPrice !== null && (price === null || oldPrice > price) ? (
          <span className="mm-card__old-price mm-detail__old-price">{formatPrice(oldPrice)}</span>
        ) : null}
      </div>

      <button type="button" className="mm-cta" onClick={onAddToCart} disabled={adding}>
        {adding ? (
          <>
            <span className="mm-spinner mm-spinner--on-brand" aria-hidden="true" />
            Добавляем…
          </>
        ) : (
          "В корзину"
        )}
      </button>

      {specs.length ? (
        <div className="mm-detail__section">
          <h2 className="mm-detail__subtitle">Характеристики</h2>
          <dl className="mm-specs">
            {specs.map((s) => (
              <div className="mm-specs__row" key={s.name}>
                <dt className="mm-specs__name">{s.name}</dt>
                <dd className="mm-specs__value">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {description ? (
        <div className="mm-detail__section">
          <h2 className="mm-detail__subtitle">Описание</h2>
          <p className="mm-detail__description">{description}</p>
        </div>
      ) : null}
    </section>
  );
}
