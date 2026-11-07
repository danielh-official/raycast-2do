import { describe, expect, it } from "vitest";
import {
  appendGoal,
  deleteGoalEntry,
  editGoalEntry,
  formatGoal,
  goalProgress,
  logProgress,
  parseGoal,
  progressHistory,
  removeGoal,
  resetGoal,
  setGoalHeader,
} from "../extension/src/goal";

const block = "@goal: 32 pages\n\nNov 6, 2026: 10\n2026-11-05: -1\n2026-11-04: 4\n\n@endgoal";
const parse = (notes: string) => parseGoal(notes, false);
const log = (notes: string, day: string, amount: number) => logProgress(notes, day, amount, "MMM d, yyyy", false);

describe("parseGoal", () => {
  it("reads the total, unit, and entries in mixed date formats", () => {
    expect(parse(block)).toMatchObject({
      total: 32,
      unit: "pages",
      entries: [
        { day: "2026-11-06", amount: 10, hasTime: false, stamp: "Nov 6, 2026", line: 2 },
        { day: "2026-11-05", amount: -1, hasTime: false, stamp: "2026-11-05", line: 3 },
        { day: "2026-11-04", amount: 4, hasTime: false, stamp: "2026-11-04", line: 4 },
      ],
    });
  });

  it("orders entries by their moment, timed ones within their day", () => {
    const [timed, dateOnly] = parse("@goal: 5\nNov 6, 2026 2 pm: 1\nNov 6, 2026: 2\n@endgoal")!.entries;
    expect(timed.at).toBe(new Date(2026, 10, 6, 14).getTime());
    expect(dateOnly.at).toBe(new Date(2026, 10, 6).getTime());
  });

  it("reads timestamps with times, separated by a colon or a dash", () => {
    const notes = "@goal: 10\nNov 6, 2026 11:00 am: 3\n2026-11-06 2 pm - 2\n6 Nov 2026 14:00 - -1\n@endgoal";
    expect(parse(notes)?.entries.map((e) => [e.day, e.amount, e.hasTime])).toEqual([
      ["2026-11-06", 3, true],
      ["2026-11-06", 2, true],
      ["2026-11-06", -1, true],
    ]);
  });

  it("finds the block among other notes, ignoring lines that aren't entries", () => {
    const notes =
      "Chapter list below.\n\n@GOAL: 2.5 km\nmorning runs\n2026-11-06: 0.5\n2026-11-05 -1\n@endgoal\n\nhttps://a.test";
    expect(parse(notes)).toMatchObject({ total: 2.5, unit: "km", entries: [{ day: "2026-11-06", amount: 0.5 }] });
  });

  it("reads to the end when @endgoal is missing, and allows no unit", () => {
    expect(parse("@goal: 3\n2026-11-06: 1")).toMatchObject({ total: 3, unit: "", entries: [{ amount: 1 }] });
  });

  it("uses the topmost block and ignores later ones, for reading and writing", () => {
    const notes = `${block}\n\n@goal: 99 laps\n\nNov 6, 2026: 50\n\n@endgoal`;
    expect(parse(notes)).toMatchObject({ total: 32, unit: "pages" });
    expect(goalProgress(parse(notes)!, "2026-11-06")).toEqual({ done: 13, today: 10 });
    expect(log(notes, "2026-11-06", 1)).toBe(notes.replace("Nov 6, 2026: 10", "Nov 6, 2026: 11"));
    expect(setGoalHeader(notes, 40, "pages")).toBe(notes.replace("@goal: 32 pages", "@goal: 40 pages"));
    expect(removeGoal(notes)).toBe("@goal: 99 laps\n\nNov 6, 2026: 50\n\n@endgoal");
  });

  it("is undefined without a @goal line", () => {
    expect(parse("Just notes\n2026-11-06: 1")).toBeUndefined();
  });
});

describe("editGoalEntry and deleteGoalEntry", () => {
  const notes = "@goal: 10\n\nNov 6, 2026 8 am: 3\n2026-11-05: 4\n\n@endgoal";
  const [timed, dateOnly] = parse(notes)!.entries;

  it("changes the amount in place, keeping the timestamp as written", () => {
    expect(editGoalEntry(notes, timed, { day: "2026-11-06", amount: 5 }, "MMMM d, yyyy", false)).toBe(
      notes.replace("8 am: 3", "8 am: 5"),
    );
  });

  it("rewrites the line date-only in the chosen format when the day changes", () => {
    expect(editGoalEntry(notes, dateOnly, { day: "2026-11-04", amount: -1 }, "MMMM d, yyyy", false)).toBe(
      notes.replace("2026-11-05: 4", "November 4, 2026: -1"),
    );
  });

  it("deletes just that line", () => {
    expect(deleteGoalEntry(notes, timed, false)).toBe(notes.replace("Nov 6, 2026 8 am: 3\n", ""));
  });

  it("refuses when the entry changed since it was read", () => {
    const changed = notes.replace("2026-11-05: 4", "2026-11-05: 6");
    expect(editGoalEntry(changed, dateOnly, { day: "2026-11-05", amount: 1 }, "yyyy-MM-dd", false)).toBeUndefined();
    expect(deleteGoalEntry(changed, dateOnly, false)).toBeUndefined();
  });
});

describe("resetGoal", () => {
  it("empties the entries, keeping the total, unit, and the rest of the notes", () => {
    expect(resetGoal(`Before\n\n${block}\n\nAfter`, false)).toBe("Before\n\n@goal: 32 pages\n\n@endgoal\n\nAfter");
    expect(resetGoal("No goal", false)).toBe("No goal");
  });
});

describe("progressHistory", () => {
  it("lists entries newest first with a running total, whatever order the notes use", () => {
    const notes = "@goal: 10\n2026-11-04: 4\nNov 6, 2026: 2\nNov 6, 2026 8 am: 1\n2026-11-05: -1\n@endgoal";
    expect(progressHistory(parse(notes)!).map((e) => [e.stamp, e.amount, e.total])).toEqual([
      ["Nov 6, 2026 8 am", 1, 6],
      ["Nov 6, 2026", 2, 5],
      ["2026-11-05", -1, 3],
      ["2026-11-04", 4, 4],
    ]);
  });
});

describe("goalProgress", () => {
  it("sums every entry, and every entry for today, times included", () => {
    const notes = "@goal: 10\nNov 6, 2026 11:00 am: 3\nNov 6, 2026: 2\n2026-11-05: 4\n@endgoal";
    expect(goalProgress(parse(notes)!, "2026-11-06")).toEqual({ done: 9, today: 5 });
  });
});

describe("formatGoal", () => {
  it("writes a new block newest first in the chosen format", () => {
    const entries = [
      { day: "2026-11-04", amount: 4 },
      { day: "2026-11-06", amount: 10 },
    ];
    expect(formatGoal(32, "pages", entries, "MMM d, yyyy")).toBe(
      "@goal: 32 pages\n\nNov 6, 2026: 10\nNov 4, 2026: 4\n\n@endgoal",
    );
    expect(formatGoal(5, "", [], "yyyy-MM-dd")).toBe("@goal: 5\n\n@endgoal");
  });
});

describe("appendGoal, setGoalHeader, removeGoal", () => {
  it("appends after the notes, or alone in empty notes", () => {
    expect(appendGoal("Read it.\n", block)).toBe(`Read it.\n\n${block}`);
    expect(appendGoal("", block)).toBe(block);
  });

  it("changes only the header, leaving entries as typed", () => {
    const notes = `Before\n\n${block}\n\nAfter`;
    expect(setGoalHeader(notes, 40, "chapters")).toBe(notes.replace("@goal: 32 pages", "@goal: 40 chapters"));
  });

  it("removes the block and the blank line before it", () => {
    expect(removeGoal(`Before\n\n${block}\n\nAfter`)).toBe("Before\n\nAfter");
    expect(removeGoal(`Before\n\n${block}`)).toBe("Before");
    expect(removeGoal(`${block}\n\nAfter`)).toBe("After");
    expect(removeGoal("No goal")).toBe("No goal");
  });
});

describe("logProgress", () => {
  it("adds to the day's date-only line, keeping its format", () => {
    expect(log(block, "2026-11-05", 3)).toBe(block.replace("2026-11-05: -1", "2026-11-05: 2"));
  });

  it("adds a date-only line beside timed entries instead of rewriting them", () => {
    const notes = "@goal: 10\n\nNov 6, 2026 11:00 am: 3\n\n@endgoal";
    expect(log(notes, "2026-11-06", 2)).toBe("@goal: 10\n\nNov 6, 2026 11:00 am: 3\nNov 6, 2026: 2\n\n@endgoal");
  });

  it("puts a new day before the first older entry, in the chosen format", () => {
    expect(log(block, "2026-11-07", 1)).toBe(block.replace("Nov 6, 2026: 10", "Nov 7, 2026: 1\nNov 6, 2026: 10"));
    expect(logProgress(block, "2026-11-07", 1, "yyyy-MM-dd", false)).toContain("2026-11-07: 1\nNov 6, 2026: 10");
  });

  it("adds the first entry inside an empty block", () => {
    expect(log("@goal: 5\n\n@endgoal", "2026-11-06", 1)).toBe("@goal: 5\n\nNov 6, 2026: 1\n\n@endgoal");
  });

  it("drops a date-only line that nets to 0, and avoids float drift", () => {
    expect(log(block, "2026-11-04", -4)).toBe(block.replace("2026-11-04: 4\n", ""));
    const tenths = log(log("@goal: 1\n\n@endgoal", "2026-11-06", 0.1), "2026-11-06", 0.2);
    expect(tenths).toContain("Nov 6, 2026: 0.3");
  });
});
