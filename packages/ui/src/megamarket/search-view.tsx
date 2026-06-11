import type { SearchResult } from "./types";
import { ProductCard } from "./product-card";

/** Выдача поиска: шапка с запросом + грид карточек. Без горизонтального скролла. */
export function SearchView({
  result,
  onOpenProduct,
  loadingId,
}: {
  result: SearchResult;
  onOpenProduct: (id: string, url: string | null) => void;
  loadingId: string | null;
}) {
  const { query, products, stale } = result;
  return (
    <section className="mm-search">
      <header className="mm-search__head">
        <span className="mm-search__logo">Megamarket</span>
        <div className="mm-search__meta">
          <span className="mm-search__query">{query}</span>
          <span className="mm-search__count">
            {products.length ? `${products.length} товаров` : "ничего не найдено"}
            {stale ? " · из кэша" : ""}
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
              loading={loadingId === p.id}
              // Пока грузится любая деталка — гасим «Подробнее» у всех карточек,
              // чтобы второй клик не запустил гонку параллельных get_product.
              busy={loadingId !== null}
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
