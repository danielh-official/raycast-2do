import { describe, expect, it } from "vitest";
import {
  addJournalEntry,
  deleteJournalEntry,
  editJournalEntry,
  formatEntry,
  parseJournal,
} from "../extension/src/journal";

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

  it("uses the topmost block and ignores later ones, for reading and writing", () => {
    const notes = `${block}\n\n@journal\n\n2026-11-07 - Ignored\n\n@endjournal`;
    expect(parse(notes)?.map((e) => e.text)).not.toContain("Ignored");
    expect(parse(notes)).toHaveLength(3);
    const added = add(notes, new Date(2026, 10, 8), false, "Newest");
    expect(added.indexOf("November 8, 2026 - Newest")).toBeLessThan(added.indexOf("Nov 6, 2026 11:00 am"));
    expect(added).toContain("@journal\n\n2026-11-07 - Ignored\n\n@endjournal");
  });

  it("is undefined without a block, and empty for an empty one", () => {
    expect(parse("Just notes")).toBeUndefined();
    expect(parse("@journal\n\n@endjournal")).toEqual([]);
  });
});

describe("editJournalEntry and deleteJournalEntry", () => {
  const [oneLine, multi, older] = parse(block)!;
  const edit = (entry: typeof oneLine, change: { text: string; when: Date; hasTime: boolean }, notes = block) =>
    editJournalEntry(notes, entry, change, "MMMM d, yyyy", false);

  it("replaces the text in place when the moment is unchanged, keeping the timestamp as written", () => {
    expect(edit(oneLine, { text: "Left a voicemail", when: new Date(oneLine.at), hasTime: true })).toBe(
      block.replace("Called the president, went to voicemail", "Left a voicemail"),
    );
  });

  it("turns a one-line entry into a multi-line one with blank lines around it", () => {
    expect(
      edit(older, { text: "Emailed the office\nNo reply yet", when: new Date(older.at), hasTime: false }),
    ).toContain("November 4, 2026\n\nEmailed the office\nNo reply yet\n\n@endjournal");
  });

  it("moves an entry into time order when its moment changes", () => {
    const moved = edit(oneLine, { text: "Called the president", when: new Date(2026, 10, 3, 9, 0), hasTime: true })!;
    expect(parse(moved)?.map((e) => e.text.split("\n")[0])).toEqual([
      "Called again, discussed policy.",
      "Emailed the office",
      "Called the president",
    ]);
  });

  it("deletes an entry without leaving doubled blank lines", () => {
    const deleted = deleteJournalEntry(block, multi, false)!;
    expect(parse(deleted)?.map((e) => e.text)).toEqual([
      "Called the president, went to voicemail",
      "Emailed the office",
    ]);
    expect(deleted).not.toContain("\n\n\n");
  });

  it("refuses when the entry changed since it was read", () => {
    const changed = block.replace("Nov 6, 2026 11:00 am", "Nov 6, 2026 11:30 am");
    expect(edit(oneLine, { text: "x", when: new Date(oneLine.at), hasTime: true }, changed)).toBeUndefined();
    expect(deleteJournalEntry(changed, oneLine, false)).toBeUndefined();
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
