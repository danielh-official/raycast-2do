import { describe, expect, it } from "vitest";
import { checkGoal, closeGoal } from "../extension/src/goal";
import { checkJournal, closeJournal } from "../extension/src/journal";
import { checkNotes, fixNotes, splitNotes } from "../extension/src/notes";

describe("checkGoal and closeGoal", () => {
  it("finds nothing wrong with a well-formed goal, or without one", () => {
    expect(checkGoal("Notes\n\n@goal: 5 pages\n\nNovember 6, 2026: 2\n\n@endgoal", false)).toEqual([]);
    expect(checkGoal("Just notes", false)).toEqual([]);
  });

  it("flags a missing @endgoal as fixable, and closes it after the last entry", () => {
    const notes = "@goal: 5 pages\n\nNovember 6, 2026: 2\nNovember 5, 2026: 1\n\nCall the library about the next book.";
    expect(checkGoal(notes, false)).toEqual([expect.objectContaining({ fixable: true })]);
    const fixed = closeGoal(notes, false);
    expect(fixed).toBe(
      "@goal: 5 pages\n\nNovember 6, 2026: 2\nNovember 5, 2026: 1\n\n@endgoal\n\nCall the library about the next book.",
    );
    expect(checkGoal(fixed, false)).toEqual([]);
    expect(splitNotes(fixed).text).toBe("Call the library about the next book.");
  });

  it("closes right after the header when there are no entries", () => {
    expect(closeGoal("@goal: 5\nMore notes", false)).toBe("@goal: 5\n\n@endgoal\n\nMore notes");
  });

  it("flags lines it can't read, and a header without a total, as not fixable", () => {
    const unreadable = checkGoal("@goal: 5\n2026-11-05 -1\nNovember 6, 2026: 2\n@endgoal", false);
    expect(unreadable).toEqual([{ message: expect.stringContaining('"2026-11-05 -1"'), fixable: false }]);
    expect(checkGoal("@goal: lots\n@endgoal", false)).toEqual([
      { message: expect.stringContaining("needs a total"), fixable: false },
    ]);
  });
});

describe("checkJournal and closeJournal", () => {
  it("finds nothing wrong with a well-formed journal", () => {
    expect(checkJournal("@journal\n\nNovember 6, 2026 - Called\n\n@endjournal", false)).toEqual([]);
  });

  it("closes a one-line last entry at its paragraph's end", () => {
    const notes = "@journal\n\nNovember 6, 2026 - Called\nNovember 5, 2026 - Emailed\n\nAddress: 1 Main St";
    expect(checkJournal(notes, false)).toEqual([expect.objectContaining({ fixable: true })]);
    expect(closeJournal(notes, false)).toBe(
      "@journal\n\nNovember 6, 2026 - Called\nNovember 5, 2026 - Emailed\n\n@endjournal\n\nAddress: 1 Main St",
    );
  });

  it("closes a multi-line last entry after the paragraph below its timestamp", () => {
    const notes = "@journal\n\nNovember 6, 2026 2 pm\n\nCalled again.\nThey'll write.\n\nAddress: 1 Main St";
    expect(closeJournal(notes, false)).toBe(
      "@journal\n\nNovember 6, 2026 2 pm\n\nCalled again.\nThey'll write.\n\n@endjournal\n\nAddress: 1 Main St",
    );
  });

  it("flags text before the first entry and a malformed header, as not fixable", () => {
    expect(checkJournal("@journal\nstray\nNovember 6, 2026 - Called\n@endjournal", false)).toEqual([
      { message: expect.stringContaining('"stray"'), fixable: false },
    ]);
    expect(checkJournal("@journal: calls\n@endjournal", false)).toEqual([
      { message: expect.stringContaining("alone on its line"), fixable: false },
    ]);
  });
});

describe("checkNotes and fixNotes", () => {
  it("checks and fixes both blocks, including an unclosed goal followed by a journal", () => {
    const notes = "@goal: 5\nNovember 6, 2026: 2\n\n@journal\n\nNovember 6, 2026 - Called\n\nAfter";
    expect(checkNotes(notes, false).filter((i) => i.fixable)).toHaveLength(2);
    const fixed = fixNotes(notes, false);
    expect(checkNotes(fixed, false)).toEqual([]);
    expect(splitNotes(fixed)).toEqual({
      text: "After",
      blocks: ["@goal: 5\nNovember 6, 2026: 2\n\n@endgoal", "@journal\n\nNovember 6, 2026 - Called\n\n@endjournal"],
    });
  });

  it("leaves well-formed notes unchanged", () => {
    const notes = "Notes\n\n@goal: 5\n\n@endgoal\n\n@journal\n\n@endjournal";
    expect(fixNotes(notes, false)).toBe(notes);
  });
});
