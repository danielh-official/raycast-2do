import { describe, expect, it } from "vitest";
import { formatGoal, goalProgress, logProgress, parseGoal, writeGoal } from "../extension/src/goal";

const block = "@goal: 32 pages\n\n2026-11-06: 10\n2026-11-05: -1\n2026-11-04: 4\n\n@endgoal";
const goal = {
  total: 32,
  unit: "pages",
  entries: [
    { date: "2026-11-06", amount: 10 },
    { date: "2026-11-05", amount: -1 },
    { date: "2026-11-04", amount: 4 },
  ],
};

describe("parseGoal", () => {
  it("reads the total, unit, and entries", () => {
    expect(parseGoal(block)).toEqual(goal);
  });

  it("finds the block among other notes, ignoring non-entry lines inside it", () => {
    const notes = `Chapter list below.\n\n@GOAL: 2.5 km\nmorning runs\n2026-11-06: 0.5\n@endgoal\n\nhttps://example.com`;
    expect(parseGoal(notes)).toEqual({ total: 2.5, unit: "km", entries: [{ date: "2026-11-06", amount: 0.5 }] });
  });

  it("reads to the end when @endgoal is missing, and allows no unit", () => {
    expect(parseGoal("@goal: 3\n2026-11-06: 1")).toEqual({
      total: 3,
      unit: "",
      entries: [{ date: "2026-11-06", amount: 1 }],
    });
  });

  it("is undefined without a @goal line", () => {
    expect(parseGoal("Just notes\n2026-11-06: 1")).toBeUndefined();
  });
});

describe("formatGoal", () => {
  it("writes newest first, with blank lines around the entries", () => {
    expect(formatGoal({ ...goal, entries: [...goal.entries].reverse() })).toBe(block);
  });

  it("writes an empty goal without a unit", () => {
    expect(formatGoal({ total: 5, unit: "", entries: [] })).toBe("@goal: 5\n\n@endgoal");
  });
});

describe("writeGoal", () => {
  it("appends a block after the notes, or alone in empty notes", () => {
    expect(writeGoal("Read it.\n", goal)).toBe(`Read it.\n\n${block}`);
    expect(writeGoal("", goal)).toBe(block);
  });

  it("replaces the block in place, leaving the rest of the notes alone", () => {
    const notes = `Before\n\n@goal: 10\n2026-11-01: 1\n@endgoal\n\nAfter`;
    expect(writeGoal(notes, goal)).toBe(`Before\n\n${block}\n\nAfter`);
  });

  it("removes the block and the blank line before it", () => {
    expect(writeGoal(`Before\n\n${block}\n\nAfter`)).toBe("Before\n\nAfter");
    expect(writeGoal(`Before\n\n${block}`)).toBe("Before");
    expect(writeGoal("No goal")).toBe("No goal");
  });
});

describe("logProgress", () => {
  it("adds to the day's line, or adds a line for a new day", () => {
    expect(logProgress(goal, "2026-11-06", 2).entries).toContainEqual({ date: "2026-11-06", amount: 12 });
    expect(logProgress(goal, "2026-11-07", 3).entries).toContainEqual({ date: "2026-11-07", amount: 3 });
  });

  it("drops a day that nets to 0, and avoids float drift", () => {
    expect(logProgress(goal, "2026-11-04", -4).entries.map((e) => e.date)).not.toContain("2026-11-04");
    const tenths = logProgress(logProgress({ ...goal, entries: [] }, "2026-11-06", 0.1), "2026-11-06", 0.2);
    expect(tenths.entries).toEqual([{ date: "2026-11-06", amount: 0.3 }]);
  });
});

describe("goalProgress", () => {
  it("sums all entries and today's", () => {
    expect(goalProgress(goal, "2026-11-06")).toEqual({ done: 13, today: 10 });
    expect(goalProgress(goal, "2026-11-07")).toEqual({ done: 13, today: 0 });
  });
});
