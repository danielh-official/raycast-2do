import * as chrono from "chrono-node";
import { execFileSync } from "node:child_process";

export type Timestamp = { day: string; hasTime: boolean };
export type DayFormat = "MMM d, yyyy" | "d MMM yyyy" | "yyyy-MM-dd";

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Whether the Mac's region writes the day before the month, which decides how 05/11/2026 reads.
function regionIsDayFirst() {
  try {
    const locale = execFileSync("defaults", ["read", "-g", "AppleLocale"], { encoding: "utf8" })
      .trim()
      .replace(/@.*/, "")
      .replace("_", "-");
    const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(2000, 10, 22));
    return parts.findIndex((p) => p.type === "day") < parts.findIndex((p) => p.type === "month");
  } catch {
    return false;
  }
}

const parsers = new Map<boolean, chrono.Chrono>();
let regionDayFirst: boolean | undefined;

// All of `text` read as a date with an optional time, in most common formats ("2026-11-05",
// "Nov 6, 2026 11:00 am", "6 Nov 2026 2pm", "11/5/26"). Undefined unless the whole text is one.
// Strict parsing skips relative words like "today", whose meaning would drift.
export function parseTimestamp(text: string, dayFirst = (regionDayFirst ??= regionIsDayFirst())) {
  if (!parsers.has(dayFirst))
    parsers.set(dayFirst, new chrono.Chrono(chrono.en.configuration.createConfiguration(true, dayFirst)));
  const trimmed = text.trim();
  const [result] = parsers.get(dayFirst)!.parse(trimmed);
  if (!result || result.index !== 0 || result.text.length !== trimmed.length) return;
  const d = result.start.date();
  return {
    day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hasTime: result.start.isCertain("hour"),
  };
}

// `day` is "yyyy-MM-dd".
export function formatDay(day: string, format: DayFormat) {
  const [y, m, d] = day.split("-").map(Number);
  if (format === "yyyy-MM-dd") return day;
  if (format === "d MMM yyyy") return `${d} ${MONTHS[m - 1]} ${y}`;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
