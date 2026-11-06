import * as chrono from "chrono-node";

// `at` orders timestamps: milliseconds, at the start of the day for a date without a time.
export type Timestamp = { day: string; hasTime: boolean; at: number };
export type DayFormat = "MMMM d, yyyy" | "MMM d, yyyy" | "d MMM yyyy" | "yyyy-MM-dd";

const pad = (n: number) => String(n).padStart(2, "0");

// Local "yyyy-MM-dd".
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const parsers = new Map<boolean, chrono.Chrono>();

// All of `text` read as a date with an optional time, in most common formats ("2026-11-05",
// "Nov 6, 2026 11:00 am", "6 Nov 2026 2pm", "11/5/26"). Undefined unless the whole text is one.
// Strict parsing skips relative words like "today", whose meaning would drift. `dayFirst` reads
// an ambiguous date like 05/11/2026 as 5 November instead of May 11.
export function parseTimestamp(text: string, dayFirst = false) {
  const trimmed = text.trim();
  // Dotted dates (6.11.2026) are a day-first convention everywhere they're used.
  const order = dayFirst || /^\d{1,2}\.\d{1,2}\.\d{2,4}\b/.test(trimmed);
  if (!parsers.has(order))
    parsers.set(order, new chrono.Chrono(chrono.en.configuration.createConfiguration(true, order)));
  const [result] = parsers.get(order)!.parse(trimmed);
  if (!result || result.index !== 0 || result.text.length !== trimmed.length) return;
  const d = result.start.date();
  const hasTime = result.start.isCertain("hour");
  return {
    day: ymd(d),
    hasTime,
    at: hasTime ? d.getTime() : new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
  };
}

// "2:05 pm", or "3 pm" on the hour when `short`.
export function formatTime(d: Date, short = false) {
  const h = d.getHours() % 12 || 12;
  const minutes = short && d.getMinutes() === 0 ? "" : `:${pad(d.getMinutes())}`;
  return `${h}${minutes} ${d.getHours() < 12 ? "am" : "pm"}`;
}

export type DisplayFormat = "weekday" | "long" | "short" | "iso" | "written";

// "2 hours ago", "yesterday", "in 3 days". Date-only timestamps count whole days ("today").
export function relativeTime(at: number, hasTime: boolean, now = new Date()) {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const startOfDay = (t: number) => new Date(new Date(t).setHours(0, 0, 0, 0)).getTime();
  const days = Math.round((startOfDay(at) - startOfDay(now.getTime())) / 86_400_000);
  if (hasTime) {
    const minutes = Math.round((at - now.getTime()) / 60_000);
    if (Math.abs(minutes) < 1) return "just now";
    if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
    if (Math.abs(minutes) < 24 * 60) return rtf.format(Math.round(minutes / 60), "hour");
  }
  if (Math.abs(days) < 7) return rtf.format(days, "day");
  if (Math.abs(days) < 30) return rtf.format(Math.round(days / 7), "week");
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month");
  return rtf.format(Math.round(days / 365), "year");
}

// How Show Journal displays a timestamp: "Friday, November 6 3 pm (2 hours ago)" by default, with
// the year left out when it's the current one (except in ISO). "written" keeps the timestamp as typed.
export function formatDisplay(
  t: Timestamp & { stamp: string },
  format: DisplayFormat,
  relative: boolean,
  now = new Date(),
) {
  const d = new Date(t.at);
  const year = (s: string) => (d.getFullYear() === now.getFullYear() ? s.replace(/, \d{4}$/, "") : s);
  const dates: Record<Exclude<DisplayFormat, "written">, string> = {
    weekday: `${d.toLocaleDateString("en-US", { weekday: "long" })}, ${year(formatDay(t.day, "MMMM d, yyyy"))}`,
    long: year(formatDay(t.day, "MMMM d, yyyy")),
    short: year(formatDay(t.day, "MMM d, yyyy")),
    iso: t.day,
  };
  const shown = format === "written" ? t.stamp : `${dates[format]}${t.hasTime ? ` ${formatTime(d, true)}` : ""}`;
  return relative ? `${shown} (${relativeTime(t.at, t.hasTime, now)})` : shown;
}

// `day` is "yyyy-MM-dd".
export function formatDay(day: string, format: DayFormat) {
  const [y, m, d] = day.split("-").map(Number);
  const month = MONTHS[m - 1];
  if (format === "yyyy-MM-dd") return day;
  if (format === "d MMM yyyy") return `${d} ${month.slice(0, 3)} ${y}`;
  if (format === "MMM d, yyyy") return `${month.slice(0, 3)} ${d}, ${y}`;
  return `${month} ${d}, ${y}`;
}
