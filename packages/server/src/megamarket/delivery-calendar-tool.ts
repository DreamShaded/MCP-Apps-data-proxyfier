import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildCalendar } from "../data-source/delivery.js";

export const GET_DELIVERY_CALENDAR_TOOL = "get_delivery_calendar";

const calendarDaySchema = z.object({
  date: z.string(),
  weekday: z.string(),
  inDays: z.number().int().nonnegative(),
  label: z.string(),
});

export const deliveryCalendarResultSchema = z.object({
  today: calendarDaySchema,
  tomorrow: calendarDaySchema,
  upcoming: z.array(calendarDaySchema),
});

/**
 * Инструмент `get_delivery_calendar`: сегодняшняя дата, завтрашняя и ближайшие 7 дней с
 * названиями дней недели. UI не объявляет — рендерить нечего, это справка для агента.
 *
 * Зачем инструмент, а не поле в товаре: у модели нет часов. Без этого вызова «доставка до
 * пятницы» превращается либо в выдуманную дату, либо в отсчёт от даты обучения. Скилл
 * обязывает дёрнуть календарь до поиска — отсюда «нужный порядок» вызовов.
 */
export function registerDeliveryCalendarTool(server: McpServer): void {
  server.registerTool(
    GET_DELIVERY_CALENDAR_TOOL,
    {
      title: "Календарь доставки",
      description:
        "Возвращает сегодняшнюю и завтрашнюю дату плюс ближайшие 7 дней с днями недели. " +
        "Вызывай ПЕРЕД поиском всегда, когда пользователь говорит о сроке словами — «завтра», " +
        "«до пятницы», «к выходным», «на этой неделе». Своих часов у тебя нет: без этого вызова " +
        "дату подставлять нельзя. Полученную дату передавай в search_products* как filters.deliveryBy.",
      inputSchema: {},
      outputSchema: deliveryCalendarResultSchema.shape,
    },
    async () => {
      const calendar = buildCalendar();
      return { content: [{ type: "text", text: summarize(calendar) }], structuredContent: calendar };
    },
  );
}

function summarize(c: ReturnType<typeof buildCalendar>): string {
  const upcoming = c.upcoming.map((d) => `${d.weekday} — ${d.date}`).join("; ");
  return `Сегодня ${c.today.weekday}, ${c.today.date}. Завтра ${c.tomorrow.date}. Ближайшие дни: ${upcoming}.`;
}
