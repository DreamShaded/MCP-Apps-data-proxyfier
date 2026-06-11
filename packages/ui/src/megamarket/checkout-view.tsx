import type { Cart } from "./types";

/** «4990» → «4 990 ₽». Узкие неразрывные пробелы как на сайте Megamarket. */
function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

/**
 * Экран хэндофа «открыть в браузере» — завершение флоу Megamarket. Показывает итог
 * корзины (бренд-сумма как на настоящем оформлении) и кнопку, которая выводит вперёд
 * живое headed-окно браузера уже на заполненной настоящей корзине; дальше пользователь
 * дозавершает оплату руками в окне.
 *
 * Оплата картой и 3DS сознательно НЕ встраиваются в чат-iframe (frame-busting сайта +
 * закрытая песочница; данные карты не проходят через наш UI) — об этом явная заметка ниже.
 *
 * «Назад» — чисто клиентский возврат к корзине (родитель держит её в стейте), обычный onClick.
 */
export function CheckoutView({
  cart,
  opening,
  opened,
  failed,
  onOpenBrowser,
  onBack,
}: {
  cart: Cart;
  /** Идёт вызов `checkout` (вывод окна вперёд) — спиннер в CTA. */
  opening: boolean;
  /** Окно уже выводилось вперёд хотя бы раз — показываем подтверждение. */
  opened: boolean;
  /** Последняя попытка хэндофа не подтвердила корзину — мягкая подсказка открыть вручную. */
  failed: boolean;
  onOpenBrowser: () => void;
  onBack: () => void;
}) {
  const { totalCount, totalPrice } = cart;

  return (
    <section className="mm-checkout">
      <header className="mm-detail__head">
        <button type="button" className="mm-back" onClick={onBack} aria-label="Назад в корзину">
          <span className="mm-back__chevron" aria-hidden="true">
            ‹
          </span>
          Назад
        </button>
        <span className="mm-search__logo">Megamarket</span>
      </header>

      <h1 className="mm-checkout__title">Оформление заказа</h1>

      <div className="mm-checkout__summary">
        <span className="mm-checkout__summary-label">
          К оплате{totalCount ? ` · ${totalCount} товаров` : ""}
        </span>
        <span className="mm-checkout__summary-value">
          {totalPrice !== null ? formatPrice(totalPrice) : "—"}
        </span>
      </div>

      <button type="button" className="mm-cta" onClick={onOpenBrowser} disabled={opening}>
        {opening ? (
          <>
            <span className="mm-spinner mm-spinner--on-brand" aria-hidden="true" />
            Открываем окно…
          </>
        ) : opened ? (
          "Открыть снова"
        ) : (
          "Открыть в браузере"
        )}
      </button>

      {opened && !failed ? (
        <p className="mm-checkout__opened" role="status">
          Корзина открыта в окне браузера — завершите оплату там.
        </p>
      ) : null}

      {failed ? (
        <p className="mm-checkout__failed" role="alert">
          Не удалось подтвердить корзину автоматически. Переключитесь на окно браузера на
          странице корзины и завершите оформление вручную.
        </p>
      ) : null}

      <p className="mm-checkout__note">
        Оплата картой и 3D-Secure проходят в окне браузера Megamarket, а не в чате — данные
        карты не передаются через это приложение.
      </p>
    </section>
  );
}
