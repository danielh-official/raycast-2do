import { DayFormat, formatDay, formatTime, parseTimestamp, Timestamp, ymd } from "./dates";

// A journal lives in a task's notes as a block of timestamped entries, newest first:
//
//   @journal
//
//   November 6, 2026 11:00 am - Called the president, went to voicemail
//   2026-11-05 2 pm
//
//   Called again, discussed policy.
//   They'll send the paperwork.
//
//   @endjournal
//
// An entry starts with a timestamp in any common format, then " - " (or "–", "—", ":") and its
// text, or alone on its line with the text below. Lines without a timestamp continue the entry
// above. The extension never rewrites lines: a new entry is inserted in time order. Text outside
// the block is left alone.
export type JournalEntry = Timestamp & { stamp: string; text: string; start: number; end: number };

export const HEADER = /^@journal$/i;
export const END = /^@endjournal$/i;

function findBlock(lines: string[]) {
  const start = lines.findIndex((l) => HEADER.test(l.trim()));
  if (start < 0) return;
  const end = lines.findIndex((l, i) => i > start && END.test(l.trim()));
  return { start, end: end < 0 ? lines.length : end, closed: end >= 0 };
}

// A line that begins an entry: its timestamp text, timestamp, and any text after the separator.
function readEntryStart(line: string, dayFirst?: boolean) {
  for (const sep of line.matchAll(/\s[-–—]\s+|:\s+/g)) {
    const stamp = line.slice(0, sep.index);
    const timestamp = parseTimestamp(stamp, dayFirst);
    if (timestamp) return { ...timestamp, stamp, text: line.slice(sep.index + sep[0].length) };
  }
  const timestamp = parseTimestamp(line, dayFirst);
  if (timestamp) return { ...timestamp, stamp: line, text: "" };
}

// Entries in the order they appear, or undefined without a @journal block.
export function parseJournal(notes: string, dayFirst?: boolean): JournalEntry[] | undefined {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  if (!block) return;
  const entries: (Omit<JournalEntry, "text"> & { body: string[] })[] = [];
  for (let i = block.start + 1; i < block.end; i++) {
    const start = readEntryStart(lines[i].trim(), dayFirst);
    if (start) {
      const { text, ...rest } = start;
      entries.push({ ...rest, body: [text], start: i, end: i });
    } else if (entries.length) {
      const entry = entries[entries.length - 1];
      entry.body.push(lines[i]);
      if (lines[i].trim()) entry.end = i;
    }
  }
  return entries.map(({ body, ...entry }) => ({ ...entry, text: body.join("\n").trim() }));
}

// The entry's lines: one line, or the timestamp, a blank line, and the text when it has several lines.
export function formatEntry(when: Date, hasTime: boolean, text: string, format: DayFormat) {
  const day = formatDay(ymd(when), format);
  const timestamp = hasTime ? `${day} ${formatTime(when)}` : day;
  const body = text.trim();
  return body.includes("\n") ? [timestamp, "", ...body.split("\n")] : [`${timestamp} - ${body}`];
}

// Adds an entry before the first entry that isn't newer, keeping newest first. Multi-line entries
// get a blank line between them and their neighbors. Starts a block at the end of the notes if needed.
export function addJournalEntry(
  notes: string,
  when: Date,
  hasTime: boolean,
  text: string,
  format: DayFormat,
  dayFirst?: boolean,
) {
  const entry = formatEntry(when, hasTime, text, format);
  const multi = entry.length > 1;
  const lines = notes.split("\n");
  const block = findBlock(lines);
  if (!block) {
    const journal = ["@journal", "", ...entry, "", "@endjournal"].join("\n");
    return [notes.trimEnd(), journal].filter(Boolean).join("\n\n");
  }
  const at = hasTime ? when.getTime() : new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime();
  const entries = parseJournal(notes, dayFirst)!;
  const isMulti = (e: JournalEntry) => e.text.includes("\n") || e.end > e.start;
  const next = entries.find((e) => e.at <= at);
  const last = entries[entries.length - 1];
  if (next) lines.splice(next.start, 0, ...entry, ...(multi || isMulti(next) ? [""] : []));
  else if (last) lines.splice(last.end + 1, 0, ...(multi || isMulti(last) ? [""] : []), ...entry);
  else {
    const before = lines[block.end - 1].trim() ? [""] : [];
    lines.splice(block.end, 0, ...before, ...entry, ...(block.closed ? [""] : []));
  }
  return lines.join("\n");
}
