import type { SearchResult } from "./types";
import { ProductCard } from "./product-card";

/** Выдача поиска: шапка с запросом + грид карточек. Без горизонтального скролла. */
export function SearchView({
  result,
  onOpenProduct,
  onAddToCart,
  loadingId,
  addingId,
}: {
  result: SearchResult;
  onOpenProduct: (id: string, url: string | null) => void;
  onAddToCart: (id: string, url: string | null) => void;
  /** Какая карточка грузит деталку (`get_product`). */
  loadingId: string | null;
  /** Какая карточка добавляется в корзину (`add_to_cart`). */
  addingId: string | null;
}) {
  const { query, products } = result;
  return (
    <section className="mm-search">
      <header className="mm-search__head">
        <span className="mm-search__logo">Megamarket</span>
        <div className="mm-search__meta">
          <span className="mm-search__query">{query}</span>
          <span className="mm-search__count">
            {products.length ? `${products.length} товаров` : "ничего не найдено"}
          </span>
        </div>
      </header>

      {products.length ? (
        <div className="mm-grid">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onOpen={() => onOpenProduct(p.id, p.url)}
              onAdd={() => onAddToCart(p.id, p.url)}
              loading={loadingId === p.id}
              adding={addingId === p.id}
              // Пока идёт любая операция (деталка/добавление) — гасим кнопки у всех
              // карточек, чтобы второй клик не запустил гонку параллельных вызовов.
              busy={loadingId !== null || addingId !== null}
            />
          ))}
        </div>
      ) : (
        <p className="mm-search__empty">
          По запросу «{query}» ничего не нашлось. Попробуйте уточнить формулировку.
        </p>
      )}
    </section>
  );
}
