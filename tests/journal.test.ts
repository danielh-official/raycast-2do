import { describe, expect, it } from "vitest";
import { addJournalEntry, formatEntry, parseJournal } from "../extension/src/journal";

const block = [
  "@journal",
  "",
  "Nov 6, 2026 11:00 am - Called the president, went to voicemail",
  "2026-11-05 2 pm",
  "",
  "Called again, discussed policy.",
  "They'll send the paperwork.",
  "",
  "November 4, 2026: Emailed the office",
  "",
  "@endjournal",
].join("\n");
const parse = (notes: string) => parseJournal(notes, false);
const add = (notes: string, when: Date, hasTime: boolean, text: string) =>
  addJournalEntry(notes, when, hasTime, text, "MMMM d, yyyy", false);

describe("parseJournal", () => {
  it("reads one-line and multi-line entries in mixed formats", () => {
    expect(parse(block)?.map((e) => [e.day, e.hasTime, e.stamp, e.text, e.start, e.end])).toEqual([
      ["2026-11-06", true, "Nov 6, 2026 11:00 am", "Called the president, went to voicemail", 2, 2],
      ["2026-11-05", true, "2026-11-05 2 pm", "Called again, discussed policy.\nThey'll send the paperwork.", 3, 6],
      ["2026-11-04", false, "November 4, 2026", "Emailed the office", 8, 8],
    ]);
  });

  it("orders entries by their timestamp, date-only ones at the start of the day", () => {
    const [a, b, c] = parse(block)!;
    expect(a.at).toBeGreaterThan(b.at);
    expect(b.at).toBeGreaterThan(c.at);
    expect(new Date(c.at).getHours()).toBe(0);
  });

  it("ignores lines before the first entry, and text outside the block", () => {
    const notes = "Intro\n@journal\nstray line\n2026-11-05 - First\n@endjournal\nOutro";
    expect(parse(notes)?.map((e) => e.text)).toEqual(["First"]);
  });

  it("is undefined without a block, and empty for an empty one", () => {
    expect(parse("Just notes")).toBeUndefined();
    expect(parse("@journal\n\n@endjournal")).toEqual([]);
  });
});

describe("formatEntry", () => {
  const when = new Date(2026, 10, 6, 14, 5);
  it("writes one line, or the timestamp then the text two lines down", () => {
    expect(formatEntry(when, true, "Called", "MMMM d, yyyy")).toEqual(["November 6, 2026 2:05 pm - Called"]);
    expect(formatEntry(when, true, "Line one\nLine two", "MMMM d, yyyy")).toEqual([
      "November 6, 2026 2:05 pm",
      "",
      "Line one",
      "Line two",
    ]);
    expect(formatEntry(when, false, "Called", "yyyy-MM-dd")).toEqual(["2026-11-06 - Called"]);
    expect(formatEntry(new Date(2026, 10, 6, 0, 30), true, "x", "MMM d, yyyy")).toEqual(["Nov 6, 2026 12:30 am - x"]);
  });
});

describe("addJournalEntry", () => {
  it("starts a block at the end of the notes", () => {
    expect(add("Notes", new Date(2026, 10, 6, 14, 5), true, "Called")).toBe(
      "Notes\n\n@journal\n\nNovember 6, 2026 2:05 pm - Called\n\n@endjournal",
    );
    expect(add("", new Date(2026, 10, 6), false, "Called")).toBe(
      "@journal\n\nNovember 6, 2026 - Called\n\n@endjournal",
    );
  });

  it("puts the newest entry first, without rewriting existing lines", () => {
    const notes = add(block, new Date(2026, 10, 6, 14, 5), true, "Got a callback");
    expect(notes).toBe(
      block.replace("Nov 6, 2026 11:00 am", "November 6, 2026 2:05 pm - Got a callback\nNov 6, 2026 11:00 am"),
    );
  });

  it("slots an older entry in time order, with blank lines around multi-line entries", () => {
    const notes = add(block, new Date(2026, 10, 5, 9, 0), true, "Left a message");
    expect(notes).toContain(
      "They'll send the paperwork.\n\nNovember 5, 2026 9:00 am - Left a message\nNovember 4, 2026",
    );
    const multi = add(block, new Date(2026, 10, 6, 12, 0), true, "Line one\nLine two");
    expect(multi).toContain("@journal\n\nNovember 6, 2026 12:00 pm\n\nLine one\nLine two\n\nNov 6, 2026 11:00 am");
  });

  it("adds after the last entry when older than all, and into an empty block", () => {
    expect(add(block, new Date(2026, 10, 1), false, "Kickoff")).toContain(
      "November 4, 2026: Emailed the office\nNovember 1, 2026 - Kickoff\n\n@endjournal",
    );
    expect(add("@journal\n\n@endjournal", new Date(2026, 10, 6), false, "First")).toBe(
      "@journal\n\nNovember 6, 2026 - First\n\n@endjournal",
    );
  });
});
