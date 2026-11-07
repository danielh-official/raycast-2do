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

// What makes part of a journal be ignored. Only a missing @endjournal can be fixed (closeJournal).
export function checkJournal(notes: string, dayFirst?: boolean): { message: string; fixable: boolean }[] {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  if (!block) {
    const broken = lines.find((l) => /^@journal\b/i.test(l.trim()));
    return broken
      ? [
          {
            message: `"${broken.trim()}" should be "@journal" alone on its line, so it isn't a journal.`,
            fixable: false,
          },
        ]
      : [];
  }
  const issues: { message: string; fixable: boolean }[] = [];
  if (!block.closed)
    issues.push({
      message: "The journal has no @endjournal line, so the rest of the notes counts as part of its last entry.",
      fixable: true,
    });
  const first = parseJournal(notes, dayFirst)![0]?.start ?? block.end;
  const stray = lines.slice(block.start + 1, first).filter((l) => l.trim());
  if (stray.length)
    issues.push({
      message: `Text before the journal's first entry isn't shown: "${stray[0].trim()}".`,
      fixable: false,
    });
  return issues;
}

// Adds a missing @endjournal after the last entry's own paragraph: its line plus following lines up
// to a blank line, or for a timestamp alone on its line, the paragraph below it. Text after that is
// the notes' again.
export function closeJournal(notes: string, dayFirst?: boolean) {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  if (!block || block.closed) return notes;
  const last = parseJournal(notes, dayFirst)!.at(-1);
  let i = last?.start ?? block.start;
  if (last && !readEntryStart(lines[i].trim(), dayFirst)?.text) {
    while (i + 1 < lines.length && !lines[i + 1].trim()) i++;
  }
  while (last && i + 1 < lines.length && lines[i + 1].trim()) i++;
  lines.splice(i + 1, 0, "", "@endjournal", ...(lines[i + 1]?.trim() ? [""] : []));
  return lines.join("\n");
}

// The entry's lines: one line, or the timestamp, a blank line, and the text when it has several lines.
export function formatEntry(when: Date, hasTime: boolean, text: string, format: DayFormat) {
  const day = formatDay(ymd(when), format);
  return entryLines(hasTime ? `${day} ${formatTime(when)}` : day, text);
}

function entryLines(stamp: string, text: string) {
  const body = text.trim();
  return body.includes("\n") ? [stamp, "", ...body.split("\n")] : [`${stamp} - ${body}`];
}

// The entry as it is in `notes` now, if it still starts on the same line with the same timestamp;
// undefined if the notes changed since it was read.
function stillThere(notes: string, entry: JournalEntry, dayFirst?: boolean) {
  return parseJournal(notes, dayFirst)?.find((e) => e.start === entry.start && e.stamp === entry.stamp);
}

// Removes the entry's lines, and a blank line left doubled where it was.
function removeEntry(lines: string[], entry: JournalEntry) {
  lines.splice(entry.start, entry.end - entry.start + 1);
  if (!lines[entry.start]?.trim() && !lines[entry.start - 1]?.trim()) lines.splice(entry.start, 1);
}

// Removes one entry. Undefined if the entry changed since it was read.
export function deleteJournalEntry(notes: string, entry: JournalEntry, dayFirst?: boolean) {
  const current = stillThere(notes, entry, dayFirst);
  if (!current) return;
  const lines = notes.split("\n");
  removeEntry(lines, current);
  return lines.join("\n");
}

// Changes one entry. With the same moment, the text is replaced in place under the timestamp as
// written; a new moment moves the entry into time order, written in `format`. Undefined if the entry
// changed since it was read.
export function editJournalEntry(
  notes: string,
  entry: JournalEntry,
  change: { text: string; when: Date; hasTime: boolean },
  format: DayFormat,
  dayFirst?: boolean,
) {
  const current = stillThere(notes, entry, dayFirst);
  if (!current) return;
  const at = change.hasTime
    ? change.when.getTime()
    : new Date(change.when.getFullYear(), change.when.getMonth(), change.when.getDate()).getTime();
  const lines = notes.split("\n");
  if (at === current.at && change.hasTime === current.hasTime) {
    const replacement = entryLines(current.stamp, change.text);
    const spaced = replacement.length > 1 && lines[current.end + 1]?.trim() ? [...replacement, ""] : replacement;
    lines.splice(current.start, current.end - current.start + 1, ...spaced);
    return lines.join("\n");
  }
  removeEntry(lines, current);
  return addJournalEntry(lines.join("\n"), change.when, change.hasTime, change.text, format, dayFirst);
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
