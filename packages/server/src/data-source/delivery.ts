import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDataDir } from "./paths.js";
import type { Delivery } from "../megamarket/product.js";

/**
 * Сроки доставки. Данные **синтетические**, и вот почему: настоящий срок
 * (`calculatedDeliveryDate` в SSR-стейте страниц) в снапшотах есть ровно у одного товара
 * каталога из 70 — на выдаче Мегамаркет его не отдаёт вовсе. Кейс «успеть к пятнице» на
 * одном товаре не показать.
 *
 * Формат подписей при этом взят у сайта, а не выдуман (см. `deliveryLabel`).
 *
 * Ключевое решение: в файле лежат **дни**, а не даты. Дата считается в рантайме от
 * сегодня, поэтому демо не протухает — «завтра» остаётся завтрашним и через месяц.
 */

/** Максимальный срок для товаров без явной записи в `delivery.json`. */
const FALLBACK_MAX_DAYS = 14;

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
] as const;

const WEEKDAYS = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
] as const;

interface DeliveryData {
  days: Record<string, number>;
}

function loadDeliveryData(): DeliveryData {
  const path = join(resolveDataDir(), "delivery.json");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Error(`${path} не найден — он нужен для сроков доставки`, { cause });
  }
  const parsed = JSON.parse(raw) as Partial<DeliveryData>;
  return { days: parsed.days ?? {} };
}

const data = loadDeliveryData();

/**
 * Полночь локальной даты в UTC-миллисекундах. Дальше вся арифметика идёт в UTC —
 * прибавление суток не спотыкается о переход на летнее время.
 */
function startOfLocalDay(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(ms: number, days: number): number {
  return ms + days * 86_400_000;
}

/** `YYYY-MM-DD` — формат, в котором даты сравнимы как строки. */
function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Человеческая подпись даты: «18 июля». */
function humanDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS_GENITIVE[d.getUTCMonth()]}`;
}

function weekdayName(ms: number): string {
  return WEEKDAYS[new Date(ms).getUTCDay()];
}

/**
 * Срок доставки товара в днях. Для товаров вне `delivery.json` — детерминированная
 * величина из хеша id: одинаковая между запусками (иначе выдача «дышала» бы на каждый
 * вызов), но не подобранная под демо.
 */
export function deliveryDaysFor(id: string): number {
  const explicit = data.days[id];
  if (explicit !== undefined) return explicit;

  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return (hash % FALLBACK_MAX_DAYS) + 1;
}

/**
 * Подпись срока ровно так, как её пишет сам Мегамаркет. В SSR-стейте снапшота
 * (`calculatedDeliveryDate`) встречаются только три формы: «Сегодня», «Завтра» и дата
 * вида «15 июля». «Послезавтра» сайт не использует — не используем и мы.
 */
function deliveryLabel(days: number, ms: number): string {
  if (days === 0) return "Сегодня";
  if (days === 1) return "Завтра";
  return humanDate(ms);
}

/** Доставка товара, посчитанная относительно `now`. */
export function buildDelivery(id: string, now: Date = new Date()): Delivery {
  const days = deliveryDaysFor(id);
  const ms = addDays(startOfLocalDay(now), days);
  return { days, date: isoDate(ms), label: deliveryLabel(days, ms) };
}

// Именно `type`, а не `interface`: у интерфейса нет неявной индекс-сигнатуры, и SDK
// откажется класть его в `structuredContent`.

/** Одна запись календаря — день, на который агент может опереться. */
export type CalendarDay = {
  date: string;
  weekday: string;
  /** Смещение от сегодня: 0 — сегодня, 1 — завтра. */
  inDays: number;
  /** Человеческая подпись: «Завтра», «пятница, 18 июля». */
  label: string;
};

export type DeliveryCalendar = {
  today: CalendarDay;
  tomorrow: CalendarDay;
  /** Ближайшие 7 дней после сегодня — по ним агент разрешает «до пятницы» в дату. */
  upcoming: CalendarDay[];
};

function calendarDay(todayMs: number, inDays: number): CalendarDay {
  const ms = addDays(todayMs, inDays);
  const weekday = weekdayName(ms);
  const label =
    inDays === 0 ? "Сегодня" : inDays === 1 ? "Завтра" : `${weekday}, ${humanDate(ms)}`;
  return { date: isoDate(ms), weekday, inDays, label };
}

/**
 * Календарь доставки. Нужен потому, что у модели нет часов: «до пятницы» она без этого
 * либо выдумает дату, либо посчитает от даты своего обучения. Скилл обязывает вызвать
 * этот инструмент до поиска — отсюда и «нужный порядок» вызовов в демо.
 */
export function buildCalendar(now: Date = new Date()): DeliveryCalendar {
  const todayMs = startOfLocalDay(now);
  return {
    today: calendarDay(todayMs, 0),
    tomorrow: calendarDay(todayMs, 1),
    upcoming: Array.from({ length: 7 }, (_, i) => calendarDay(todayMs, i + 1)),
  };
}
