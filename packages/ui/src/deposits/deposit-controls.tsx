import { Slider } from "./slider";
import { formatRubles, formatTerm } from "./format";
import type { Bounds } from "./yield";

/**
 * Панель управления подбором: общие для всей линейки слайдеры суммы и срока + тумблер
 * капитализации. Любое движение мгновенно пересчитывает доходность всех карточек на
 * клиенте (стейт поднят в `DepositsApp`); к серверу здесь не ходим.
 */
export function DepositControls({
  amount,
  termMonths,
  capitalization,
  amountRange,
  termRange,
  capitalizationAvailable,
  onAmount,
  onTerm,
  onCapitalization,
}: {
  amount: number;
  termMonths: number;
  capitalization: boolean;
  amountRange: Bounds;
  termRange: Bounds;
  /** Есть ли в линейке вклады с капитализацией — иначе тумблер прячем. */
  capitalizationAvailable: boolean;
  onAmount: (value: number) => void;
  onTerm: (value: number) => void;
  onCapitalization: (value: boolean) => void;
}) {
  // Шаг суммы — 1% диапазона, округлённый до тысячи, чтобы слайдер шёл «по-банковски».
  const amountStep = Math.max(1_000, Math.round((amountRange.max - amountRange.min) / 100 / 1_000) * 1_000);
  return (
    <section className="sb-controls">
      <Slider
        label="Сумма"
        valueText={formatRubles(amount)}
        value={amount}
        min={amountRange.min}
        max={amountRange.max}
        step={amountStep}
        onChange={onAmount}
      />
      <Slider
        label="Срок"
        valueText={formatTerm(termMonths)}
        value={termMonths}
        min={termRange.min}
        max={termRange.max}
        step={1}
        onChange={onTerm}
      />
      {capitalizationAvailable ? (
        <label className="sb-toggle">
          <input
            type="checkbox"
            className="sb-toggle__input"
            checked={capitalization}
            onChange={(e) => onCapitalization(e.target.checked)}
          />
          <span className="sb-toggle__track" aria-hidden="true">
            <span className="sb-toggle__knob" />
          </span>
          <span className="sb-toggle__label">Капитализация процентов</span>
        </label>
      ) : null}
    </section>
  );
}
