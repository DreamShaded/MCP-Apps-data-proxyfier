import type { Deposit } from "./types";
import { computeYield } from "./yield";
import { formatRubles, formatRate } from "./format";

/**
 * Карточка вклада: название/описание, применённая ставка из сетки и пересчитанная
 * доходность для текущих суммы/срока/капитализации. Пересчёт — чистый `computeYield`
 * на клиенте; при движении слайдеров карточка перерисовывается без вызова сервера.
 * Если выбранные сумма/срок вне условий вклада — показываем аккуратную пометку.
 */
export function DepositCard({
  deposit,
  amount,
  termMonths,
  capitalization,
}: {
  deposit: Deposit;
  amount: number;
  termMonths: number;
  capitalization: boolean;
}) {
  const result = computeYield(amount, termMonths, capitalization, deposit.rates);
  const applicable = result.rate !== null;

  return (
    <article className={`sb-card${applicable ? "" : " sb-card--inactive"}`}>
      <div className="sb-card__head">
        <h3 className="sb-card__name">{deposit.name}</h3>
        {applicable ? (
          <span className="sb-card__rate">
            <span className="sb-card__rate-value">{formatRate(result.rate as number)}</span>
            <span className="sb-card__rate-cap">{result.capitalized ? "с кап." : "годовых"}</span>
          </span>
        ) : null}
      </div>

      {deposit.description ? <p className="sb-card__desc">{deposit.description}</p> : null}

      {applicable ? (
        <dl className="sb-card__yield">
          <div className="sb-card__yield-row">
            <dt>Доход за срок</dt>
            <dd className="sb-card__income">+{formatRubles(result.interest)}</dd>
          </div>
          <div className="sb-card__yield-row">
            <dt>Сумма в конце</dt>
            <dd className="sb-card__total">{formatRubles(result.total)}</dd>
          </div>
        </dl>
      ) : (
        <p className="sb-card__note">
          Для выбранной суммы или срока этот вклад недоступен — измените параметры выше.
        </p>
      )}
    </article>
  );
}
