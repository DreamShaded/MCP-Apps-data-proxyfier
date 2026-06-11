import { useState } from "react";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { tokensToCssVars } from "./design-tokens";
import type { SearchResult } from "./types";
import { SearchView } from "./search-view";
import { FallbackView } from "./fallback-view";

/**
 * Корневое приложение Megamarket (мини-SPA: выдача → деталка → корзина). Пока рисует
 * только выдачу поиска. Отрисовывается сразу — iframe виден ещё до прихода результата
 * инструмента (это и снимает риск бага рендера iframe у хоста), затем показывает грид,
 * который `search_products` присылает в `structuredContent` через мост.
 *
 * Авто-ресайз iframe включён по умолчанию в `useApp` — отдельный хук не нужен.
 */
export function MegamarketApp() {
  const [result, setResult] = useState<SearchResult | null>(null);

  const { isConnected, error } = useApp({
    appInfo: { name: "mcp-app-proxyfier-megamarket", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (params) => {
        setResult((params.structuredContent as unknown as SearchResult) ?? null);
      };
    },
  });

  return (
    <>
      <style>{tokensToCssVars()}</style>
      <main className="mm-root">
        {renderBody(result, isConnected, error)}
      </main>
    </>
  );
}

function renderBody(result: SearchResult | null, isConnected: boolean, error: Error | null) {
  if (result?.fallback) return <FallbackView query={result.query} />;
  if (result) return <SearchView result={result} />;
  if (error) return <Placeholder text={`Ошибка моста: ${error.message}`} tone="error" />;
  return <Placeholder text={isConnected ? "Загружаем выдачу Megamarket…" : "Подключаемся к хосту…"} />;
}

function Placeholder({ text, tone }: { text: string; tone?: "error" }) {
  return (
    <section className={`mm-placeholder${tone === "error" ? " mm-placeholder--error" : ""}`}>
      <span className="mm-search__logo">Megamarket</span>
      <p className="mm-placeholder__text">{text}</p>
    </section>
  );
}
