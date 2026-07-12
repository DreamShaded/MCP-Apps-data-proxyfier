import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDataDir } from "./paths.js";
import type { Deposit } from "../deposits/deposit.js";

function loadDepositsData(): Deposit[] {
  const path = join(resolveDataDir(), "deposits.json");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Error(`${path} не найден — запусти "pnpm update:data" перед стартом сервера`, { cause });
  }
  return (JSON.parse(raw) as { deposits: Deposit[] }).deposits;
}

const deposits = loadDepositsData();

/**
 * Линейка вкладов Сбера. `amount`/`termMonths` тут ничего не фильтруют — как и раньше,
 * отдаётся вся линейка с полной сеткой ставок, клиент сам выбирает ячейку под слайдеры.
 */
export function searchDeposits(): Deposit[] {
  return deposits;
}
