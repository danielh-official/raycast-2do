import { Form } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import { DayFormat, ymd } from "./dates";
import { appendGoal, formatGoal, parseGoal, removeGoal, setGoalHeader } from "./goal";
import { splitNotes } from "./notes";

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
  let out: string;
  try {
    out = await runAppleScript(
      `function run(argv) { return JSON.stringify(Application("2Do")[argv[0]]({ arguments: JSON.parse(argv[1]) })); }`,
      [command, JSON.stringify(args)],
      { language: "JavaScript" },
    );
  } catch (error) {
    throw friendlyError(error);
  }
  return JSON.parse(out);
}

// AppleScript's errors for a 2Do without the Automation Suite (-1708) or no 2Do at all (-2700),
// reworded to say what to do. Other errors, like 2Do's own "not_found: …", pass through.
export function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Message not understood|-1708/.test(message))
    return new Error(
      "This 2Do version doesn't have the automation this extension uses. Update 2Do to the latest version, then try again.",
    );
  if (/Application can.t be found|-2700|-10814/.test(message))
    return new Error("2Do isn't installed. Install 2Do for Mac, then try again.");
  return error;
}

const pad = (n: number) => String(n).padStart(2, "0");

export { ymd };

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

// The Notes field leaves out the goal and journal blocks; TaskForm puts them back on save.
export function taskToValues(task: Task): TaskValues {
  return {
    title: task.title,
    notes: splitNotes(task.notes).text,
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

// `goalTag` is empty unless the user wants goals tagged in 2Do.
export type GoalPrefs = { goalTag: string; goalDateFormat: DayFormat };

// The notes and tags to save once the goal fields are applied: a new goal block is added, an
// existing one only gets its header changed (its entries stay as typed), or the block is removed.
// When a goal tag is set, it follows the block, and it must already exist in 2Do.
export async function applyGoal(v: TaskValues, p: GoalPrefs): Promise<TaskValues> {
  if (v.is_goal === undefined) return v;
  const existing = parseGoal(v.notes);
  if (!v.is_goal) {
    if (!existing) return v;
    const tag = p.goalTag.trim() ? await findTag(p.goalTag) : undefined;
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
  if (!p.goalTag.trim()) return { ...v, notes };
  const tag = await requireTag(p.goalTag, "Create it in 2Do, or change or clear the Goal Tag preference.");
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

// 2Do automation can't create tags, so a missing tag is an error saying how to fix it.
export async function requireTag(title: string, fix: string): Promise<Tag> {
  const tag = await findTag(title);
  if (!tag) throw new Error(`No 2Do tag named "${title.trim()}". ${fix}`);
  return tag;
}

// 2Do's own convention is a completed task carrying a "Cancelled" tag. 2Do automation can't create
// tags or lists, so a missing one is an error naming the preference.
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
    const tag = await requireTag(
      p.cancelTag,
      "Add it in 2Do, or set Cancel Tag in the extension's settings to the tag you use for cancelled tasks.",
    );
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
