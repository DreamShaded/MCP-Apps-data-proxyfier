import { useState } from "react";
import type { ProductDetail } from "./types";

/** «4990» → «4 990 ₽». Узкие неразрывные пробелы как на сайте Megamarket. */
function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

/**
 * Шумоподавление показываем отдельной строкой, поэтому исходную характеристику из
 * `specs` прячем — иначе в таблице two раза подряд одно и то же. Совпадение узкое:
 * «Шумоподавление микрофона» — про другое, его прятать нельзя.
 */
const ANC_SPEC = /активн[а-яё]*\s+шумоподавлени/i;

/** Одна строка инфо-таблицы; `accent` подсвечивает доставку — ради неё сюда и заходят. */
function InfoRow({ name, value, accent }: { name: string; value: string; accent?: boolean }) {
  return (
    <div className={`mm-specs__row${accent ? " mm-specs__row--accent" : ""}`}>
      <dt className="mm-specs__name">{name}</dt>
      <dd className="mm-specs__value">{value}</dd>
    </div>
  );
}

/**
 * Вью деталки товара: «Назад», галерея (главное фото + превью), цена, рейтинг, «В корзину»
 * и таблица с информацией о товаре — первой строкой доставка. Вертикальная компоновка
 * вместо широкой десктопной — адаптация под узкий чат-iframe.
 *
 * Открывается двумя путями с одинаковым результатом: кликом «Подробнее» в гриде и
 * голосом («покажи подробнее вот эти») — во втором случае хост присылает результат
 * `get_product`.
 *
 * «Назад» — чисто клиентское переключение (родитель держит выдачу и фильтры в стейте),
 * поэтому обычный onClick без обращения к серверу. «В корзину» инициирует app-side
 * `add_to_cart(id)` через родителя; нового пузыря в чате нет, обновляется тот же App.
 */
export function ProductDetailView({
  detail,
  onBack,
  onAddToCart,
  adding,
}: {
  detail: ProductDetail;
  onBack: () => void;
  onAddToCart: () => void;
  /** Идёт добавление именно этой карточки — спиннер в CTA. */
  adding: boolean;
}) {
  const { title, price, oldPrice, discountPercent, rating, reviewCount, images, specs, description } = detail;
  const { brand, anc, delivery } = detail;
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

      <div className="mm-detail__section">
        <h2 className="mm-detail__subtitle">О товаре</h2>
        <dl className="mm-specs">
          <InfoRow name="Доставка" value={`${delivery.label} · ${delivery.date}`} accent />
          {brand ? <InfoRow name="Бренд" value={brand} /> : null}
          {/* `null` — характеристики нет в снапшоте; писать «Нет» было бы враньём. */}
          <InfoRow name="Шумоподавление" value={anc === null ? "Не указано" : anc ? "Да" : "Нет"} />
          {specs
            .filter((s) => !ANC_SPEC.test(s.name))
            .map((s) => (
              <InfoRow key={s.name} name={s.name} value={s.value} />
            ))}
        </dl>
      </div>

      {description ? (
        <div className="mm-detail__section">
          <h2 className="mm-detail__subtitle">Описание</h2>
          <p className="mm-detail__description">{description}</p>
        </div>
      ) : null}
    </section>
  );
}
