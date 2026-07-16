import type { Product } from "./types";
import { brandsOf, hasAncData, isEmpty, type FilterState } from "./product-filters";

/**
 * Панель фильтров выдачи. Форма скопирована с живого Мегамаркета: чипы-переключатели
 * (`pui-checked-control-item`) над гридом. Фильтруют по характеристикам, не по доставке —
 * срок задаёт агент на сервере.
 *
 * Чипы строятся из самой выдачи, а не из захардкоженного списка: бренда, которого нет в
 * результатах, в фильтрах быть не должно.
 */
export function FilterBar({
  products,
  value,
  onChange,
  disabled,
}: {
  /** Полная выдача (до фильтрации) — из неё берутся доступные бренды. */
  products: readonly Product[];
  value: FilterState;
  onChange: (next: FilterState) => void;
  disabled?: boolean;
}) {
  const brands = brandsOf(products);
  const showAnc = hasAncData(products);
  if (brands.length < 2 && !showAnc) return null;

  return (
    <div className="mm-filters" role="group" aria-label="Фильтры выдачи">
      {brands.length > 1 ? (
        <div className="mm-filters__row">
          <Chip
            label="Все бренды"
            active={value.brand === null}
            disabled={disabled}
            onClick={() => onChange({ ...value, brand: null })}
          />
          {brands.map((brand) => (
            <Chip
              key={brand}
              label={brand}
              active={value.brand === brand}
              disabled={disabled}
              // Повторный клик по активному чипу снимает фильтр — как на сайте.
              onClick={() => onChange({ ...value, brand: value.brand === brand ? null : brand })}
            />
          ))}
        </div>
      ) : null}

      {showAnc ? (
        <div className="mm-filters__row">
          <Chip
            label="С шумоподавлением"
            active={value.ancOnly}
            disabled={disabled}
            onClick={() => onChange({ ...value, ancOnly: !value.ancOnly })}
          />
          {!isEmpty(value) ? (
            <button
              type="button"
              className="mm-filters__reset"
              onClick={() => onChange({ brand: null, ancOnly: false })}
              disabled={disabled}
            >
              Сбросить
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`mm-chip${active ? " mm-chip--active" : ""}`}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
