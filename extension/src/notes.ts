import * as goal from "./goal";
import * as journal from "./journal";

const BLOCKS = [goal, journal];

// Splits notes into the text the Notes field shows and the goal and journal blocks it hides.
// Only the topmost block of each kind counts, as when it's parsed; later ones stay in the text.
// A block without its end line runs to the end of the notes.
export function splitNotes(notes: string) {
  const lines = notes.split("\n");
  const text: string[] = [];
  const blocks: string[] = [];
  const found = new Set<(typeof BLOCKS)[number]>();
  for (let i = 0; i < lines.length; i++) {
    const kind = BLOCKS.find((b) => !found.has(b) && b.HEADER.test(lines[i].trim()));
    if (!kind) {
      text.push(lines[i]);
      continue;
    }
    const end = lines.findIndex((l, j) => j > i && kind.END.test(l.trim()));
    const last = end < 0 ? lines.length - 1 : end;
    found.add(kind);
    blocks.push(lines.slice(i, last + 1).join("\n"));
    if (text.length && !text[text.length - 1].trim()) text.pop();
    i = last;
  }
  return { text: text.join("\n").trim(), blocks };
}

// The notes to save: the Notes field's text, then the hidden blocks.
export function joinNotes(text: string, blocks: string[]) {
  return [text.trim(), ...blocks].filter(Boolean).join("\n\n");
}
