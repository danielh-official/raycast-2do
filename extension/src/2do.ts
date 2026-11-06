import { Form } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { DayFormat } from "./dates";
import { appendGoal, formatGoal, parseGoal, removeGoal, setGoalHeader } from "./goal";

export type List = { list_id: string; collection_id: string; title: string };
export type SmartList = { smart_list_id: string; collection_id: string; title: string };
export type Tag = { tag_id: string; title: string };
export type Task = {
  task_id: string;
  title: string;
  notes: string;
  list_id: string;
  list_title: string;
  completed: boolean;
  starred: boolean;
  priority: "none" | "low" | "medium" | "high";
  start_date?: string;
  start_time?: string;
  due_date?: string;
  due_time?: string;
  tags: Tag[];
  task_type: "normal" | "project" | "checklist";
  action: { type: string; value?: string };
  presentation: { due_date_formatted?: string; is_overdue: boolean };
};

export type TaskValues = {
  title: string;
  notes: string;
  list_id: string;
  start: Date | null;
  due: Date | null;
  priority: string;
  starred: boolean;
  tag_ids: string[];
  // Undefined when the form leaves the task's action alone (a type missing from ACTIONS).
  action_type?: string;
  action_value?: string;
  // Undefined when the form leaves the goal alone. Current and Last Completed only apply when a
  // task first becomes a goal; after that, progress is logged.
  is_goal?: boolean;
  goal_total?: string;
  goal_unit?: string;
  goal_current?: string;
  goal_last?: Date | null;
};

export function goalValueError(field: "total" | "current", value?: string) {
  const n = Number(value);
  if (field === "total" && !(value?.trim() && n > 0)) return "Enter a number above 0";
  if (field === "current" && value?.trim() && !(n >= 0)) return "Enter a number, 0 or more";
}

// 2Do's task action types besides "none", with how the form asks for each one's value.
export const ACTIONS: Record<string, { title: string; label: string; placeholder: string }> = {
  url: { title: "Link", label: "URL", placeholder: "https://" },
  call: { title: "Call", label: "Phone Number", placeholder: "+1 555 0100" },
  message: { title: "Message", label: "Phone Number", placeholder: "+1 555 0100" },
  mail: { title: "Email", label: "Email Address", placeholder: "name@example.com" },
  visit: { title: "Visit", label: "Address", placeholder: "1 Infinite Loop, Cupertino" },
  google: { title: "Google", label: "Search Terms", placeholder: "Search Google" },
};

export function actionValueError(type?: string, value?: string) {
  if (!type || type === "none") return;
  if (!value?.trim()) return "Required";
  if (type === "url" && !(/^[a-z][\w+.-]*:\/\//i.test(value) && URL.canParse(value)))
    return "Enter a full link, like https://example.com";
}

// The URL that runs a task's action, e.g. tel: for a call. Undefined for no action or an unknown type.
export function actionURL({ type, value = "" }: Task["action"]) {
  const phone = value.replace(/[^\d+*#]/g, "");
  const query = encodeURIComponent(value);
  if (type === "url") return value;
  if (type === "call") return `tel:${phone}`;
  if (type === "message") return `sms:${phone}`;
  if (type === "mail") return `mailto:${value}`;
  if (type === "visit") return `maps://?q=${query}`;
  if (type === "google") return `https://www.google.com/search?q=${query}`;
}

// Calls a command from 2Do's AppleScript "Automation Suite" (same commands and arguments as 2Do's MCP server).
// 2Do errors are thrown as script errors, e.g. "not_found: Task 'x' was not found."
export async function twoDo<T>(command: string, args: object = {}): Promise<T> {
  const out = await runAppleScript(
    `function run(argv) { return JSON.stringify(Application("2Do")[argv[0]]({ arguments: JSON.parse(argv[1]) })); }`,
    [command, JSON.stringify(args)],
    { language: "JavaScript" },
  );
  return JSON.parse(out);
}

const pad = (n: number) => String(n).padStart(2, "0");

// Local "yyyy-MM-dd".
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 2Do takes floating local "yyyy-MM-dd" dates and optional "HH:mm" times. null clears (edit only).
export function dateFields(prefix: "start" | "due", d: Date | null, clear: boolean) {
  const empty = clear ? { [`${prefix}_date`]: null, [`${prefix}_time`]: null } : {};
  if (!d) return empty;
  return {
    ...empty,
    [`${prefix}_date`]: ymd(d),
    ...(!Form.DatePicker.isFullDay(d) && { [`${prefix}_time`]: `${pad(d.getHours())}:${pad(d.getMinutes())}` }),
  };
}

export function toDate(date?: string, time?: string) {
  if (!date) return null;
  if (time) return new Date(`${date}T${time}`);
  // Raycast marks a full-day date (no time) with 1 millisecond; see Form.DatePicker.isFullDay in Raycast's runtime.
  return new Date(`${date}T00:00:00.001`);
}

// Splits Today into Now and Later Today: a task has started unless it has a start time still ahead.
export function hasStarted(task: Task, now = new Date()) {
  if (!task.start_time) return true;
  const start = toDate(task.start_date, task.start_time);
  return !start || start <= now;
}

// Tag picker choices: all tags plus the task's own. 2Do can leave a task's tag out of list_tags,
// and a picker value with no matching item is dropped on save, which would remove the tag.
export function tagOptions(tags: Tag[] = [], task?: Task): Tag[] {
  const known = new Set(tags.map((t) => t.tag_id));
  return [...tags, ...(task?.tags ?? []).filter((t) => !known.has(t.tag_id))];
}

export function taskToValues(task: Task): TaskValues {
  return {
    title: task.title,
    notes: task.notes,
    list_id: task.list_id,
    start: toDate(task.start_date, task.start_time),
    due: toDate(task.due_date, task.due_time),
    priority: task.priority,
    starred: task.starred,
    tag_ids: task.tags.map((t) => t.tag_id),
    action_type: task.action.type === "none" || task.action.type in ACTIONS ? task.action.type : undefined,
    action_value: task.action.value ?? "",
    ...goalValues(task),
  };
}

function goalValues(task: Task) {
  const goal = parseGoal(task.notes);
  return {
    is_goal: !!goal,
    goal_total: goal ? String(goal.total) : "",
    goal_unit: goal?.unit ?? "",
    goal_last: new Date(),
  };
}

// The task's links: its link action first, then URLs in the notes, without duplicates.
export function taskLinks(task: Task): string[] {
  const inNotes = (task.notes.match(/\b[a-z][\w+.-]*:\/\/[^\s<>"]+/gi) ?? []).map((u) => {
    u = u.replace(/[.,;:!?]+$/, "");
    return u.endsWith(")") && !u.includes("(") ? u.slice(0, -1) : u;
  });
  const link = task.action.type === "url" ? task.action.value : undefined;
  return [...new Set([link, ...inNotes].filter((u): u is string => !!u))];
}

export type GoalPrefs = { goalTag: string; goalDateFormat: DayFormat };

// The notes and tags to save once the goal fields are applied: a new goal block is added, an
// existing one only gets its header changed (its entries stay as typed), or the block is removed.
// The goal tag follows the block.
export async function applyGoal(v: TaskValues, p: GoalPrefs): Promise<TaskValues> {
  if (v.is_goal === undefined) return v;
  const existing = parseGoal(v.notes);
  if (!v.is_goal) {
    if (!existing) return v;
    const tag = await findTag(p.goalTag);
    return { ...v, notes: removeGoal(v.notes), tag_ids: v.tag_ids.filter((id) => id !== tag?.tag_id) };
  }
  const total = Number(v.goal_total);
  const unit = v.goal_unit?.trim() ?? "";
  const current = Number(v.goal_current);
  const notes = existing
    ? setGoalHeader(v.notes, total, unit)
    : appendGoal(
        v.notes,
        formatGoal(
          total,
          unit,
          current > 0 ? [{ day: ymd(v.goal_last ?? new Date()), amount: current }] : [],
          p.goalDateFormat,
        ),
      );
  const tag = await ensureTag(p.goalTag);
  return { ...v, notes, tag_ids: [...new Set([...v.tag_ids, tag.tag_id])] };
}

// Creates a task, or updates `task` (moving it if the list changed).
export async function saveTask(v: TaskValues, task?: Task) {
  const fields = {
    title: v.title,
    priority: v.priority,
    starred: v.starred,
    ...dateFields("start", v.start, !!task),
    ...dateFields("due", v.due, !!task),
  };
  // 2Do rejects a value on "none" and requires one on every other type.
  const action =
    !v.action_type || v.action_type === "none"
      ? { type: "none" }
      : { type: v.action_type, value: v.action_value?.trim() };
  if (!task) {
    await twoDo("create_task", {
      ...fields,
      list_id: v.list_id,
      notes: v.notes || undefined,
      ...(v.tag_ids.length > 0 && { tag_update: { operation: "set", tag_ids: v.tag_ids } }),
      ...(action.type !== "none" && { action }),
    });
    return;
  }
  await twoDo("update_task", {
    ...fields,
    task_id: task.task_id,
    notes: v.notes,
    tag_update: { operation: "set", tag_ids: v.tag_ids },
    ...(v.action_type !== undefined &&
      (action.type !== task.action.type || action.value !== task.action.value) && { action }),
  });
  if (v.list_id !== task.list_id) await twoDo("move_task", { task_id: task.task_id, list_id: v.list_id });
}

// Extension preferences that set what Cancel Task does.
export type CancelPrefs = {
  cancelBehavior: "complete-and-tag" | "tag" | "move" | "delete";
  cancelTag: string;
  cancelList: string;
};

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function findTag(title: string) {
  const { tags } = await twoDo<{ tags: Tag[] }>("list_tags");
  return tags.find((t) => sameTitle(t.title, title));
}

// 2Do automation can't create tags, but 2Do's URL scheme creates missing tags when it adds a task.
// So a missing tag is made by adding a placeholder task carrying it (2Do stays in the background),
// then deleting the placeholder once the tag shows up.
export async function ensureTag(title: string): Promise<Tag> {
  const existing = await findTag(title);
  if (existing) return existing;
  const placeholder = `Raycast is creating the ${title.trim()} tag (${Date.now()})`;
  const url = `twodo://x-callback-url/add?task=${encodeURIComponent(placeholder)}&tags=${encodeURIComponent(title.trim())}&ignoredefaults=1`;
  await promisify(execFile)("open", ["-g", url]);
  for (let i = 0; i < 20; i++) {
    await sleep(250);
    const tag = await findTag(title);
    const { tasks } = await twoDo<{ tasks: Task[] }>("query_tasks", { search: placeholder, paused_filter: "include" });
    const added = tasks.filter((t) => t.title === placeholder);
    if (!tag || added.length === 0) continue;
    for (const t of added) await twoDo("delete_task", { task_id: t.task_id });
    return tag;
  }
  throw new Error(`Couldn't create the 2Do tag "${title}". Create it in 2Do, then try again.`);
}

// 2Do's own convention is a completed task carrying a "Cancelled" tag. A missing cancel tag is
// created; 2Do automation can't create lists, so a missing list is an error naming the preference.
export async function cancelTask(task: Task, p: CancelPrefs) {
  if (p.cancelBehavior === "delete") {
    await twoDo("delete_task", { task_id: task.task_id });
    return;
  }
  let taskId = task.task_id;
  if (p.cancelBehavior === "move") {
    if (!p.cancelList.trim()) throw new Error("Set the Cancel List preference to the list cancelled tasks move to.");
    const { list } = await twoDo<{ list: List[] }>("list_lists");
    const target = list.find((l) => sameTitle(l.title, p.cancelList));
    if (!target) throw new Error(`No 2Do list named "${p.cancelList}". Check the Cancel List preference.`);
    // A move gives the task a new ID.
    const moved = await twoDo<{ task: { task_id: string } }>("move_task", { task_id: taskId, list_id: target.list_id });
    taskId = moved.task.task_id;
  } else {
    const tag = await ensureTag(p.cancelTag);
    await twoDo("update_task", { task_id: taskId, tag_update: { operation: "append", tag_ids: [tag.tag_id] } });
  }
  if (p.cancelBehavior !== "tag") await twoDo("complete_task", { task_id: taskId });
}

export function isCancelled(task: Task, p: CancelPrefs) {
  return task.completed && task.tags.some((t) => sameTitle(t.title, p.cancelTag));
}

// Scope values are 2Do collection ids ("list:<id>", "smart-list:<id>") or "focus:<name>".
export function scopeArgs(scope: string) {
  const [kind, id] = scope.split(":");
  if (kind === "list") return { list_id: id, include_completed: false };
  if (kind === "smart-list") return { smart_list_id: id, include_completed: false };
  return { focus: id, include_completed: id === "done" };
}
