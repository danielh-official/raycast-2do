import { describe, expect, it } from "vitest";
import { formatDay, parseTimestamp } from "../extension/src/dates";

describe("parseTimestamp", () => {
  it("reads common date formats, with or without a time", () => {
    expect(parseTimestamp("2026-11-05", false)).toEqual({ day: "2026-11-05", hasTime: false });
    expect(parseTimestamp("Nov 6, 2026", false)).toEqual({ day: "2026-11-06", hasTime: false });
    expect(parseTimestamp("6 Nov 2026", false)).toEqual({ day: "2026-11-06", hasTime: false });
    expect(parseTimestamp("November 6 2026", false)).toEqual({ day: "2026-11-06", hasTime: false });
    expect(parseTimestamp("November 6, 2026", false)).toEqual({ day: "2026-11-06", hasTime: false });
    expect(parseTimestamp("2026-11-05 2 pm", false)).toEqual({ day: "2026-11-05", hasTime: true });
    expect(parseTimestamp("2026-11-05 14:00", false)).toEqual({ day: "2026-11-05", hasTime: true });
    expect(parseTimestamp("Nov 6, 2026 11:00 am", false)).toEqual({ day: "2026-11-06", hasTime: true });
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
