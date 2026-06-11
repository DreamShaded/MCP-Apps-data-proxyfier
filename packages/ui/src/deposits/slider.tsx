/**
 * Брендовый слайдер на нативном `<input type=range>`: трек и ползунок крашены в
 * токены Сбера через CSS (см. styles.css), заливка до ползунка — линейным градиентом
 * по проценту. Без внешних UI-CDN (требование песочницы-iframe).
 */
export function Slider({
  label,
  valueText,
  value,
  min,
  max,
  step,
  onChange,
}: {
  /** Подпись слева (например «Сумма»). */
  label: string;
  /** Готовое к показу значение справа (например «500 000 ₽»). */
  valueText: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  // Процент заполнения трека — для зелёной заливки слева от ползунка.
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <label className="sb-slider">
      <div className="sb-slider__row">
        <span className="sb-slider__label">{label}</span>
        <span className="sb-slider__value">{valueText}</span>
      </div>
      <input
        className="sb-slider__input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--sb-track-fill) ${pct}%, var(--sb-track-bg) ${pct}%)`,
        }}
      />
    </label>
  );
}
