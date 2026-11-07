import { DayFormat, formatDay, parseTimestamp } from "./dates";

// A goal lives in a task's notes as a block, one line per date, newest first:
//
//   @goal: 32 pages
//
//   Nov 6, 2026: 10
//   2026-11-05 2 pm - -1
//   Nov 4, 2026: 4
//
//   @endgoal
//
// An entry is a timestamp in any common format, then ":" or " - ", then an amount. Entries with
// times count toward their day. Other lines in the block are ignored, and the extension never
// rewrites lines it didn't write: logging updates or adds a date-only line, and editing the goal
// only changes the header. Text outside the block is left alone.
// `stamp` is the timestamp as written; `at` orders entries (see Timestamp).
export type GoalEntry = { day: string; amount: number; hasTime: boolean; at: number; stamp: string; line: number };
export type Goal = { total: number; unit: string; entries: GoalEntry[] };

export const HEADER = /^@goal:\s*(\d+(?:\.\d+)?)\s*(.*)$/i;
export const END = /^@endgoal$/i;
const AMOUNT = /^[+-]?\d+(?:\.\d+)?$/;

// Header line through @endgoal, or through the last line when @endgoal is missing.
function findBlock(lines: string[]) {
  const start = lines.findIndex((l) => HEADER.test(l.trim()));
  if (start < 0) return;
  const end = lines.findIndex((l, i) => i > start && END.test(l.trim()));
  return { start, end: end < 0 ? lines.length - 1 : end, closed: end >= 0 };
}

// Tries each ":" or " - " in turn, since times have colons too ("11:00 am: 3").
function readEntry(text: string, dayFirst?: boolean) {
  for (const sep of text.matchAll(/:\s*|\s[-–—]\s+/g)) {
    const amount = text.slice(sep.index + sep[0].length);
    if (!AMOUNT.test(amount)) continue;
    const stamp = text.slice(0, sep.index).trim();
    const timestamp = parseTimestamp(stamp, dayFirst);
    if (timestamp) return { ...timestamp, stamp, amount: Number(amount) };
  }
}

export function parseGoal(notes: string, dayFirst?: boolean): Goal | undefined {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  if (!block) return;
  const [, total, unit] = lines[block.start].trim().match(HEADER)!;
  const entries: GoalEntry[] = [];
  for (let i = block.start + 1; i <= block.end; i++) {
    const entry = readEntry(lines[i].trim(), dayFirst);
    if (entry) entries.push({ ...entry, line: i });
  }
  return { total: Number(total), unit: unit.trim(), entries };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

const header = (total: number, unit: string) => `@goal: ${round(total)}${unit ? ` ${unit}` : ""}`;

// A new block, for a task becoming a goal.
export function formatGoal(total: number, unit: string, entries: { day: string; amount: number }[], format: DayFormat) {
  const lines = [...entries]
    .sort((a, b) => b.day.localeCompare(a.day))
    .map((e) => `${formatDay(e.day, format)}: ${round(e.amount)}`);
  return [header(total, unit), "", ...lines, ...(lines.length ? [""] : []), "@endgoal"].join("\n");
}

export function appendGoal(notes: string, block: string) {
  return [notes.trimEnd(), block].filter(Boolean).join("\n\n");
}

export function setGoalHeader(notes: string, total: number, unit: string) {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  if (!block) return notes;
  lines[block.start] = header(total, unit);
  return lines.join("\n");
}

// Empties the goal's entries in place, keeping its total and unit: a fresh start.
export function resetGoal(notes: string, dayFirst?: boolean) {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  const goal = parseGoal(notes, dayFirst);
  if (!block || !goal) return notes;
  lines.splice(block.start, block.end - block.start + 1, formatGoal(goal.total, goal.unit, [], "yyyy-MM-dd"));
  return lines.join("\n");
}

// Removes the block and one blank line beside it: the one before, or after when it's at the top.
export function removeGoal(notes: string) {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  if (!block) return notes;
  const blankBefore = block.start > 0 && !lines[block.start - 1].trim();
  const blankAfter = !blankBefore && block.end + 1 < lines.length && !lines[block.end + 1].trim();
  const start = blankBefore ? block.start - 1 : block.start;
  lines.splice(start, block.end - start + 1 + (blankAfter ? 1 : 0));
  return lines.join("\n").trimEnd();
}

// Adds `amount` to the day's date-only line, whatever its format, or adds a line in `format`
// before the first older entry. A date-only line that nets to 0 is dropped.
export function logProgress(notes: string, day: string, amount: number, format: DayFormat, dayFirst?: boolean) {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  const goal = parseGoal(notes, dayFirst);
  if (!block || !goal) return notes;
  const own = goal.entries.find((e) => e.day === day && !e.hasTime);
  if (own) {
    const sum = round(own.amount + amount);
    if (sum) lines[own.line] = lines[own.line].replace(/[+-]?\d+(?:\.\d+)?\s*$/, String(sum));
    else lines.splice(own.line, 1);
    return lines.join("\n");
  }
  const line = `${formatDay(day, format)}: ${round(amount)}`;
  const older = goal.entries.find((e) => e.day < day);
  if (older) lines.splice(older.line, 0, line);
  else if (goal.entries.length) lines.splice(goal.entries[goal.entries.length - 1].line + 1, 0, line);
  else {
    const at = block.closed ? block.end : block.end + 1;
    lines.splice(at, 0, ...(lines[at - 1].trim() ? [""] : []), line, ...(block.closed ? [""] : []));
  }
  return lines.join("\n");
}

export type NotesIssue = { message: string; fixable: boolean };

// What makes part of a goal be ignored. Only a missing @endgoal can be fixed (closeGoal).
export function checkGoal(notes: string, dayFirst?: boolean): NotesIssue[] {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  if (!block) {
    const broken = lines.find((l) => /^@goal\b/i.test(l.trim()));
    return broken
      ? [{ message: `"${broken.trim()}" needs a total, like "@goal: 32 pages", so it isn't a goal.`, fixable: false }]
      : [];
  }
  const goal = parseGoal(notes, dayFirst)!;
  const issues: NotesIssue[] = [];
  if (!block.closed)
    issues.push({
      message: "The goal has no @endgoal line, so the rest of the notes counts as part of it.",
      fixable: true,
    });
  // Without @endgoal, only lines up to the last entry are the goal's.
  const end = block.closed ? block.end - 1 : (goal.entries.at(-1)?.line ?? block.start);
  const entryLines = new Set(goal.entries.map((e) => e.line));
  const skipped = lines
    .slice(block.start + 1, end + 1)
    .filter((l, i) => l.trim() && !entryLines.has(block.start + 1 + i));
  if (skipped.length)
    issues.push({
      message: `${skipped.length === 1 ? "A line" : `${skipped.length} lines`} in the goal can't be read as a date and amount, so ${skipped.length === 1 ? "it's" : "they're"} ignored: "${skipped[0].trim()}".`,
      fixable: false,
    });
  return issues;
}

// Adds a missing @endgoal after the goal's last entry (or its header), so text after it is the notes' again.
export function closeGoal(notes: string, dayFirst?: boolean) {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  if (!block || block.closed) return notes;
  const after = parseGoal(notes, dayFirst)!.entries.at(-1)?.line ?? block.start;
  lines.splice(after + 1, 0, "", "@endgoal", ...(lines[after + 1]?.trim() ? [""] : []));
  return lines.join("\n");
}

// Entries newest first, each with the running total up to and including it. Entries at the same
// moment keep the notes' order, which lists newer first.
export function progressHistory(goal: Goal) {
  let total = 0;
  return [...goal.entries]
    .sort((a, b) => a.at - b.at || b.line - a.line)
    .map((e) => ({ ...e, total: (total = round(total + e.amount)) }))
    .reverse();
}

export function goalProgress(goal: Goal, today: string) {
  const sum = (entries: GoalEntry[]) => round(entries.reduce((n, e) => n + e.amount, 0));
  return { done: sum(goal.entries), today: sum(goal.entries.filter((e) => e.day === today)) };
}
