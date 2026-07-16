import type { SearchResult } from "./types";
import { ProductCard } from "./product-card";
import { FilterBar } from "./filter-bar";
import { applyFilters, isEmpty, type FilterState } from "./product-filters";

/** Выдача поиска: шапка с запросом, фильтры, грид карточек. Без горизонтального скролла. */
export function SearchView({
  result,
  filters,
  onFiltersChange,
  onOpenProduct,
  onAddToCart,
  loadingId,
  addingId,
}: {
  result: SearchResult;
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  onOpenProduct: (id: string, url: string | null) => void;
  onAddToCart: (id: string, url: string | null) => void;
  /** Какая карточка грузит деталку (`get_product`). */
  loadingId: string | null;
  /** Какая карточка добавляется в корзину (`add_to_cart`). */
  addingId: string | null;
}) {
  const { query, products } = result;
  const visible = applyFilters(products, filters);
  const busy = loadingId !== null || addingId !== null;

  return (
    <section className="mm-search">
      <header className="mm-search__head">
        <span className="mm-search__logo">Megamarket</span>
        <div className="mm-search__meta">
          <span className="mm-search__query">{query}</span>
          <span className="mm-search__count">
            {/* Под фильтром показываем «сколько из скольких» — иначе непонятно, что часть скрыта. */}
            {isEmpty(filters)
              ? `${products.length} товаров`
              : `${visible.length} из ${products.length}`}
          </span>
        </div>
      </header>

      <FilterBar products={products} value={filters} onChange={onFiltersChange} disabled={busy} />

      {visible.length ? (
        <div className="mm-grid">
          {visible.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onOpen={() => onOpenProduct(p.id, p.url)}
              onAdd={() => onAddToCart(p.id, p.url)}
              loading={loadingId === p.id}
              adding={addingId === p.id}
              // Пока идёт любая операция (деталка/добавление) — гасим кнопки у всех
              // карточек, чтобы второй клик не запустил гонку параллельных вызовов.
              busy={busy}
            />
          ))}
        </div>
      ) : (
        <p className="mm-search__empty">
          {products.length
            ? "Под выбранные фильтры ничего не подошло — снимите часть условий."
            : `По запросу «${query}» ничего не нашлось. Попробуйте уточнить формулировку.`}
        </p>
      )}
    </section>
  );
}
