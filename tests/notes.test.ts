import { describe, expect, it } from "vitest";
import { joinNotes, splitNotes } from "../extension/src/notes";

const goal = "@goal: 32 pages\n\nNovember 6, 2026: 10\n\n@endgoal";
const journal = "@journal\n\nNovember 6, 2026 11:00 am - Called\n\n@endjournal";

describe("splitNotes", () => {
  it("separates the text from the goal and journal blocks", () => {
    expect(splitNotes(`Read it.\n\n${goal}\n\n${journal}`)).toEqual({ text: "Read it.", blocks: [goal, journal] });
  });

  it("keeps text around and between blocks", () => {
    expect(splitNotes(`${journal}\n\nMiddle\n\n${goal}\n\nAfter`)).toEqual({
      text: "Middle\n\nAfter",
      blocks: [journal, goal],
    });
  });

  it("takes a block without its end line to the end of the notes", () => {
    expect(splitNotes("Read it.\n\n@goal: 5\nNovember 6, 2026: 1")).toEqual({
      text: "Read it.",
      blocks: ["@goal: 5\nNovember 6, 2026: 1"],
    });
  });

  it("hides only the topmost block of each kind, leaving later ones in the text", () => {
    const second = "@goal: 99\n\n@endgoal";
    expect(splitNotes(`${goal}\n\n${journal}\n\nNotes\n\n${second}`)).toEqual({
      text: `Notes\n\n${second}`,
      blocks: [goal, journal],
    });
  });

  it("leaves notes without blocks alone, and ignores a malformed goal header", () => {
    expect(splitNotes("Just notes\n@goal: lots")).toEqual({ text: "Just notes\n@goal: lots", blocks: [] });
  });
});

describe("joinNotes", () => {
  it("puts the blocks back after the text, round-tripping notes that end with blocks", () => {
    const notes = `Read it.\n\n${goal}\n\n${journal}`;
    const { text, blocks } = splitNotes(notes);
    expect(joinNotes(text, blocks)).toBe(notes);
    expect(joinNotes("Edited.", blocks)).toBe(`Edited.\n\n${goal}\n\n${journal}`);
    expect(joinNotes("", blocks)).toBe(`${goal}\n\n${journal}`);
    expect(joinNotes("Only text", [])).toBe("Only text");
  });
});
