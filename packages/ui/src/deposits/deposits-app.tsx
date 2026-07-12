import { useMemo, useState } from "react";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { tokensToCssVars } from "./design-tokens";
import type { SearchDepositsResult } from "./types";
import { amountBounds, termBounds, clamp } from "./yield";
import { DepositControls } from "./deposit-controls";
import { DepositCard } from "./deposit-card";
import { FallbackView } from "./fallback-view";

/**
 * Корневое приложение «Вклады Сбера» — отдельный MCP App (свой iframe, без корзины/
 * оплаты). Один экран: панель слайдеров (сумма/срок/капитализация) + список карточек
 * вкладов. Сетка ставок приходит полной в `search_deposits`; пересчёт доходности по
 * слайдерам идёт целиком на клиенте (`computeYield`), к серверу при движении не ходим.
 *
 * Авто-ресайз iframe включён по умолчанию в `useApp` — отдельный хук не нужен.
 */
export function DepositsApp() {
  const [result, setResult] = useState<SearchDepositsResult | null>(null);
  // Позиции слайдеров. Инициализируются из эха запроса при приходе выдачи.
  const [amount, setAmount] = useState(0);
  const [termMonths, setTermMonths] = useState(0);
  const [capitalization, setCapitalization] = useState(false);

  const { isConnected, error } = useApp({
    appInfo: { name: "mcp-app-proxyfier-deposits", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (params) => {
        const data = params.structuredContent as unknown as SearchDepositsResult | undefined;
        if (!data) return;
        setResult(data);
        // Стартовые позиции слайдеров — эхо запроса, прижатое к границам линейки.
        const aB = amountBounds(data.deposits);
        const tB = termBounds(data.deposits);
        setAmount(clamp(data.amount, aB.min, aB.max));
        setTermMonths(clamp(data.termMonths, tB.min, tB.max));
        setCapitalization(false);
      };
    },
  });

  const deposits = result?.deposits ?? [];
  const aRange = useMemo(() => amountBounds(deposits), [deposits]);
  const tRange = useMemo(() => termBounds(deposits), [deposits]);
  const capAvailable = deposits.some((d) => d.capitalization);

  return (
    <>
      <style>{tokensToCssVars()}</style>
      <main className="sb-root">{renderBody()}</main>
    </>
  );

  function renderBody() {
    if (!result) {
      const text = error
        ? `Ошибка моста: ${error.message}`
        : isConnected
          ? "Подбираем вклады Сбера…"
          : "Подключаемся к хосту…";
      return <Placeholder text={text} tone={error ? "error" : undefined} />;
    }
    if (deposits.length === 0) return <FallbackView />;

    return (
      <>
        <header className="sb-head">
          <span className="sb-logo">СБЕР · Вклады</span>
        </header>
        <DepositControls
          amount={amount}
          termMonths={termMonths}
          capitalization={capitalization}
          amountRange={aRange}
          termRange={tRange}
          capitalizationAvailable={capAvailable}
          onAmount={setAmount}
          onTerm={setTermMonths}
          onCapitalization={setCapitalization}
        />
        <div className="sb-list">
          {deposits.map((d) => (
            <DepositCard
              key={d.id}
              deposit={d}
              amount={amount}
              termMonths={termMonths}
              capitalization={capitalization}
            />
          ))}
        </div>
      </>
    );
  }
}

function Placeholder({ text, tone }: { text: string; tone?: "error" }) {
  return (
    <section className={`sb-placeholder${tone === "error" ? " sb-placeholder--error" : ""}`}>
      <span className="sb-logo">СБЕР · Вклады</span>
      <p className="sb-placeholder__text">{text}</p>
    </section>
  );
}
