import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  actionURL,
  actionValueError,
  CancelPrefs,
  cancelTask,
  dateFields,
  isCancelled,
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

describe("cancelTask", () => {
  const prefs: CancelPrefs = { cancelBehavior: "complete-and-tag", cancelTag: "Cancelled", cancelList: "" };
  // Answers list_tags, list_lists, and move_task; everything else gets "{}".
  beforeEach(() => {
    runAppleScript.mockImplementation(async (_script: string, [command]: string[]) => {
      if (command === "list_tags") return JSON.stringify({ tags: [{ tag_id: "c1", title: "Cancelled" }] });
      if (command === "list_lists") return JSON.stringify({ list: [{ list_id: "l9", title: "Graveyard" }] });
      if (command === "move_task") return JSON.stringify({ task: { task_id: "t1-moved" } });
      return "{}";
    });
  });

  it("appends the cancel tag, then completes the task", async () => {
    await cancelTask(task, prefs);
    expect(sent()).toEqual([
      ["list_tags", {}],
      ["update_task", { task_id: "t1", tag_update: { operation: "append", tag_ids: ["c1"] } }],
      ["complete_task", { task_id: "t1" }],
    ]);
  });

  it("only tags with Tag Only, matching the tag title case-insensitively", async () => {
    await cancelTask(task, { ...prefs, cancelBehavior: "tag", cancelTag: " cancelled " });
    expect(sent().map(([command]) => command)).toEqual(["list_tags", "update_task"]);
  });

  it("moves to the cancel list, then completes the task under its new ID", async () => {
    await cancelTask(task, { ...prefs, cancelBehavior: "move", cancelList: "graveyard" });
    expect(sent()).toEqual([
      ["list_lists", {}],
      ["move_task", { task_id: "t1", list_id: "l9" }],
      ["complete_task", { task_id: "t1-moved" }],
    ]);
  });

  it("deletes with Delete", async () => {
    await cancelTask(task, { ...prefs, cancelBehavior: "delete" });
    expect(sent()).toEqual([["delete_task", { task_id: "t1" }]]);
  });

  it("names the preference when the tag or list is missing, without changing the task", async () => {
    await expect(cancelTask(task, { ...prefs, cancelTag: "Dropped" })).rejects.toThrow(
      'No 2Do tag named "Dropped". Create it in 2Do or check the Cancel Tag preference.',
    );
    await expect(cancelTask(task, { ...prefs, cancelBehavior: "move", cancelList: "Nope" })).rejects.toThrow(
      'No 2Do list named "Nope"',
    );
    await expect(cancelTask(task, { ...prefs, cancelBehavior: "move" })).rejects.toThrow(
      "Set the Cancel List preference",
    );
    expect(sent().map(([command]) => command)).toEqual(["list_tags", "list_lists"]);
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
