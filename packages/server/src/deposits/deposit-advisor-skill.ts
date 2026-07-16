import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Ресурс-скилл `deposit-advisor`: методичка для агента, которую он читает ДО вызова
 * `search_deposits`. В отличие от `ui://`-ресурсов это не MCP App (нечего рендерить в
 * iframe) — это обычный текстовый ресурс со схемой `skill://`, поэтому регистрируем его
 * напрямую через `server.registerResource`, а не через `registerAppResource`.
 */
export const DEPOSIT_ADVISOR_SKILL_URI = "skill://deposit-advisor/SKILL.md";

/** Индекс доступных скиллов — точка входа, по которой агент находит остальные `skill://`. */
export const SKILLS_INDEX_URI = "skill://index.json";

/** Одна запись индекса скиллов (`index.json`). */
interface SkillIndexEntry {
  name: string;
  description: string;
  url: string;
  type: "skill-md";
}

/**
 * Единственный источник правды для индекса: и `index.json`, и метаданные ресурса
 * собираются отсюда, чтобы имя/описание не разъезжались между двумя местами.
 */
const DEPOSIT_ADVISOR_ENTRY: SkillIndexEntry = {
  name: "deposit-advisor",
  description: "Подбор вклада под цель клиента",
  url: DEPOSIT_ADVISOR_SKILL_URI,
  type: "skill-md",
};

const SKILLS_INDEX = { skills: [DEPOSIT_ADVISOR_ENTRY] };

/**
 * Тело скилла. Адаптировано под реальный инструмент репозитория (`search_deposits`
 * с полями `amount`/`termMonths`, DTO `minAmount`/`capitalization`/`rates`): здесь нет
 * `list_deposits`/`open_deposit`, а оформление вклада идёт на стороне Сбербанка.
 */
const DEPOSIT_ADVISOR_SKILL_MD = `<!-- ${DEPOSIT_ADVISOR_SKILL_URI} -->
---
name: deposit-advisor
description: Подбор вклада под цель клиента. Читать до вызова search_deposits.
---

## Порядок
1. Спроси срок и допустимость досрочного снятия. Без срока не подбирай —
   \`search_deposits\` требует \`termMonths\`.
2. search_deposits(amount, termMonths) → сверь \`minAmount\` и диапазон срока каждого
   вклада с запросом, отсей не проходящие по сумме/сроку.
3. Сравнивай эффективную ставку (с капитализацией), а не номинальную: у вклада с
   \`capitalization\` доходность считается по сетке \`rates\` — виджет пересчитывает её на клиенте.
4. Если деньги могут понадобиться раньше — предупреди о потере процентов при досрочном
   снятии и покажи вариант с более гибкими условиями, даже если ставка ниже.
5. Не оформляй вклад за пользователя: открытие идёт на стороне Сбербанка после его
   подтверждения. Сначала покажи карточки виджетом и дождись явного согласия.

## Чего не делать
- Не рекомендовать по максимальной номинальной ставке.
- Не обещать доходность: это не оферта.
`;

/**
 * Зарегистрировать ресурсы-скиллы: индекс (`skill://index.json`) и сам методичку
 * `deposit-advisor`. Оба — статический текст, читаются по запросу клиента.
 */
export function registerDepositAdvisorSkillResources(server: McpServer): void {
  server.registerResource(
    "Skills index",
    SKILLS_INDEX_URI,
    {
      description: "Индекс доступных skill://-ресурсов сервера.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: SKILLS_INDEX_URI,
          mimeType: "application/json",
          text: JSON.stringify(SKILLS_INDEX, null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "Deposit advisor skill",
    DEPOSIT_ADVISOR_SKILL_URI,
    {
      description: DEPOSIT_ADVISOR_ENTRY.description + " — читать до вызова search_deposits.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: DEPOSIT_ADVISOR_SKILL_URI,
          mimeType: "text/markdown",
          text: DEPOSIT_ADVISOR_SKILL_MD,
        },
      ],
    }),
  );
}
