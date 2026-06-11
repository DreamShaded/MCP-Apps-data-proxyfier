/**
 * Бейдж корзины — плавающая кнопка в правом верхнем углу App, видна во всех вьюхах
 * (выдача/деталка/корзина). Клик инициирует app-side `view_cart` через родителя и
 * переключает на вью корзины. Счётчик позиций обновляется после каждого `add_to_cart`.
 */
export function CartBadge({
  count,
  onOpen,
  loading,
  active,
}: {
  count: number;
  onOpen: () => void;
  /** Идёт чтение корзины (`view_cart`) — показываем спиннер вместо счётчика. */
  loading: boolean;
  /** Сейчас открыта вью корзины — подсвечиваем кнопку. */
  active: boolean;
}) {
  return (
    <button
      type="button"
      className={`mm-badge${active ? " mm-badge--active" : ""}`}
      onClick={onOpen}
      disabled={loading}
      aria-label={`Корзина${count ? `, ${count} товаров` : ""}`}
    >
      <span className="mm-badge__icon" aria-hidden="true">
        🛒
      </span>
      {loading ? (
        <span className="mm-spinner mm-badge__spinner" aria-hidden="true" />
      ) : count > 0 ? (
        <span className="mm-badge__count">{count > 99 ? "99+" : count}</span>
      ) : null}
    </button>
  );
}
