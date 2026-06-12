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
import type { ReadSource } from "../source-badge";

/** Как и когда была получена показываемая деталка — для бейджа источника. */
type DetailMeta = { source: ReadSource; fetchedAt: string | null };

/** Какую вью мини-SPA показывает сейчас. Роутинг — чисто клиентский, в стейте app. */
type View = "search" | "detail" | "cart" | "checkout";

/**
 * Корневое приложение Megamarket (мини-SPA: выдача ⇄ деталка ⇄ корзина). Один iframe,
 * клиентский роутинг между вьюхами без новых пузырей в чате.
 *
 * Корзина = реальный сайт: «В корзину» (из грида и деталки) — app-initiated
 * `add_to_cart(id)`, живой клик под сессией; ответ несёт актуальную корзину, поэтому бейдж
 * обновляется без отдельного запроса, а вью остаётся на месте (грид/деталка). Клик по
 * бейджу — app-initiated `view_cart`, переключение на вью корзины. «Назад» из всех вьюх —
 * чисто клиентское. Деталки кэшируются в стейте app; корзина — нет (изменчива), читается живьём.
 *
 * Авто-ресайз iframe включён по умолчанию в `useApp` — отдельный хук не нужен.
 */
export function MegamarketApp() {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [view, setView] = useState<View>("search");
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailMeta, setDetailMeta] = useState<DetailMeta | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Хэндоф «открыть в браузере»: идёт ли вызов checkout, выводилось ли окно, и был ли сбой.
  const [checkoutOpening, setCheckoutOpening] = useState(false);
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [checkoutFailed, setCheckoutFailed] = useState(false);

  const appRef = useRef<App | null>(null);
  // Кэш деталок в стейте app: id → карточка + её источник. Переживает переходы
  // «назад→подробнее», не требует ре-рендера на запись, поэтому ref, а не state.
  // Источник храним вместе с карточкой, чтобы повторный показ из app-кэша честно
  // отражал, как и когда данные были получены (а не молча менял бейдж).
  const detailCache = useRef<Map<string, { product: ProductDetail; meta: DetailMeta }>>(new Map());
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
          setCart((sc.cart as Cart | null) ?? null);
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
  const busy = loadingId !== null || addingId !== null || cartLoading || checkoutOpening;

  const openProduct = useCallback(
    async (id: string, url: string | null) => {
      if (busy) return;
      setDetailError(null);

      // Повторный заход — берём из кэша app, без обращения к серверу.
      const cached = detailCache.current.get(id);
      if (cached) {
        setDetail(cached.product);
        setDetailMeta(cached.meta);
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
        const res = await app.callServerTool({ name: "get_product", arguments: { id, ...(url ? { url } : {}) } });
        const data = res.structuredContent as unknown as GetProductResult | undefined;
        if (data?.product) {
          const meta: DetailMeta = { source: data.source, fetchedAt: data.fetchedAt };
          // Кэшируем только успешно загруженную деталку. Фолбэк не пиним — повторное
          // «Подробнее» должно сходить заново и подхватить восстановившийся источник.
          if (data.source !== "fallback") detailCache.current.set(id, { product: data.product, meta });
          setDetail(data.product);
          setDetailMeta(meta);
          setView("detail");
        } else {
          setDetailError("Не удалось загрузить карточку товара.");
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
    async (id: string, url: string | null) => {
      if (busy) return;
      const app = appRef.current;
      if (!app) {
        setNotice("Нет связи с хостом — попробуйте ещё раз.");
        return;
      }

      setNotice(null);
      setAddingId(id);
      try {
        const res = await app.callServerTool({ name: "add_to_cart", arguments: { id, ...(url ? { url } : {}) } });
        const data = res.structuredContent as unknown as AddToCartResult | undefined;
        // Ответ несёт актуальную корзину — обновляем бейдж, оставаясь на текущей вью.
        if (data?.added && data.cart) setCart(data.cart);
        else setNotice("Не удалось добавить товар в корзину.");
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
      // Корзина изменчива — всегда читаем актуальное состояние живьём (без кэша).
      const res = await app.callServerTool({ name: "view_cart", arguments: {} });
      const data = res.structuredContent as unknown as ViewCartResult | undefined;
      if (data && !data.fallback && data.cart) setCart(data.cart);
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

  // «Перейти к оплате» из корзины — чисто клиентский переход на экран хэндофа (корзина
  // уже в стейте). Сам вывод окна вперёд делает кнопка «Открыть в браузере» (см. openBrowser).
  const goCheckout = useCallback(() => {
    setCheckoutOpened(false);
    setCheckoutFailed(false);
    setView("checkout");
  }, []);

  const openBrowser = useCallback(async () => {
    if (checkoutOpening) return;
    const app = appRef.current;
    if (!app) {
      setCheckoutFailed(true);
      return;
    }

    setCheckoutOpening(true);
    setCheckoutFailed(false);
    try {
      // Хэндоф: сервер переходит на реальную корзину, выводит живое окно вперёд и
      // возвращает её актуальный снимок — обновляем сводку и подтверждаем открытие.
      const res = await app.callServerTool({ name: "checkout", arguments: {} });
      const data = res.structuredContent as unknown as CheckoutResult | undefined;
      if (data && !data.fallback && data.cart) {
        setCart(data.cart);
        setCheckoutOpened(true);
      } else {
        // Окно могло не выйти вперёд (антибот/таймаут) — подсказываем открыть вручную.
        setCheckoutFailed(true);
      }
    } catch {
      setCheckoutFailed(true);
    } finally {
      setCheckoutOpening(false);
    }
  }, [checkoutOpening]);

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
        {renderBody({ result, view, detail, detailMeta, cart, loadingId, addingId, cartLoading, checkoutOpening, checkoutOpened, checkoutFailed, detailError, isConnected, error, openProduct, addToCart, openCart, goBack, backFromCart, goCheckout, openBrowser, backFromCheckout })}
      </main>
    </>
  );
}

interface BodyProps {
  result: SearchResult | null;
  view: View;
  detail: ProductDetail | null;
  detailMeta: DetailMeta | null;
  cart: Cart | null;
  loadingId: string | null;
  addingId: string | null;
  cartLoading: boolean;
  checkoutOpening: boolean;
  checkoutOpened: boolean;
  checkoutFailed: boolean;
  detailError: string | null;
  isConnected: boolean;
  error: Error | null;
  openProduct: (id: string, url: string | null) => void;
  addToCart: (id: string, url: string | null) => void;
  openCart: () => void;
  goBack: () => void;
  backFromCart: () => void;
  goCheckout: () => void;
  openBrowser: () => void;
  backFromCheckout: () => void;
}

function renderBody(p: BodyProps) {
  if (p.view === "checkout") {
    if (p.cart)
      return (
        <CheckoutView
          cart={p.cart}
          opening={p.checkoutOpening}
          opened={p.checkoutOpened}
          failed={p.checkoutFailed}
          onOpenBrowser={p.openBrowser}
          onBack={p.backFromCheckout}
        />
      );
    return <Placeholder text="Корзина пуста." onBack={p.backFromCheckout} />;
  }
  if (p.view === "cart") {
    if (p.cart) return <CartView cart={p.cart} onBack={p.backFromCart} onCheckout={p.goCheckout} />;
    if (p.cartLoading) return <Placeholder text="Загружаем корзину…" />;
    return <Placeholder text="Корзина пуста." onBack={p.backFromCart} />;
  }
  if (p.view === "detail" && p.detail)
    return <ProductDetailView detail={p.detail} onBack={p.goBack} onAddToCart={() => p.addToCart(p.detail!.id, p.detail!.url)} adding={p.addingId === p.detail.id} source={p.detailMeta?.source} fetchedAt={p.detailMeta?.fetchedAt} />;
  if (p.detailError) return <Placeholder text={p.detailError} tone="error" onBack={p.goBack} />;
  if (p.loadingId) return <Placeholder text="Загружаем карточку товара…" />;
  if (p.result?.fallback) return <FallbackView query={p.result.query} />;
  if (p.result)
    return <SearchView result={p.result} onOpenProduct={p.openProduct} onAddToCart={p.addToCart} loadingId={p.loadingId} addingId={p.addingId} />;
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
