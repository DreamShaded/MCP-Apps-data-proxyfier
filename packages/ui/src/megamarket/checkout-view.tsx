import type { Cart, CheckoutResult } from "./types";

/** «4990» → «4 990 ₽». Узкие неразрывные пробелы как на сайте Megamarket. */
function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

/**
 * Экран оформления заказа — завершение флоу Megamarket. Дизайн-референс —
 * `pages/market/checkout/` (структура строки корзины `multicart-item`). Данные статические
 * (нет реальной оплаты/3DS) — «Подтвердить заказ» вызывает `checkout` и показывает
 * статическое подтверждение с итогом; хэндофа в браузер нет.
 *
 * «Назад» — чисто клиентский возврат к корзине (родитель держит её в стейте), обычный onClick.
 */
type CheckoutViewProps =
  | { cart: Cart; confirming: boolean; confirmed?: false; onConfirm: () => void; onBack: () => void }
  | { result: CheckoutResult; confirmed: true; onBack: () => void; onConfirm: () => void };

export function CheckoutView(props: CheckoutViewProps) {
  const cart = props.confirmed ? props.result.cart : props.cart;
  const { totalCount, totalPrice } = cart;

  return (
    <section className="mm-checkout">
      <header className="mm-detail__head">
        <button type="button" className="mm-back" onClick={props.onBack} aria-label="Назад в корзину">
          <span className="mm-back__chevron" aria-hidden="true">
            ‹
          </span>
          Назад
        </button>
        <span className="mm-search__logo">Megamarket</span>
      </header>

      <h1 className="mm-checkout__title">{props.confirmed ? "Заказ оформлен" : "Оформление заказа"}</h1>

      <div className="mm-checkout__summary">
        <span className="mm-checkout__summary-label">
          {props.confirmed ? "Оплачено" : "К оплате"}
          {totalCount ? ` · ${totalCount} товаров` : ""}
        </span>
        <span className="mm-checkout__summary-value">{totalPrice !== null ? formatPrice(totalPrice) : "—"}</span>
      </div>

      {props.confirmed ? (
        <p className="mm-checkout__opened" role="status">
          Заказ подтверждён {new Date(props.result.confirmedAt).toLocaleString("ru-RU")}.
        </p>
      ) : (
        <button type="button" className="mm-cta" onClick={props.onConfirm} disabled={props.confirming}>
          {props.confirming ? (
            <>
              <span className="mm-spinner mm-spinner--on-brand" aria-hidden="true" />
              Оформляем…
            </>
          ) : (
            "Подтвердить заказ"
          )}
        </button>
      )}
    </section>
  );
}
