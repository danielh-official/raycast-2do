import { describe, expect, it } from "vitest";
import { formatDay, formatDisplay, formatTime, parseTimestamp, relativeTime } from "../extension/src/dates";

const now = new Date(2026, 10, 6, 17, 0);
const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

describe("relativeTime", () => {
  it("counts minutes and hours for timed entries", () => {
    expect(relativeTime(now.getTime(), true, now)).toBe("just now");
    expect(relativeTime(new Date(2026, 10, 6, 16, 45).getTime(), true, now)).toBe("15 minutes ago");
    expect(relativeTime(new Date(2026, 10, 6, 15, 0).getTime(), true, now)).toBe("2 hours ago");
    expect(relativeTime(new Date(2026, 10, 6, 19, 0).getTime(), true, now)).toBe("in 2 hours");
  });

  it("counts calendar days, weeks, months, and years", () => {
    expect(relativeTime(day(2026, 10, 6), false, now)).toBe("today");
    expect(relativeTime(day(2026, 10, 5), false, now)).toBe("yesterday");
    expect(relativeTime(new Date(2026, 10, 4, 9).getTime(), true, now)).toBe("2 days ago");
    expect(relativeTime(day(2026, 9, 23), false, now)).toBe("2 weeks ago");
    expect(relativeTime(day(2026, 7, 6), false, now)).toBe("3 months ago");
    expect(relativeTime(day(2024, 10, 6), false, now)).toBe("2 years ago");
  });
});

describe("formatTime", () => {
  it("drops :00 when short", () => {
    expect(formatTime(new Date(2026, 10, 6, 15, 0), true)).toBe("3 pm");
    expect(formatTime(new Date(2026, 10, 6, 15, 5), true)).toBe("3:05 pm");
    expect(formatTime(new Date(2026, 10, 6, 15, 0))).toBe("3:00 pm");
  });
});

describe("formatDisplay", () => {
  const timed = { ...parseTimestamp("Nov 6, 2026 3 pm", false)!, stamp: "Nov 6, 2026 3 pm" };
  const dateOnly = { ...parseTimestamp("2026-11-05", false)!, stamp: "2026-11-05" };

  it("defaults to the weekday, long date, short time, and relative time", () => {
    expect(formatDisplay(timed, "weekday", true, now)).toBe("Friday, November 6 3 pm (2 hours ago)");
    expect(formatDisplay(dateOnly, "weekday", true, now)).toBe("Thursday, November 5 (yesterday)");
  });

  it("shows the year only when it isn't the current one, except in ISO", () => {
    const lastYear = { ...parseTimestamp("Nov 6, 2025 3 pm", false)!, stamp: "Nov 6, 2025 3 pm" };
    expect(formatDisplay(lastYear, "weekday", false, now)).toBe("Thursday, November 6, 2025 3 pm");
    expect(formatDisplay(lastYear, "short", false, now)).toBe("Nov 6, 2025 3 pm");
    expect(formatDisplay(timed, "iso", false, now)).toBe("2026-11-06 3 pm");
  });

  it("offers other date styles, with or without relative time", () => {
    expect(formatDisplay(timed, "long", false, now)).toBe("November 6 3 pm");
    expect(formatDisplay(timed, "short", false, now)).toBe("Nov 6 3 pm");
    expect(formatDisplay(dateOnly, "iso", true, now)).toBe("2026-11-05 (yesterday)");
    expect(formatDisplay(timed, "written", true, now)).toBe("Nov 6, 2026 3 pm (2 hours ago)");
  });
});

describe("parseTimestamp", () => {
  it("reads common date formats, with or without a time", () => {
    expect(parseTimestamp("2026-11-05", false)).toMatchObject({ day: "2026-11-05", hasTime: false });
    expect(parseTimestamp("Nov 6, 2026", false)).toMatchObject({ day: "2026-11-06", hasTime: false });
    expect(parseTimestamp("6 Nov 2026", false)).toMatchObject({ day: "2026-11-06", hasTime: false });
    expect(parseTimestamp("November 6 2026", false)).toMatchObject({ day: "2026-11-06", hasTime: false });
    expect(parseTimestamp("November 6, 2026", false)).toMatchObject({ day: "2026-11-06", hasTime: false });
    expect(parseTimestamp("2026-11-05 2 pm", false)).toMatchObject({ day: "2026-11-05", hasTime: true });
    expect(parseTimestamp("2026-11-05 14:00", false)).toMatchObject({ day: "2026-11-05", hasTime: true });
    expect(parseTimestamp("Nov 6, 2026 11:00 am", false)).toMatchObject({ day: "2026-11-06", hasTime: true });
  });

  it("reads ambiguous slash dates month first or day first", () => {
    expect(parseTimestamp("05/11/2026", false)?.day).toBe("2026-05-11");
    expect(parseTimestamp("05/11/2026", true)?.day).toBe("2026-11-05");
  });

  it("rejects text that isn't wholly a timestamp, and relative words", () => {
    expect(parseTimestamp("Ran 5 km", false)).toBeUndefined();
    expect(parseTimestamp("Nov 6, 2026 and more", false)).toBeUndefined();
    expect(parseTimestamp("today", false)).toBeUndefined();
  });
});

describe("formatDay", () => {
  it("writes each format", () => {
    expect(formatDay("2026-11-06", "MMMM d, yyyy")).toBe("November 6, 2026");
    expect(formatDay("2026-09-06", "MMMM d, yyyy")).toBe("September 6, 2026");
    expect(formatDay("2026-11-06", "MMM d, yyyy")).toBe("Nov 6, 2026");
    expect(formatDay("2026-11-06", "d MMM yyyy")).toBe("6 Nov 2026");
    expect(formatDay("2026-11-06", "yyyy-MM-dd")).toBe("2026-11-06");
  });
});
