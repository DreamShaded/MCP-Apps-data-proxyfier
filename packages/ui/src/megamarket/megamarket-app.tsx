import { useCallback, useRef, useState } from "react";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { App } from "@modelcontextprotocol/ext-apps/react";
import { tokensToCssVars } from "./design-tokens";
import type { GetProductResult, ProductDetail, SearchResult } from "./types";
import { SearchView } from "./search-view";
import { ProductDetailView } from "./product-detail-view";
import { FallbackView } from "./fallback-view";

/** Какую вью мини-SPA показывает сейчас. Роутинг — чисто клиентский, в стейте app. */
type View = "search" | "detail";

/**
 * Корневое приложение Megamarket (мини-SPA: выдача ⇄ деталка). Один iframe, клиентский
 * роутинг между вьюхами без новых пузырей в чате.
 *
 * «Подробнее» — app-initiated `tools/call get_product(id)` через мост: сервер лениво
 * тянет деталку (через кэш-слой) и отдаёт прямо в ответ вызова, тот же App переключается
 * на вью карточки. «Назад» — чисто клиентское переключение на выдачу (она уже в стейте).
 * Деталки кэшируются в стейте app по id: повторный заход в ту же карточку мгновенный, без
 * второго `tools/call`.
 *
 * Авто-ресайз iframe включён по умолчанию в `useApp` — отдельный хук не нужен.
 */
export function MegamarketApp() {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [view, setView] = useState<View>("search");
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const appRef = useRef<App | null>(null);
  // Кэш деталок в стейте app: id → карточка. Переживает переходы «назад→подробнее»,
  // не требует ре-рендера на запись, поэтому ref, а не state.
  const detailCache = useRef<Map<string, ProductDetail>>(new Map());

  const { isConnected, error } = useApp({
    appInfo: { name: "mcp-app-proxyfier-megamarket", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      appRef.current = app;
      app.ontoolresult = (params) => {
        // Пришла новая выдача поиска — показываем грид (сбрасываем возможную деталку).
        setResult((params.structuredContent as unknown as SearchResult) ?? null);
        setView("search");
        setDetail(null);
        setDetailError(null);
      };
    },
  });

  const openProduct = useCallback(async (id: string, url: string | null) => {
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
      const res = await app.callServerTool({
        name: "get_product",
        arguments: { id, ...(url ? { url } : {}) },
      });
      const data = res.structuredContent as unknown as GetProductResult | undefined;
      if (data?.product) {
        // Кэшируем в стейте app только успешно загруженную деталку. Фолбэк (живой
        // источник упал, отдан протухший пример) не пиним — повторное «Подробнее»
        // должно сходить заново и подхватить восстановившийся источник.
        if (data.source !== "fallback") detailCache.current.set(id, data.product);
        setDetail(data.product);
        setView("detail");
      } else {
        setDetailError("Не удалось загрузить карточку товара.");
      }
    } catch {
      setDetailError("Не удалось загрузить карточку товара.");
    } finally {
      setLoadingId(null);
    }
  }, []);

  const goBack = useCallback(() => {
    // Чисто клиентский возврат к выдаче: грид уже в стейте, сервер не дёргаем.
    setView("search");
    setDetailError(null);
  }, []);

  return (
    <>
      <style>{tokensToCssVars()}</style>
      <main className="mm-root">
        {renderBody({ result, view, detail, loadingId, detailError, isConnected, error, openProduct, goBack })}
      </main>
    </>
  );
}

interface BodyProps {
  result: SearchResult | null;
  view: View;
  detail: ProductDetail | null;
  loadingId: string | null;
  detailError: string | null;
  isConnected: boolean;
  error: Error | null;
  openProduct: (id: string, url: string | null) => void;
  goBack: () => void;
}

function renderBody(p: BodyProps) {
  if (p.view === "detail" && p.detail) return <ProductDetailView detail={p.detail} onBack={p.goBack} />;
  if (p.detailError) return <Placeholder text={p.detailError} tone="error" onBack={p.goBack} />;
  if (p.loadingId) return <Placeholder text="Загружаем карточку товара…" />;
  if (p.result?.fallback) return <FallbackView query={p.result.query} />;
  if (p.result) return <SearchView result={p.result} onOpenProduct={p.openProduct} loadingId={p.loadingId} />;
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
