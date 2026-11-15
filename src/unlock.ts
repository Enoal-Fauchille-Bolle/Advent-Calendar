import type { Settings } from "./settings.ts";

const pad = (n: number) => String(n).padStart(2, "0");

/** The wall-clock time in a time zone, as `YYYY-MM-DDTHH:MM`, which sorts as text. */
export function localDateTime(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/** The local time at which a door opens, in the format of `localDateTime`. */
export function unlockMoment(day: number, settings: Settings): string {
  return `${String(settings.year)}-${pad(settings.month)}-${pad(day)}T${settings.unlockTime}`;
}

export function isInRange(day: number, settings: Settings): boolean {
  return (
    Number.isInteger(day) && day >= settings.firstDay && day <= settings.lastDay
  );
}

/**
 * Whether a door is open. Both times are compared as local wall-clock text, so the
 * time zone's daylight saving changes need no special case.
 */
export function isUnlocked(
  day: number,
  settings: Settings,
  now: Date,
): boolean {
  return (
    isInRange(day, settings) &&
    localDateTime(now, settings.timezone) >= unlockMoment(day, settings)
  );
}

/** Every door number, in order. */
export function calendarDays(settings: Settings): number[] {
  const days: number[] = [];
  for (let day = settings.firstDay; day <= settings.lastDay; day += 1) {
    days.push(day);
  }
  return days;
}
