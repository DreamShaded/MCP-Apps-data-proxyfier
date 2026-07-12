import { useCallback, useRef, useState } from "react";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { App } from "@modelcontextprotocol/ext-apps/react";
import { tokensToCssVars } from "./design-tokens";
import type {
  AddToCartResult,
  Cart,
  CheckoutResult,
  GetProductResult,
  ProductDetail,
  SearchResult,
  ViewCartResult,
} from "./types";
import { SearchView } from "./search-view";
import { ProductDetailView } from "./product-detail-view";
import { CartView } from "./cart-view";
import { CheckoutView } from "./checkout-view";
import { CartBadge } from "./cart-badge";
import { FallbackView } from "./fallback-view";

/** Какую вью мини-SPA показывает сейчас. Роутинг — чисто клиентский, в стейте app. */
type View = "search" | "detail" | "cart" | "checkout";

/**
 * Корневое приложение Megamarket (мини-SPA: выдача ⇄ деталка ⇄ корзина ⇄ подтверждение
 * заказа). Один iframe, клиентский роутинг между вьюхами без новых пузырей в чате.
 *
 * Данные статические (каталог из `pages/`, см. план миграции) — нет кэш-слоя/браузера,
 * поэтому у ответов инструментов нет `source`/`stale`/`fallback`. Корзина — in-memory на
 * сервере (см. `data-source/cart-store.ts`): «В корзину» — app-initiated `add_to_cart(id)`,
 * ответ несёт актуальную корзину, поэтому бейдж обновляется без отдельного запроса.
 * «Оформить» показывает статический экран подтверждения (дизайн-референс —
 * `pages/market/checkout/`), без хэндофа в реальный браузер.
 *
 * Авто-ресайз iframe включён по умолчанию в `useApp` — отдельный хук не нужен.
 */
export function MegamarketApp() {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [view, setView] = useState<View>("search");
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<CheckoutResult | null>(null);

  const appRef = useRef<App | null>(null);
  // Кэш деталок в стейте app: id → карточка. Переживает переходы «назад→подробнее»,
  // не требует ре-рендера на запись, поэтому ref, а не state.
  const detailCache = useRef<Map<string, ProductDetail>>(new Map());
  // Куда вернуться из корзины (на вью, с которой её открыли).
  const cartReturnView = useRef<View>("search");

  const { isConnected, error } = useApp({
    appInfo: { name: "mcp-app-proxyfier-megamarket", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      appRef.current = app;
      app.ontoolresult = (params) => {
        const sc = params.structuredContent as Record<string, unknown> | undefined;
        // Host-инициированные view_cart/add_to_cart несут `cart` — показываем корзину.
        if (sc && "cart" in sc) {
          setCart((sc.cart as Cart) ?? null);
          setView("cart");
          setNotice(null);
          return;
        }
        // По умолчанию — выдача поиска (host-инициированный search_products).
        setResult((sc as unknown as SearchResult) ?? null);
        setView("search");
        setDetail(null);
        setDetailError(null);
      };
    },
  });

  // Любая операция уже в полёте — блокируем новые, чтобы не плодить параллельные вызовы.
  const busy = loadingId !== null || addingId !== null || cartLoading || confirming;

  const openProduct = useCallback(
    async (id: string) => {
      if (busy) return;
      setDetailError(null);

      // Повторный заход — берём из кэша app, без обращения к серверу.
      const cached = detailCache.current.get(id);
      if (cached) {
        setDetail(cached);
        setView("detail");
        return;
      }

      const app = appRef.current;
      if (!app) {
        setDetailError("Нет связи с хостом — попробуйте ещё раз.");
        return;
      }

      setLoadingId(id);
      try {
        const res = await app.callServerTool({ name: "get_product", arguments: { id } });
        const data = res.structuredContent as unknown as GetProductResult | undefined;
        if (data?.product) {
          detailCache.current.set(id, data.product);
          setDetail(data.product);
          setView("detail");
        } else {
          setDetailError("Товар не найден в каталоге.");
        }
      } catch {
        setDetailError("Не удалось загрузить карточку товара.");
      } finally {
        setLoadingId(null);
      }
    },
    [busy],
  );

  const addToCart = useCallback(
    async (id: string) => {
      if (busy) return;
      const app = appRef.current;
      if (!app) {
        setNotice("Нет связи с хостом — попробуйте ещё раз.");
        return;
      }

      setNotice(null);
      setAddingId(id);
      try {
        const res = await app.callServerTool({ name: "add_to_cart", arguments: { id } });
        const data = res.structuredContent as unknown as AddToCartResult | undefined;
        // Ответ несёт актуальную корзину — обновляем бейдж, оставаясь на текущей вью.
        if (data) setCart(data.cart);
        if (!data?.added) setNotice("Товар не найден в каталоге — не добавлен в корзину.");
      } catch {
        setNotice("Не удалось добавить товар в корзину.");
      } finally {
        setAddingId(null);
      }
    },
    [busy],
  );

  const openCart = useCallback(async () => {
    if (cartLoading) return;
    const app = appRef.current;
    if (!app) {
      setNotice("Нет связи с хостом — попробуйте ещё раз.");
      return;
    }

    setNotice(null);
    cartReturnView.current = view === "cart" ? cartReturnView.current : view;
    setCartLoading(true);
    setView("cart");
    try {
      const res = await app.callServerTool({ name: "view_cart", arguments: {} });
      const data = res.structuredContent as unknown as ViewCartResult | undefined;
      if (data) setCart(data.cart);
      else setNotice("Не удалось загрузить корзину.");
    } catch {
      setNotice("Не удалось загрузить корзину.");
    } finally {
      setCartLoading(false);
    }
  }, [cartLoading, view]);

  const goBack = useCallback(() => {
    // Чисто клиентский возврат к выдаче: грид уже в стейте, сервер не дёргаем.
    setView("search");
    setDetailError(null);
  }, []);

  const backFromCart = useCallback(() => {
    setView(cartReturnView.current);
    setNotice(null);
  }, []);

  // «Оформить» из корзины — чисто клиентский переход на экран подтверждения (корзина
  // уже в стейте). Само подтверждение (и очистка корзины) — на кнопке в CheckoutView.
  const goCheckout = useCallback(() => {
    setConfirmed(null);
    setView("checkout");
  }, []);

  const confirmOrder = useCallback(async () => {
    if (confirming) return;
    const app = appRef.current;
    if (!app) {
      setNotice("Нет связи с хостом — попробуйте ещё раз.");
      return;
    }

    setConfirming(true);
    try {
      const res = await app.callServerTool({ name: "checkout", arguments: {} });
      const data = res.structuredContent as unknown as CheckoutResult | undefined;
      if (data) {
        setConfirmed(data);
        setCart({ items: [], totalCount: 0, totalPrice: 0 }); // сервер уже очистил корзину
      } else {
        setNotice("Не удалось оформить заказ.");
      }
    } catch {
      setNotice("Не удалось оформить заказ.");
    } finally {
      setConfirming(false);
    }
  }, [confirming]);

  const backFromCheckout = useCallback(() => {
    setView("cart");
  }, []);

  const showBadge = isConnected && !error;

  return (
    <>
      <style>{tokensToCssVars()}</style>
      <main className="mm-root">
        {showBadge ? (
          <CartBadge count={cart?.totalCount ?? 0} onOpen={openCart} loading={cartLoading} active={view === "cart"} />
        ) : null}
        {notice ? (
          <div className="mm-notice" role="alert">
            {notice}
          </div>
        ) : null}
        {renderBody({
          result,
          view,
          detail,
          cart,
          loadingId,
          addingId,
          cartLoading,
          confirming,
          confirmed,
          detailError,
          isConnected,
          error,
          openProduct,
          addToCart,
          openCart,
          goBack,
          backFromCart,
          goCheckout,
          confirmOrder,
          backFromCheckout,
        })}
      </main>
    </>
  );
}

interface BodyProps {
  result: SearchResult | null;
  view: View;
  detail: ProductDetail | null;
  cart: Cart | null;
  loadingId: string | null;
  addingId: string | null;
  cartLoading: boolean;
  confirming: boolean;
  confirmed: CheckoutResult | null;
  detailError: string | null;
  isConnected: boolean;
  error: Error | null;
  openProduct: (id: string) => void;
  addToCart: (id: string) => void;
  openCart: () => void;
  goBack: () => void;
  backFromCart: () => void;
  goCheckout: () => void;
  confirmOrder: () => void;
  backFromCheckout: () => void;
}

function renderBody(p: BodyProps) {
  if (p.view === "checkout") {
    if (p.confirmed) return <CheckoutView result={p.confirmed} confirmed onBack={p.backFromCheckout} onConfirm={p.confirmOrder} />;
    if (p.cart) return <CheckoutView cart={p.cart} confirming={p.confirming} onBack={p.backFromCheckout} onConfirm={p.confirmOrder} />;
    return <Placeholder text="Корзина пуста." onBack={p.backFromCheckout} />;
  }
  if (p.view === "cart") {
    if (p.cart) return <CartView cart={p.cart} onBack={p.backFromCart} onCheckout={p.goCheckout} />;
    if (p.cartLoading) return <Placeholder text="Загружаем корзину…" />;
    return <Placeholder text="Корзина пуста." onBack={p.backFromCart} />;
  }
  if (p.view === "detail" && p.detail)
    return (
      <ProductDetailView
        detail={p.detail}
        onBack={p.goBack}
        onAddToCart={() => p.addToCart(p.detail!.id)}
        adding={p.addingId === p.detail.id}
      />
    );
  if (p.detailError) return <Placeholder text={p.detailError} tone="error" onBack={p.goBack} />;
  if (p.loadingId) return <Placeholder text="Загружаем карточку товара…" />;
  if (p.result)
    return p.result.products.length ? (
      <SearchView result={p.result} onOpenProduct={p.openProduct} onAddToCart={p.addToCart} loadingId={p.loadingId} addingId={p.addingId} />
    ) : (
      <FallbackView query={p.result.query} />
    );
  if (p.error) return <Placeholder text={`Ошибка моста: ${p.error.message}`} tone="error" />;
  return <Placeholder text={p.isConnected ? "Загружаем выдачу Megamarket…" : "Подключаемся к хосту…"} />;
}

function Placeholder({ text, tone, onBack }: { text: string; tone?: "error"; onBack?: () => void }) {
  return (
    <section className={`mm-placeholder${tone === "error" ? " mm-placeholder--error" : ""}`}>
      <span className="mm-search__logo">Megamarket</span>
      <p className="mm-placeholder__text">{text}</p>
      {onBack ? (
        <button type="button" className="mm-back" onClick={onBack}>
          <span className="mm-back__chevron" aria-hidden="true">
            ‹
          </span>
          Назад
        </button>
      ) : null}
    </section>
  );
}
