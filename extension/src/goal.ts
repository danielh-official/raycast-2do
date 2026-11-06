// A goal lives in a task's notes as a block, one line per date, newest first:
//
//   @goal: 32 pages
//
//   2026-11-06: 10
//   2026-11-05: -1
//
//   @endgoal
//
// Lines inside the block that aren't entries are ignored, and text outside it is left alone.
export type GoalEntry = { date: string; amount: number };
export type Goal = { total: number; unit: string; entries: GoalEntry[] };

const HEADER = /^@goal:\s*(\d+(?:\.\d+)?)\s*(.*)$/i;
const END = /^@endgoal$/i;
const ENTRY = /^(\d{4}-\d{2}-\d{2}):\s*([+-]?\d+(?:\.\d+)?)$/;

// Header line through @endgoal, or through the last line when @endgoal is missing.
function findBlock(lines: string[]) {
  const start = lines.findIndex((l) => HEADER.test(l.trim()));
  if (start < 0) return;
  const end = lines.findIndex((l, i) => i > start && END.test(l.trim()));
  return { start, end: end < 0 ? lines.length - 1 : end };
}

export function parseGoal(notes: string): Goal | undefined {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  if (!block) return;
  const [, total, unit] = lines[block.start].trim().match(HEADER)!;
  const entries = lines.slice(block.start + 1, block.end + 1).flatMap((l) => {
    const m = l.trim().match(ENTRY);
    return m ? [{ date: m[1], amount: Number(m[2]) }] : [];
  });
  return { total: Number(total), unit: unit.trim(), entries };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function formatGoal({ total, unit, entries }: Goal) {
  const lines = [...entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => `${e.date}: ${round(e.amount)}`);
  return [
    `@goal: ${round(total)}${unit ? ` ${unit}` : ""}`,
    "",
    ...lines,
    ...(lines.length ? [""] : []),
    "@endgoal",
  ].join("\n");
}

// Replaces the goal block in place, appends one at the end, or removes it when `goal` is undefined.
export function writeGoal(notes: string, goal?: Goal) {
  const lines = notes.split("\n");
  const block = findBlock(lines);
  if (!block) return goal ? [notes.trimEnd(), formatGoal(goal)].filter(Boolean).join("\n\n") : notes;
  const start = !goal && block.start > 0 && !lines[block.start - 1].trim() ? block.start - 1 : block.start;
  lines.splice(start, block.end - start + 1, ...(goal ? [formatGoal(goal)] : []));
  return lines.join("\n").trimEnd();
}

// Adds `amount` to `date`'s line, keeping one line per date. A day that nets to 0 is dropped.
export function logProgress(goal: Goal, date: string, amount: number): Goal {
  const day = round((goal.entries.find((e) => e.date === date)?.amount ?? 0) + amount);
  const rest = goal.entries.filter((e) => e.date !== date);
  return { ...goal, entries: day ? [...rest, { date, amount: day }] : rest };
}

export function goalProgress(goal: Goal, today: string) {
  const sum = (entries: GoalEntry[]) => round(entries.reduce((n, e) => n + e.amount, 0));
  return { done: sum(goal.entries), today: sum(goal.entries.filter((e) => e.date === today)) };
}
