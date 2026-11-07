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
  recurrence?: {
    frequency?: string;
    interval?: number;
    unit?: string;
    weekdays?: string[];
    weekday?: string;
    ordinal?: number | string;
    based_on?: string;
    end_rule?: { type?: string; occurrence_count?: number; date?: string };
  } | null;
  completion_date?: string;
  action: { type: string; value?: string };
  presentation: { due_date_formatted?: string; is_overdue: boolean };
};

export type Recurrence = {
  frequency?: string;
  interval?: number;
  unit?: string;
  weekdays?: Weekday[];
  weekday?: Weekday;
  ordinal?: number | string;
  based_on?: string;
  end_rule?: { type?: string; occurrence_count?: number; date?: string };
};

// A recurrence as 2Do reports it: unchecked weekday names, and its misnamed keys ("wkdy" for the
// monthly weekday, "ldt " for the end date). recurrenceOf turns it into a Recurrence.
export type RawRecurrence = Omit<Recurrence, "weekdays" | "weekday" | "end_rule"> & {
  weekdays?: string[];
  weekday?: string;
  wkdy?: string;
  end_rule?: Recurrence["end_rule"] & { "ldt "?: string };
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
  // Comma-separated tag names, for tags not in 2Do yet. Names matching an existing tag use that tag.
  new_tags?: string;
  // Undefined when the form leaves the task's action alone (a type missing from ACTIONS).
  action_type?: string;
  action_value?: string;
  // A project or checklist in the list to put the task in, or "" for the list itself.
  parent_id?: string;
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
    parent_id: "",
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

// Creates a task, or updates `task` (moving it if the list changed). With `parent_id`, the task goes
// into that project or checklist instead: 2Do takes exactly one destination, list or parent.
export async function saveTask(v: TaskValues, task?: Task) {
  // 2Do can't repeat a task without dates, so a repeating task with neither date starts today.
  const repeats = !!v.is_repeating && !!v.repeat;
  const start = repeats && !v.start && !v.due ? toDate(ymd(new Date())) : v.start;
  const fields = {
    title: v.title,
    priority: v.priority,
    starred: v.starred,
    ...dateFields("start", start, !!task),
    ...dateFields("due", v.due, !!task),
  };
  const tagUpdate = await tagUpdateFor(v, task);
  // 2Do rejects a value on "none" and requires one on every other type.
  const action =
    !v.action_type || v.action_type === "none"
      ? { type: "none" }
      : { type: v.action_type, value: v.action_value?.trim() };
  if (!task) {
    await twoDo("create_task", {
      ...fields,
      ...(v.parent_id ? { parent_task_id: v.parent_id } : { list_id: v.list_id }),
      notes: v.notes || undefined,
      ...((tagUpdate.tag_ids.length > 0 || tagUpdate.tag_names) && { tag_update: tagUpdate }),
      ...(action.type !== "none" && { action }),
      ...(repeats && { recurrence: recurrenceArgs(v) }),
    });
    return;
  }
  // Sent only when changed, so an untouched repeat stays exactly as 2Do has it.
  const recurrence = recurrenceArgs(v);
  const repeatChanged =
    v.repeat !== undefined && JSON.stringify(recurrence) !== JSON.stringify(recurrenceArgs(repeatValues(task)));
  await twoDo("update_task", {
    ...fields,
    task_id: task.task_id,
    notes: v.notes,
    tag_update: tagUpdate,
    ...(v.action_type !== undefined &&
      (action.type !== task.action.type || action.value !== task.action.value) && { action }),
    ...(repeatChanged && { recurrence }),
  });
  if (v.parent_id) await twoDo("move_task", { task_id: task.task_id, parent_task_id: v.parent_id });
  else if (v.list_id !== task.list_id) await twoDo("move_task", { task_id: task.task_id, list_id: v.list_id });
}

// Projects and checklists in a list, which a task can be put in. 2Do turns a project or checklist
// put inside another into a normal task, so only normal tasks are offered this.
export async function listParents(listId: string) {
  const { tasks } = await twoDo<{ tasks: Task[] }>("query_tasks", { list_id: listId, include_completed: false });
  return tasks.filter((t) => t.task_type !== "normal");
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

export const isRepeating = (task: Task) => !!task.recurrence?.frequency && task.recurrence.frequency !== "none";

const day3 = (d: string) => d.slice(0, 1).toUpperCase() + d.slice(1, 3);
const ordinal = (n: number | string) => {
  const v = Number(n);
  if (!Number.isInteger(v)) return String(n);
  if (v === -1) return "last";
  const teen = v % 100 >= 11 && v % 100 <= 13;
  return `${v}${teen ? "th" : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[v % 10] ?? "th")}`;
};

// A repeating task's rule in words, like "Every 3 days" or "Weekly on Mon, Tue, after completion".
export function repeatRule(task: Task) {
  const r = task.recurrence;
  if (!r || !isRepeating(task)) return;
  const base: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };
  let rule =
    r.frequency === "custom" && r.interval
      ? `Every ${r.interval === 1 ? "" : `${r.interval} `}${r.unit ?? "day"}${r.interval === 1 ? "" : "s"}`
      : r.frequency === "weekdays"
        ? "On weekdays"
        : (base[r.frequency!] ?? r.frequency!.slice(0, 1).toUpperCase() + r.frequency!.slice(1));
  if (r.weekdays?.length) rule += ` on ${r.weekdays.map(day3).join(", ")}`;
  else if (r.weekday && r.ordinal !== undefined) rule += ` on the ${ordinal(r.ordinal)} ${day3(r.weekday)}`;
  if (r.based_on === "completion") rule += ", after completion";
  if (r.end_rule?.type === "after_count" && r.end_rule.occurrence_count)
    rule += `, ${r.end_rule.occurrence_count} times`;
  if (r.end_rule?.type === "on_date" && r.end_rule.date) rule += `, until ${r.end_rule.date}`;
  return rule;
}

// Completes `task` and returns the ID of the completed occurrence. For a repeating task, 2Do keeps the
// open task (moved to its next date) and adds a completed copy, which only a search by title finds.
async function completeOccurrence(task: Task) {
  const { task: after } = await twoDo<{ task: Task }>("complete_task", { task_id: task.task_id });
  if (after.completed) return after.task_id;
  const { tasks } = await twoDo<{ tasks: Task[] }>("query_tasks", {
    search: task.title,
    include_completed: true,
    paused_filter: "include",
  });
  const [copy] = tasks
    .filter((t) => t.completed && t.title === task.title && t.task_id !== task.task_id)
    .sort((a, b) => (b.completion_date ?? "").localeCompare(a.completion_date ?? ""));
  if (!copy)
    throw new Error("Completed this occurrence, but couldn't find it to finish cancelling. Check 2Do's Done view.");
  return copy.task_id;
}

// 2Do's own convention is a completed task carrying a "Cancelled" tag. The task is completed first,
// then only the completed occurrence is tagged, moved, or deleted, so a repeating task's next
// occurrence stays untouched. 2Do automation can't create tags or lists, so a missing one is an
// error naming the preference, raised before anything changes.
export async function cancelTask(task: Task, p: CancelPrefs) {
  const needsTag = p.cancelBehavior === "complete-and-tag" || p.cancelBehavior === "tag";
  const tag = needsTag
    ? await requireTag(
        p.cancelTag,
        "Add it in 2Do, or set Cancel Tag in the extension's settings to the tag you use for cancelled tasks.",
      )
    : undefined;
  let target: List | undefined;
  if (p.cancelBehavior === "move") {
    if (!p.cancelList.trim()) throw new Error("Set the Cancel List preference to the list cancelled tasks move to.");
    const { list } = await twoDo<{ list: List[] }>("list_lists");
    target = list.find((l) => sameTitle(l.title, p.cancelList));
    if (!target) throw new Error(`No 2Do list named "${p.cancelList}". Check the Cancel List preference.`);
  }
  if (p.cancelBehavior === "delete" && !isRepeating(task)) {
    await twoDo("delete_task", { task_id: task.task_id });
    return;
  }
  const taskId = p.cancelBehavior === "tag" ? task.task_id : await completeOccurrence(task);
  if (tag) await twoDo("update_task", { task_id: taskId, tag_update: { operation: "append", tag_ids: [tag.tag_id] } });
  if (target) await twoDo("move_task", { task_id: taskId, list_id: target.list_id });
  if (p.cancelBehavior === "delete") await twoDo("delete_task", { task_id: taskId });
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
