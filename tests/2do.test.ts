import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  actionURL,
  actionValueError,
  applyGoal,
  CancelPrefs,
  cancelTask,
  completeParent,
  dateFields,
  GoalPrefs,
  hasStarted,
  isCancelled,
  repeatRule,
  saveTask,
  scopeArgs,
  tagOptions,
  Task,
  taskLinks,
  taskToValues,
  toDate,
  twoDo,
} from "../extension/src/2do";

const { runAppleScript } = vi.hoisted(() => ({ runAppleScript: vi.fn() }));
vi.mock("@raycast/utils", () => ({ runAppleScript }));
// Same check as Raycast's runtime: full-day dates carry exactly 1 millisecond.
vi.mock("@raycast/api", () => ({
  Form: { DatePicker: { isFullDay: (d?: Date | null) => !!d && d.getMilliseconds() === 1 } },
}));

const fullDay = (y: number, m: number, d: number) => new Date(y, m, d, 0, 0, 0, 1);

// The 2Do commands sent so far, as [command, args] with args decoded from JSON.
const sent = () => runAppleScript.mock.calls.map(([, [command, args]]) => [command, JSON.parse(args)]);

const task: Task = {
  task_id: "t1",
  title: "Call mom",
  notes: "about Sunday",
  list_id: "inbox",
  list_title: "Inbox",
  completed: false,
  starred: true,
  priority: "high",
  start_date: "2026-10-25",
  start_time: "12:00",
  due_date: "2026-10-25",
  tags: [{ tag_id: "tag1", title: "Family" }],
  task_type: "normal",
  action: { type: "none" },
  presentation: { is_overdue: false },
};

beforeEach(() => {
  runAppleScript.mockReset().mockResolvedValue("{}");
});

describe("twoDo", () => {
  it("runs the command as JXA with JSON arguments and parses the result", async () => {
    runAppleScript.mockResolvedValue('{"list":[{"list_id":"a"}]}');
    await expect(twoDo("list_lists", { include_archived: true })).resolves.toEqual({ list: [{ list_id: "a" }] });
    const [script, args, options] = runAppleScript.mock.calls[0];
    expect(script).toContain('Application("2Do")');
    expect(args).toEqual(["list_lists", '{"include_archived":true}']);
    expect(options).toEqual({ language: "JavaScript" });
  });

  it("says to update 2Do when its automation is missing, or to install it", async () => {
    runAppleScript.mockRejectedValue(new Error("Error: Error: Message not understood. (-1708)"));
    await expect(twoDo("query_tasks")).rejects.toThrow("Update 2Do to the latest version");
    runAppleScript.mockRejectedValue(new Error("Error: Application can't be found. (-2700)"));
    await expect(twoDo("query_tasks")).rejects.toThrow("2Do isn't installed");
  });

  it("passes 2Do errors through", async () => {
    runAppleScript.mockRejectedValue(new Error("not_found: Task 'x' was not found."));
    await expect(twoDo("get_task", { task_id: "x" })).rejects.toThrow("not_found");
  });
});

describe("dateFields", () => {
  it("sends date and time for a timed date", () => {
    expect(dateFields("due", new Date(2026, 9, 5, 9, 30), false)).toEqual({
      due_date: "2026-10-05",
      due_time: "09:30",
    });
  });

  it("sends only the date for a full-day pick", () => {
    expect(dateFields("start", fullDay(2026, 9, 5), false)).toEqual({ start_date: "2026-10-05" });
  });

  it("keeps a time of exactly midnight", () => {
    expect(dateFields("due", new Date(2026, 9, 5), false)).toEqual({ due_date: "2026-10-05", due_time: "00:00" });
  });

  it("omits empty dates when creating and clears them when editing", () => {
    expect(dateFields("due", null, false)).toEqual({});
    expect(dateFields("due", null, true)).toEqual({ due_date: null, due_time: null });
  });

  it("clears an old time when an edited date becomes full-day", () => {
    expect(dateFields("due", fullDay(2026, 9, 5), true)).toEqual({ due_date: "2026-10-05", due_time: null });
  });
});

describe("toDate", () => {
  it("round-trips 2Do dates through dateFields", () => {
    expect(toDate()).toBeNull();
    expect(dateFields("due", toDate("2026-10-25", "14:00"), false)).toEqual({
      due_date: "2026-10-25",
      due_time: "14:00",
    });
    expect(dateFields("due", toDate("2026-10-25"), false)).toEqual({ due_date: "2026-10-25" });
  });
});

describe("taskToValues", () => {
  it("keeps the goal and journal blocks out of the Notes field, but still reads the goal", () => {
    const notes = "Call first.\n\n@goal: 3 calls\n\nNovember 6, 2026: 1\n\n@endgoal\n\n@journal\n\n@endjournal";
    expect(taskToValues({ ...task, notes })).toMatchObject({
      notes: "Call first.",
      is_goal: true,
      goal_total: "3",
      goal_unit: "calls",
    });
  });
});

describe("saveTask", () => {
  const values = { ...taskToValues(task), notes: "", start: null, tag_ids: [] };

  it("creates a task, leaving out empty notes, dates, and tags", async () => {
    await saveTask(values);
    expect(sent()).toEqual([
      ["create_task", { title: "Call mom", priority: "high", starred: true, due_date: "2026-10-25", list_id: "inbox" }],
    ]);
  });

  it("sends tags when creating with tags", async () => {
    await saveTask({ ...values, tag_ids: ["tag1"] });
    expect(sent()[0][1].tag_update).toEqual({ operation: "set", tag_ids: ["tag1"] });
  });

  it("sets the action when creating, trimming its value", async () => {
    await saveTask({ ...values, action_type: "mail", action_value: " a@example.com " });
    expect(sent()[0][1].action).toEqual({ type: "mail", value: "a@example.com" });
  });

  it("updates a task, clearing removed fields", async () => {
    await saveTask(values, task);
    expect(sent()).toEqual([
      [
        "update_task",
        {
          task_id: "t1",
          title: "Call mom",
          priority: "high",
          starred: true,
          start_date: null,
          start_time: null,
          due_date: "2026-10-25",
          due_time: null,
          notes: "",
          tag_update: { operation: "set", tag_ids: [] },
        },
      ],
    ]);
  });

  it("keeps an unchanged task's values when editing", async () => {
    await saveTask(taskToValues(task), task);
    expect(sent()[0][1]).toMatchObject({
      start_date: "2026-10-25",
      start_time: "12:00",
      notes: "about Sunday",
      tag_update: { operation: "set", tag_ids: ["tag1"] },
    });
  });

  it("sets, changes, and clears the action only when it changed", async () => {
    const linked = { ...task, action: { type: "url", value: "https://a.test" } };
    await saveTask(taskToValues(linked), linked);
    expect(sent()[0][1]).not.toHaveProperty("action");
    await saveTask({ ...taskToValues(task), action_type: "call", action_value: "555-0100" }, task);
    expect(sent()[1][1].action).toEqual({ type: "call", value: "555-0100" });
    await saveTask({ ...taskToValues(linked), action_value: "https://b.test" }, linked);
    expect(sent()[2][1].action).toEqual({ type: "url", value: "https://b.test" });
    await saveTask({ ...taskToValues(linked), action_type: "none", action_value: undefined }, linked);
    expect(sent()[3][1].action).toEqual({ type: "none" });
  });

  it("leaves an unknown action type alone", async () => {
    const future = { ...task, action: { type: "shortcut", value: "Run" } };
    expect(taskToValues(future).action_type).toBeUndefined();
    await saveTask(taskToValues(future), future);
    expect(sent()[0][1]).not.toHaveProperty("action");
  });

  it("creates a task inside a project or checklist instead of the list", async () => {
    await saveTask({ ...values, parent_id: "p1" });
    expect(sent()[0][1]).toMatchObject({ parent_task_id: "p1" });
    expect(sent()[0][1]).not.toHaveProperty("list_id");
  });

  it("creates a project or checklist in the list, never inside another", async () => {
    await saveTask({ ...values, task_type: "checklist", parent_id: "p1" });
    expect(sent()[0][1]).toMatchObject({ task_type: "checklist", list_id: "inbox" });
    expect(sent()[0][1]).not.toHaveProperty("parent_task_id");
    runAppleScript.mockClear();
    await saveTask({ ...values, task_type: "normal" });
    expect(sent()[0][1]).not.toHaveProperty("task_type");
  });

  it("moves an edited task into a project or checklist, rather than to the list", async () => {
    await saveTask({ ...taskToValues(task), list_id: "work", parent_id: "p1" }, task);
    expect(sent().map(([command, args]) => [command, args.parent_task_id ?? args.list_id])).toEqual([
      ["update_task", undefined],
      ["move_task", "p1"],
    ]);
  });

  it("leaves an item in its project when the parent is unchanged, and moves it out or to another", async () => {
    await saveTask({ ...taskToValues(task), parent_id: "p1" }, task, "p1");
    expect(sent().map(([command]) => command)).toEqual(["update_task"]);
    runAppleScript.mockClear();
    await saveTask({ ...taskToValues(task), parent_id: "" }, task, "p1");
    expect(sent()[1]).toEqual(["move_task", { task_id: "t1", list_id: "inbox" }]);
    runAppleScript.mockClear();
    await saveTask({ ...taskToValues(task), parent_id: "p2" }, task, "p1");
    expect(sent()[1]).toEqual(["move_task", { task_id: "t1", parent_task_id: "p2" }]);
  });

  it("moves the task when its list changed", async () => {
    await saveTask({ ...values, list_id: "work" }, task);
    expect(sent().map(([command]) => command)).toEqual(["update_task", "move_task"]);
    expect(sent()[1][1]).toEqual({ task_id: "t1", list_id: "work" });
  });
});

describe("taskLinks", () => {
  it("puts the link action first, then links in the notes, without duplicates", () => {
    const notes = "See https://b.test/x and x-apple-health://Meds.\n- https://a.test\n(https://c.test/y)";
    expect(taskLinks({ ...task, notes, action: { type: "url", value: "https://a.test" } })).toEqual([
      "https://a.test",
      "https://b.test/x",
      "x-apple-health://Meds",
      "https://c.test/y",
    ]);
  });

  it("keeps balanced parentheses and finds no links in plain notes", () => {
    expect(taskLinks({ ...task, notes: "https://en.wikipedia.org/wiki/Foo_(bar)." })).toEqual([
      "https://en.wikipedia.org/wiki/Foo_(bar)",
    ]);
    expect(taskLinks(task)).toEqual([]);
  });
});

describe("actionURL", () => {
  it("builds the URL that runs each action type", () => {
    expect(actionURL({ type: "url", value: "https://a.test" })).toBe("https://a.test");
    expect(actionURL({ type: "call", value: "+1 (555) 010-0" })).toBe("tel:+15550100");
    expect(actionURL({ type: "message", value: "555-0100" })).toBe("sms:5550100");
    expect(actionURL({ type: "mail", value: "a@example.com" })).toBe("mailto:a@example.com");
    expect(actionURL({ type: "visit", value: "1 Main St, Town" })).toBe("maps://?q=1%20Main%20St%2C%20Town");
    expect(actionURL({ type: "google", value: "a&b" })).toBe("https://www.google.com/search?q=a%26b");
  });

  it("has nothing to run for no action or an unknown type", () => {
    expect(actionURL({ type: "none" })).toBeUndefined();
    expect(actionURL({ type: "shortcut", value: "Run" })).toBeUndefined();
  });
});

describe("actionValueError", () => {
  it("requires a value for every type but none, and a full link for url", () => {
    expect(actionValueError("none", "")).toBeUndefined();
    expect(actionValueError(undefined, "")).toBeUndefined();
    expect(actionValueError("call", "  ")).toBe("Required");
    expect(actionValueError("url", "example.com")).toMatch("full link");
    expect(actionValueError("url", "x-apple-health://Meds")).toBeUndefined();
    expect(actionValueError("google", "anything")).toBeUndefined();
  });
});

describe("hasStarted", () => {
  const at = new Date(2026, 10, 6, 15, 0);
  it("counts tasks without a start time, or with one that has passed, as started", () => {
    expect(hasStarted({ ...task, start_date: "2026-11-06", start_time: undefined }, at)).toBe(true);
    expect(hasStarted({ ...task, start_date: "2026-11-06", start_time: "15:00" }, at)).toBe(true);
    expect(hasStarted({ ...task, start_date: "2026-11-05", start_time: "20:00" }, at)).toBe(true);
  });

  it("leaves tasks starting later for Later Today", () => {
    expect(hasStarted({ ...task, start_date: "2026-11-06", start_time: "17:00" }, at)).toBe(false);
  });
});

describe("repeatRule", () => {
  const rule = (recurrence: Task["recurrence"]) => repeatRule({ ...task, recurrence });
  it("describes 2Do's repeat shapes in words", () => {
    expect(rule(null)).toBeUndefined();
    expect(rule({ frequency: "none" })).toBeUndefined();
    expect(rule({ frequency: "daily", based_on: "due_date", end_rule: { type: "never" } })).toBe("Daily");
    expect(rule({ frequency: "custom", interval: 3, unit: "day" })).toBe("Every 3 days");
    expect(rule({ frequency: "custom", interval: 1, unit: "week" })).toBe("Every week");
    expect(rule({ frequency: "weekly", weekdays: ["monday", "friday"] })).toBe("Weekly on Mon, Fri");
    expect(rule({ frequency: "monthly", weekday: "tuesday", ordinal: 2 })).toBe("Monthly on the 2nd Tue");
    expect(rule({ frequency: "monthly", weekday: "friday", ordinal: -1 })).toBe("Monthly on the last Fri");
    expect(rule({ frequency: "weekdays" })).toBe("On weekdays");
  });

  it("adds completion-based repeats and end rules", () => {
    expect(rule({ frequency: "weekly", based_on: "completion" })).toBe("Weekly, after completion");
    expect(rule({ frequency: "daily", end_rule: { type: "after_count", occurrence_count: 5 } })).toBe("Daily, 5 times");
    expect(rule({ frequency: "yearly", end_rule: { type: "on_date", date: "2027-01-01" } })).toBe(
      "Yearly, until 2027-01-01",
    );
  });
});

describe("cancelTask", () => {
  const prefs: CancelPrefs = { cancelBehavior: "complete-and-tag", cancelTag: "Cancelled", cancelList: "" };
  const repeating = { ...task, recurrence: { frequency: "daily" } };
  // A fake 2Do: completing a repeating task leaves it open and adds a completed copy, as 2Do does,
  // and search finds that copy (plus an older one from a previous day).
  beforeEach(() => {
    runAppleScript.mockImplementation(async (_script: string, [command, json]: string[]) => {
      const args = JSON.parse(json);
      if (command === "list_tags") return JSON.stringify({ tags: [{ tag_id: "c1", title: "Cancelled" }] });
      if (command === "list_lists") return JSON.stringify({ list: [{ list_id: "l9", title: "Graveyard" }] });
      if (command === "complete_task")
        return JSON.stringify({ task: { ...task, task_id: args.task_id, completed: !isRepeatingRun } });
      if (command === "query_tasks")
        return JSON.stringify({
          tasks: [
            { ...task, completed: false },
            { ...task, task_id: "old", completed: true, completion_date: "2026-11-05T10:00:00Z" },
            { ...task, task_id: "copy", completed: true, completion_date: "2026-11-06T10:00:00Z" },
          ],
        });
      return "{}";
    });
  });
  let isRepeatingRun = false;
  afterEach(() => {
    isRepeatingRun = false;
  });

  it("completes the task, then tags it", async () => {
    await cancelTask(task, prefs);
    expect(sent()).toEqual([
      ["list_tags", {}],
      ["complete_task", { task_id: "t1" }],
      ["update_task", { task_id: "t1", tag_update: { operation: "append", tag_ids: ["c1"] } }],
    ]);
  });

  it("tags only this occurrence's completed copy of a repeating task, leaving the next one clean", async () => {
    isRepeatingRun = true;
    await cancelTask(repeating, prefs);
    expect(sent().map(([command]) => command)).toEqual(["list_tags", "complete_task", "query_tasks", "update_task"]);
    expect(sent()[3][1]).toEqual({ task_id: "copy", tag_update: { operation: "append", tag_ids: ["c1"] } });
  });

  it("only tags with Tag Only, matching the tag title case-insensitively", async () => {
    await cancelTask(task, { ...prefs, cancelBehavior: "tag", cancelTag: " cancelled " });
    expect(sent().map(([command]) => command)).toEqual(["list_tags", "update_task"]);
  });

  it("completes, then moves the completed occurrence to the cancel list", async () => {
    await cancelTask(task, { ...prefs, cancelBehavior: "move", cancelList: "graveyard" });
    expect(sent()).toEqual([
      ["list_lists", {}],
      ["complete_task", { task_id: "t1" }],
      ["move_task", { task_id: "t1", list_id: "l9" }],
    ]);
    runAppleScript.mockClear();
    isRepeatingRun = true;
    await cancelTask(repeating, { ...prefs, cancelBehavior: "move", cancelList: "graveyard" });
    expect(sent().at(-1)).toEqual(["move_task", { task_id: "copy", list_id: "l9" }]);
  });

  it("deletes with Delete, or for a repeating task deletes only this occurrence", async () => {
    await cancelTask(task, { ...prefs, cancelBehavior: "delete" });
    expect(sent()).toEqual([["delete_task", { task_id: "t1" }]]);
    runAppleScript.mockClear();
    isRepeatingRun = true;
    await cancelTask(repeating, { ...prefs, cancelBehavior: "delete" });
    expect(sent().map(([command]) => command)).toEqual(["complete_task", "query_tasks", "delete_task"]);
    expect(sent().at(-1)).toEqual(["delete_task", { task_id: "copy" }]);
  });

  it("names the preference when the list is missing, without changing the task", async () => {
    await expect(cancelTask(task, { ...prefs, cancelBehavior: "move", cancelList: "Nope" })).rejects.toThrow(
      'No 2Do list named "Nope"',
    );
    await expect(cancelTask(task, { ...prefs, cancelBehavior: "move" })).rejects.toThrow(
      "Set the Cancel List preference",
    );
    expect(sent().map(([command]) => command)).toEqual(["list_lists"]);
  });

  it("asks for the cancel tag to be added or changed when it's missing, without changing the task", async () => {
    await expect(cancelTask(task, { ...prefs, cancelTag: "Dropped" })).rejects.toThrow(
      'No 2Do tag named "Dropped". Add it in 2Do, or set Cancel Tag in the extension\'s settings',
    );
    expect(sent().map(([command]) => command)).toEqual(["list_tags"]);
  });
});

describe("applyGoal", () => {
  const base = { ...taskToValues(task), notes: "Read it.", tag_ids: ["tag1"] };
  const prefs: GoalPrefs = { goalTag: "Goal", goalDateFormat: "MMMM d, yyyy" };
  beforeEach(() => {
    runAppleScript.mockResolvedValue(JSON.stringify({ tags: [{ tag_id: "g1", title: "Goal" }] }));
  });

  it("adds a goal block with Current on the Last Completed date, and the goal tag", async () => {
    const v = await applyGoal(
      {
        ...base,
        is_goal: true,
        goal_total: "32",
        goal_unit: " pages ",
        goal_current: "10",
        goal_last: new Date(2026, 10, 5),
      },
      prefs,
    );
    expect(v.notes).toBe("Read it.\n\n@goal: 32 pages\n\nNovember 5, 2026: 10\n\n@endgoal");
    expect(v.tag_ids).toEqual(["tag1", "g1"]);
  });

  it("writes dates in the preferred format", async () => {
    const v = await applyGoal(
      { ...base, is_goal: true, goal_total: "3", goal_current: "1", goal_last: new Date(2026, 10, 5) },
      { ...prefs, goalDateFormat: "yyyy-MM-dd" },
    );
    expect(v.notes).toContain("2026-11-05: 1");
  });

  it("starts with no entries when Current is empty or 0", async () => {
    const v = await applyGoal({ ...base, is_goal: true, goal_total: "5", goal_unit: "", goal_current: "0" }, prefs);
    expect(v.notes).toBe("Read it.\n\n@goal: 5\n\n@endgoal");
  });

  it("changes only the header of an existing goal, keeping entries as typed", async () => {
    const notes = "Before\n\n@goal: 10 pages\n\n2026-11-06 2 pm - 4\n\n@endgoal\n\nAfter";
    const v = await applyGoal({ ...base, notes, is_goal: true, goal_total: "12", goal_unit: "chapters" }, prefs);
    expect(v.notes).toBe("Before\n\n@goal: 12 chapters\n\n2026-11-06 2 pm - 4\n\n@endgoal\n\nAfter");
  });

  it("adds no tag when Goal Tag is empty, without looking it up", async () => {
    const v = await applyGoal({ ...base, is_goal: true, goal_total: "5", goal_current: "" }, { ...prefs, goalTag: "" });
    expect(v).toMatchObject({ notes: "Read it.\n\n@goal: 5\n\n@endgoal", tag_ids: ["tag1"] });
    expect(runAppleScript).not.toHaveBeenCalled();
  });

  it("fails when the goal tag doesn't exist in 2Do", async () => {
    await expect(
      applyGoal({ ...base, is_goal: true, goal_total: "5" }, { ...prefs, goalTag: "Targets" }),
    ).rejects.toThrow('No 2Do tag named "Targets". Create it in 2Do, or change or clear the Goal Tag preference.');
  });

  it("removes the block and the goal tag when unchecked", async () => {
    const notes = "Read it.\n\n@goal: 10\n\n@endgoal";
    const v = await applyGoal({ ...base, notes, tag_ids: ["tag1", "g1"], is_goal: false }, prefs);
    expect(v).toMatchObject({ notes: "Read it.", tag_ids: ["tag1"] });
  });

  it("leaves values alone when the goal fields weren't shown or nothing is a goal", async () => {
    expect(await applyGoal({ ...base, is_goal: undefined }, prefs)).toEqual({ ...base, is_goal: undefined });
    expect(await applyGoal({ ...base, is_goal: false }, prefs)).toEqual({ ...base, is_goal: false });
    expect(runAppleScript).not.toHaveBeenCalled();
  });
});

describe("completeParent", () => {
  const prefs: CancelPrefs = { cancelBehavior: "complete-and-tag", cancelTag: "Cancelled", cancelList: "" };
  const project = { ...task, task_id: "p1", task_type: "project" as const };
  beforeEach(() => {
    runAppleScript.mockImplementation(async (_script: string, [command, json]: string[]) => {
      const args = JSON.parse(json);
      if (command === "list_subtasks")
        return JSON.stringify({
          tasks: [
            { ...task, task_id: "i1", completed: false },
            { ...task, task_id: "i2", completed: true },
          ],
        });
      if (command === "list_tags") return JSON.stringify({ tags: [{ tag_id: "c1", title: "Cancelled" }] });
      if (command === "complete_task")
        return JSON.stringify({ task: { ...task, task_id: args.task_id, completed: true } });
      return "{}";
    });
  });

  it("completes the parent, which completes its items", async () => {
    await completeParent(project, false, prefs);
    expect(sent()).toEqual([["complete_task", { task_id: "p1" }]]);
  });

  it("cancels only the open items first, then completes the parent", async () => {
    await completeParent(project, true, prefs);
    expect(sent().map(([command, args]) => `${command}:${args.task_id ?? ""}`)).toEqual([
      "list_subtasks:p1",
      "list_tags:",
      "complete_task:i1",
      "update_task:i1",
      "complete_task:p1",
    ]);
  });
});

describe("isCancelled", () => {
  it("is a completed task carrying the cancel tag", () => {
    const prefs: CancelPrefs = { cancelBehavior: "complete-and-tag", cancelTag: "cancelled", cancelList: "" };
    const tagged = { ...task, tags: [{ tag_id: "c1", title: "Cancelled" }] };
    expect(isCancelled({ ...tagged, completed: true }, prefs)).toBe(true);
    expect(isCancelled(tagged, prefs)).toBe(false);
    expect(isCancelled({ ...task, completed: true }, prefs)).toBe(false);
  });
});

describe("scopeArgs", () => {
  it("maps dropdown values to query_tasks targets", () => {
    expect(scopeArgs("focus:today")).toEqual({ focus: "today", include_completed: false });
    expect(scopeArgs("focus:done")).toEqual({ focus: "done", include_completed: true });
    expect(scopeArgs("list:abc")).toEqual({ list_id: "abc", include_completed: false });
    expect(scopeArgs("smart-list:xyz")).toEqual({ smart_list_id: "xyz", include_completed: false });
  });
});

describe("tagOptions", () => {
  const all = [
    { tag_id: "tag1", title: "Family" },
    { tag_id: "tag2", title: "Work" },
  ];

  it("lists all tags when creating", () => {
    expect(tagOptions(all)).toEqual(all);
    expect(tagOptions(undefined)).toEqual([]);
  });

  it("adds the task's tags that 2Do's tag list leaves out, without duplicates", () => {
    const hidden = { tag_id: "tag3", title: "Marketing" };
    expect(tagOptions(all, { ...task, tags: [all[0], hidden] })).toEqual([...all, hidden]);
  });

  it("offers the task's tags before the tag list has loaded", () => {
    expect(tagOptions(undefined, task)).toEqual(task.tags);
  });
});
