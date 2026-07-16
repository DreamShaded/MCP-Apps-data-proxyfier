import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { tokensToCssVars } from "../megamarket/design-tokens";
import { SearchView } from "../megamarket/search-view";
import { ProductDetailView } from "../megamarket/product-detail-view";
import { CartView } from "../megamarket/cart-view";
import { EMPTY_FILTERS, type FilterState } from "../megamarket/product-filters";
import type { Cart, ProductDetail, SearchResult } from "../megamarket/types";
import fixtures from "./fixtures.json";
import "../megamarket/styles.css";
import "./preview.css";

/**
 * Дев-превью виджета Megamarket в обычном браузере, без Claude Desktop и без моста.
 *
 * Рендерит те же самые компоненты вью, что и боевое приложение, на **настоящем** ответе
 * сервера (`fixtures.json` снят с живого сервера скриптом `pnpm update:fixtures`, а не
 * написан руками) — поэтому годится для проверки дизайна и интерактива: чипы фильтров,
 * заход в карточку, возврат в отфильтрованный список работают именно так, как в бою.
 *
 * Чего здесь НЕТ и быть не может: postMessage-моста и вызовов инструментов. «Подробнее»
 * берёт деталку из фикстуры, а не дёргает `get_product`; «В корзину» переключает на снимок
 * корзины, а не вызывает `add_to_cart`. Сам мост и рендер iframe проверяются только
 * вживую — в Claude Desktop (см. `DEMO.md`).
 *
 * В продакшен-сборку не попадает: `pnpm build:ui` собирает только `index` и `megamarket`.
 */

const GRID = fixtures.grid as unknown as SearchResult;
const BY_FRIDAY = fixtures.byFriday as unknown as SearchResult;
const DETAIL = fixtures.detail as unknown as ProductDetail;
const CART = fixtures.cart as unknown as Cart;

const CASES = [
  { id: "grid", label: "Кейс 2 — выдача виджетом", hint: `search_products_widget → ${GRID.products.length} товаров` },
  { id: "friday", label: "Кейс 3 — доставка до пятницы", hint: `deliveryBy=${fixtures.friday} → ${BY_FRIDAY.products.length} из ${GRID.products.length}` },
  { id: "detail", label: "Детальная карточка", hint: "get_product → галерея, «В корзину», таблица" },
  { id: "cart", label: "Корзина", hint: `view_cart → ${CART.totalCount} товаров` },
] as const;

type Case = (typeof CASES)[number]["id"];

/** `?case=cart` — чтобы кейс открывался ссылкой (и снимался скриншотом без клика). */
function caseFromUrl(): Case {
  const c = new URLSearchParams(window.location.search).get("case");
  return CASES.some((x) => x.id === c) ? (c as Case) : "grid";
}

function Preview() {
  const [active, setActive] = useState<Case>(caseFromUrl);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [detail, setDetail] = useState<ProductDetail | null>(null);

  const result = active === "friday" ? BY_FRIDAY : GRID;

  const open = (id: string) => {
    // В превью деталь есть только у товара из фикстуры — остальные показываем как есть.
    setDetail(DETAIL.id === id ? DETAIL : { ...DETAIL, ...result.products.find((p) => p.id === id) });
  };

  const backToGrid = () => {
    setDetail(null);
    setActive("grid");
  };

  // Корзина статична: без моста add_to_cart не вызвать, показываем снимок из фикстуры.
  const body =
    active === "cart" ? (
      <CartView cart={CART} onBack={backToGrid} onCheckout={backToGrid} />
    ) : active === "detail" || detail ? (
      <ProductDetailView
        detail={detail ?? DETAIL}
        onBack={backToGrid}
        onAddToCart={() => setActive("cart")}
        adding={false}
      />
    ) : (
      <SearchView
        result={result}
        filters={filters}
        onFiltersChange={setFilters}
        onOpenProduct={open}
        onAddToCart={() => setActive("cart")}
        loadingId={null}
        addingId={null}
      />
    );

  return (
    <>
      <style>{tokensToCssVars()}</style>
      <main className="p-root">
        <aside className="p-side">
          <h1 className="p-title">Megamarket widget</h1>
          <p className="p-sub">превью на настоящем ответе сервера</p>
          <nav className="p-nav">
            {CASES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`p-btn${c.id === active && !detail ? " p-btn--active" : ""}`}
                onClick={() => {
                  setActive(c.id);
                  setDetail(null);
                  setFilters(EMPTY_FILTERS);
                }}
              >
                <span className="p-btn__label">{c.label}</span>
                <span className="p-btn__hint">{c.hint}</span>
              </button>
            ))}
          </nav>
          <p className="p-note">
            Компоненты те же, что в бою. Моста нет: «Подробнее» берёт деталку из фикстуры,
            снятой с живого сервера {new Date(fixtures.generatedAt).toLocaleString("ru-RU")}.
          </p>
        </aside>
        <section className="p-stage">
          <div className="p-frame">{body}</div>
        </section>
      </main>
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");
createRoot(root).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
