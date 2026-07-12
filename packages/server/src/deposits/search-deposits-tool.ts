import { z } from "zod";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchDeposits } from "../data-source/static-deposits.js";
import { DEPOSITS_UI_RESOURCE_URI } from "./deposits-ui-resource.js";
import { searchDepositsResultSchema, type SearchDepositsResult } from "./deposit.js";

/**
 * Инструмент `search_deposits`: статическая линейка вкладов Сбера (собрана из снапшота
 * `pages/bank/vklad modal/` скриптом `pnpm update:data`) с полной сеткой ставок — пересчёт
 * доходности по слайдерам целиком на клиенте (`packages/ui/src/deposits/yield.ts`).
 */
export function registerSearchDepositsTool(server: McpServer): void {
  registerAppTool(
    server,
    "search_deposits",
    {
      title: "Подбор вкладов Сбера",
      description:
        "Подбирает вклады Сбера и рендерит карточки со слайдерами суммы/срока. Доходность пересчитывается мгновенно на клиенте из полной сетки ставок.",
      inputSchema: {
        amount: z.number().positive().describe("Сумма вклада в рублях, например 500000"),
        termMonths: z.number().int().positive().describe("Срок вклада в месяцах, например 12"),
      },
      // Единый источник схемы выдачи — `searchDepositsResultSchema` (без дубля формы здесь).
      outputSchema: searchDepositsResultSchema.shape,
      _meta: { ui: { resourceUri: DEPOSITS_UI_RESOURCE_URI } },
    },
    async ({ amount, termMonths }) => {
      const structuredContent: SearchDepositsResult = { amount, termMonths, deposits: searchDeposits() };
      return { content: [{ type: "text", text: summarize(structuredContent) }], structuredContent };
    },
  );
}

/** Человекочитаемая сводка для текстового канала чата (рядом с UI-карточками). */
function summarize(r: SearchDepositsResult): string {
  return `Вклады Сбера для ${r.amount.toLocaleString("ru-RU")} ₽ на ${r.termMonths} мес.: ${r.deposits.length} вариантов.`;
}
