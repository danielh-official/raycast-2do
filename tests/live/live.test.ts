// Live tests: run the extension's real code against 2Do itself, to check that what the extension
// assumes about 2Do still holds in the latest version. They change tasks in the "Live Testing" list, so
// they're never part of `npm test`; run them now and then with `npm run test:live`, which clears and
// re-seeds that list first (live/clear.js, live/seed.js). Raycast's APIs are stubbed, and
// AppleScript goes straight to osascript.
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("@raycast/api", () => ({
  Form: { DatePicker: { isFullDay: (d?: Date | null) => !!d && d.getMilliseconds() === 1 } },
}));
vi.mock("@raycast/utils", () => ({
  runAppleScript: async (script: string, args: string[]) =>
    execFileSync("osascript", ["-l", "JavaScript", "-e", script, ...args], { encoding: "utf8" }).trim(),
}));
import {
  actionURL,
  applyGoal,
  cancelTask,
  completeGoalTask,
  completeParent,
  hasStarted,
  isRepeating,
  listParents,
  saveTask,
  Task,
  taskLinks,
  taskToValues,
  twoDo,
  ymd,
} from "../../extension/src/2do";
import { goalProgress, logProgress, parseGoal } from "../../extension/src/goal";
import { addJournalEntry, parseJournal } from "../../extension/src/journal";
import { checkNotes, fixNotes, joinNotes, splitNotes } from "../../extension/src/notes";

const today = ymd(new Date());
let listId = "";
const all = async () =>
  (
    await twoDo<{ tasks: Task[] }>("query_tasks", {
      list_id: listId,
      include_completed: true,
      paused_filter: "include",
      limit: 200,
    })
  ).tasks;
const find = async (start: string) => {
  const t = (await all()).find((x) => x.title.startsWith(start) && !x.completed);
  if (!t) throw new Error(`No open live-test task starting "${start}"`);
  return t;
};
const fresh = async (id: string) => (await twoDo<{ task: Task }>("get_task", { task_id: id })).task;
// Same steps as TaskForm's submit: the Notes field holds the text only; the blocks are re-read and joined.
async function editSave(task: Task, change: (v: ReturnType<typeof taskToValues>) => ReturnType<typeof taskToValues>) {
  const v = change(taskToValues(task));
  const current = await fresh(task.task_id);
  const blocks = splitNotes(current.notes).blocks;
  const full = { ...v, notes: joinNotes(v.notes ?? "", blocks) };
  await saveTask(await applyGoal(full, { goalTag: "", goalDateFormat: "MMMM d, yyyy" }), current);
  return fresh(task.task_id);
}

beforeAll(async () => {
  const { list } = await twoDo<{ list: { list_id: string; title: string }[] }>("list_lists");
  const live = list.find((l) => l.title === "Live Testing");
  if (!live) throw new Error('No 2Do list named "Live Testing". Create it in 2Do, then run `npm run test:live`.');
  listId = live.list_id;
});

describe("reading the live-test tasks", () => {
  it("parses goals, including mixed formats, times, and dotted and slash dates", async () => {
    const progress = async (start: string) => {
      const t = await find(start);
      const g = parseGoal(t.notes, false)!;
      return { ...goalProgress(g, today), total: g.total, unit: g.unit };
    };
    expect(await progress("Read Designing")).toEqual({ done: 21, today: 8, total: 32, unit: "pages" });
    expect(await progress("Drink water")).toEqual({ done: 8, today: 8, total: 8, unit: "glasses" });
    expect(await progress("Learn the guitar")).toEqual({ done: 0, today: 0, total: 10, unit: "chords" });
    expect(await progress("Daily push-ups")).toEqual({ done: 20, today: 0, total: 50, unit: "push-ups" });
    expect(await progress("Run 20 km")).toEqual({ done: 8, today: 3, total: 20, unit: "km" });
    expect(await progress("Two goal blocks")).toEqual({ done: 1, today: 1, total: 5, unit: "pages" });
  });

  it("parses journals and finds links and actions", async () => {
    const insurance = await find("Insurance claim");
    expect(parseJournal(insurance.notes, false)?.map((e) => e.text.split("\n")[0])).toEqual([
      "Called the adjuster, went to voicemail",
      "Called again, discussed the policy.",
      "Emailed the claim form",
    ]);
    expect(taskLinks(await find("Compare standing desks"))).toEqual([
      "https://www.example.com/desk-a",
      "https://www.example.com/desk-b",
      "https://en.wikipedia.org/wiki/Desk_(furniture)",
    ]);
    expect(taskLinks(await find("Plan the trip"))).toEqual([
      "https://www.example.com/itinerary",
      "https://www.example.com/hotel",
    ]);
    expect(actionURL((await find("Call the dentist")).action)).toBe("tel:+15550100");
    expect(actionURL((await find("Visit the library")).action)).toBe("maps://?q=1%20Infinite%20Loop%2C%20Cupertino");
  });

  it("flags broken syntax and nothing on well-formed notes", async () => {
    const issues = async (start: string) =>
      checkNotes((await find(start)).notes, false).map((i) => `${i.fixable ? "fixable" : "warning"}: ${i.message}`);
    expect(await issues("Broken: goal without")).toEqual([expect.stringMatching(/^fixable: The goal has no @endgoal/)]);
    expect(await issues("Broken: @goal without")).toEqual([expect.stringMatching(/^warning: .*needs a total/)]);
    expect(await issues("Broken: unreadable")).toEqual([expect.stringMatching(/^warning: A line .* -1"/)]);
    expect(await issues("Broken: journal without")).toEqual([expect.stringMatching(/^fixable: The journal has no/)]);
    expect(await issues("Broken: text before")).toEqual([expect.stringMatching(/^warning: .*"stray note"/)]);
    for (const ok of ["Read Designing", "Insurance claim", "Learn Spanish", "Two goal blocks", "Reply to Sam"])
      expect(await issues(ok)).toEqual([]);
  });

  it("splits Now from Later Today, finds repeating and paused tasks, and project and checklist items", async () => {
    expect(hasStarted(await find("Take vitamins"))).toBe(true);
    expect(hasStarted(await find("Evening walk"))).toBe(false);
    expect(isRepeating(await find("Water the plants"))).toBe(true);
    expect(isRepeating(await find("Reply to Sam"))).toBe(false);
    const paused = await twoDo<{ tasks: Task[] }>("query_tasks", {
      list_id: listId,
      include_completed: false,
      paused_filter: "only",
    });
    expect(paused.tasks.map((t) => t.title)).toEqual(["Learn the cello (paused: Someday)"]);
    const items = async (start: string) => {
      const { tasks } = await twoDo<{ tasks: Task[] }>("list_subtasks", { task_id: (await find(start)).task_id });
      return `${tasks.filter((t) => t.completed).length}/${tasks.length}`;
    };
    expect(await items("Plan the team offsite")).toBe("1/3");
    expect(await items("Pack for the trip")).toBe("2/4");
  });
});

describe("writing to the live-test tasks", () => {
  it("leaves notes, action, and tags unchanged when Edit Task saves with no changes", async () => {
    for (const start of ["Learn Spanish", "Insurance claim", "Plan the trip", "Reply to Sam", "Broken: goal without"]) {
      const before = await find(start);
      const after = await editSave(before, (v) => v);
      expect({ start, notes: after.notes, action: after.action, tags: after.tags }).toEqual({
        start,
        notes: before.notes,
        action: before.action,
        tags: before.tags,
      });
    }
  });

  it("keeps the goal and journal when the Notes field text is edited", async () => {
    const before = await find("Learn Spanish");
    const after = await editSave(before, (v) => ({ ...v, notes: "Duolingo plus a tutor, twice a week." }));
    expect(after.notes).toBe(before.notes.replace("Duolingo plus a tutor.", "Duolingo plus a tutor, twice a week."));
  });

  it("changes, clears, and restores an action", async () => {
    const t = await find("Call the dentist");
    expect((await editSave(t, (v) => ({ ...v, action_type: "message" }))).action).toEqual({
      type: "message",
      value: "+1 555 0100",
    });
    expect((await editSave(t, (v) => ({ ...v, action_type: "none", action_value: undefined }))).action).toEqual({
      type: "none",
    });
    expect((await editSave(t, (v) => ({ ...v, action_type: "call", action_value: "+1 555 0100" }))).action).toEqual({
      type: "call",
      value: "+1 555 0100",
    });
  });

  it("makes a goal with Current on Last Completed, edits it, and removes it", async () => {
    const t = await find("Reply to Sam");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const made = await editSave(t, (v) => ({
      ...v,
      is_goal: true,
      goal_total: "5",
      goal_unit: "emails",
      goal_current: "2",
      goal_last: yesterday,
    }));
    expect(made.notes).toMatch(/^@goal: 5 emails\n\n\w+ \d+, \d{4}: 2\n\n@endgoal$/);
    expect(made.tags).toEqual(t.tags);
    const edited = await editSave(made, (v) => ({ ...v, goal_total: "6", goal_unit: "replies" }));
    expect(edited.notes).toBe(made.notes.replace("@goal: 5 emails", "@goal: 6 replies"));
    const removed = await editSave(edited, (v) => ({ ...v, is_goal: false }));
    expect(removed.notes).toBe(t.notes);
  });

  it("fails cleanly when the Goal Tag doesn't exist", async () => {
    const t = await find("Learn the guitar");
    await expect(
      applyGoal(
        { ...taskToValues(t), is_goal: true, goal_total: "10" },
        { goalTag: "NoSuchLiveTestTag", goalDateFormat: "MMMM d, yyyy" },
      ),
    ).rejects.toThrow('No 2Do tag named "NoSuchLiveTestTag"');
  });

  it("lists a list's projects and checklists, and puts tasks into them on create and edit", async () => {
    const parents = await listParents(listId);
    expect(parents.map((p) => p.title).sort()).toEqual([
      "Pack for the trip (checklist)",
      "Plan the team offsite (project)",
    ]);
    const project = parents.find((p) => p.task_type === "project")!;
    const checklist = parents.find((p) => p.task_type === "checklist")!;
    const items = async (id: string) =>
      (await twoDo<{ tasks: Task[] }>("list_subtasks", { task_id: id })).tasks.map((t) => t.title);

    const reply = await find("Reply to Sam");
    await saveTask({ ...taskToValues(reply), title: "Order the catering", notes: "", parent_id: project.task_id });
    expect(await items(project.task_id)).toContain("Order the catering");

    // Moving gives the task a new ID, so this checks the checklist's items rather than re-reading it.
    const desks = await find("Compare standing desks");
    await saveTask({ ...taskToValues(desks), parent_id: checklist.task_id }, desks);
    expect(await items(checklist.task_id)).toContain(desks.title);
    expect((await all()).some((t) => t.title === desks.title)).toBe(false);
  });

  it("adds an item to a checklist the way Add Item submits it (no list or dates)", async () => {
    const checklist = (await listParents(listId)).find((p) => p.task_type === "checklist")!;
    await saveTask({
      title: "Sunglasses",
      notes: "",
      list_id: "",
      start: null,
      due: null,
      priority: "none",
      starred: false,
      tag_ids: [],
      action_type: "none",
      parent_id: checklist.task_id,
    });
    const items = (await twoDo<{ tasks: Task[] }>("list_subtasks", { task_id: checklist.task_id })).tasks;
    expect(items.map((t) => t.title)).toContain("Sunglasses");
  });

  it("completes a repeating goal, logging what's left, with a fresh next occurrence", async () => {
    const pushups = await find("Daily push-ups");
    await completeGoalTask(
      pushups,
      { logRemaining: true, fresh: true },
      { goalDateFormat: "MMMM d, yyyy", dayFirst: false },
    );
    const copies = (await all()).filter((t) => t.title === pushups.title);
    const done = copies.find((t) => t.completed)!;
    const next = copies.find((t) => !t.completed)!;
    expect(goalProgress(parseGoal(done.notes, false)!, today).done).toBe(50);
    expect(parseGoal(next.notes, false)).toMatchObject({ total: 50, unit: "push-ups", entries: [] });
  });

  it("completes a project and cancels only its open items", async () => {
    const project = await find("Plan the team offsite");
    const before = (await twoDo<{ tasks: Task[] }>("list_subtasks", { task_id: project.task_id })).tasks;
    await completeParent(project, true, { cancelBehavior: "complete-and-tag", cancelTag: "Cancelled", cancelList: "" });
    expect((await fresh(project.task_id)).completed).toBe(true);
    const after = (await twoDo<{ tasks: Task[] }>("list_subtasks", { task_id: project.task_id })).tasks;
    for (const item of after) {
      const wasOpen = !before.find((b) => b.task_id === item.task_id)?.completed;
      expect([item.title, item.completed, item.tags.some((x) => x.title === "Cancelled")]).toEqual([
        item.title,
        true,
        wasOpen,
      ]);
    }
  });

  it("logs progress into the day's date-only line, leaving timed lines alone", async () => {
    for (const [start, amount] of [
      ["Read Designing", 2],
      ["Learn the guitar", 1],
      ["Drink water", 1],
    ] as const) {
      const t = await find(start);
      const before = goalProgress(parseGoal(t.notes, false)!, today);
      await twoDo("update_task", {
        task_id: t.task_id,
        notes: logProgress(t.notes, today, amount, "MMMM d, yyyy", false),
      });
      const after = await fresh(t.task_id);
      expect(goalProgress(parseGoal(after.notes, false)!, today)).toEqual({
        done: before.done + amount,
        today: before.today + amount,
      });
      if (start === "Read Designing") expect(after.notes).toContain(" 7:30 am - 2");
    }
  });

  it("adds journal entries in time order, one-line and multi-line", async () => {
    const t = await find("Insurance claim");
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(10, 0, 0, 0);
    let notes = addJournalEntry(t.notes, new Date(), true, "Adjuster called back", "MMMM d, yyyy", false);
    notes = addJournalEntry(notes, twoDaysAgo, true, "Found the receipt\nScanned it too", "MMMM d, yyyy", false);
    await twoDo("update_task", { task_id: t.task_id, notes });
    const entries = parseJournal((await fresh(t.task_id)).notes, false)!;
    expect(entries.map((e) => e.text.split("\n")[0])).toEqual([
      "Adjuster called back",
      "Called the adjuster, went to voicemail",
      "Called again, discussed the policy.",
      "Found the receipt",
      "Emailed the claim form",
    ]);
  });

  it("fixes broken syntax so trailing text becomes notes again", async () => {
    for (const start of ["Broken: goal without", "Broken: journal without"]) {
      const t = await find(start);
      await twoDo("update_task", { task_id: t.task_id, notes: fixNotes(t.notes, false) });
      const after = await fresh(t.task_id);
      expect(checkNotes(after.notes, false)).toEqual([]);
      expect(splitNotes(after.notes).text).toMatch(/^(Call the library about the next book\.|Address: 1 Main St)$/);
    }
  });

  it("cancels: completes and tags, only this occurrence of a repeating task, and fails on a missing tag", async () => {
    const prefs = { cancelBehavior: "complete-and-tag" as const, cancelTag: "Cancelled", cancelList: "" };
    await expect(
      cancelTask(await find("Cancel me (normal)"), { ...prefs, cancelTag: "NoSuchLiveTestTag" }),
    ).rejects.toThrow('No 2Do tag named "NoSuchLiveTestTag"');
    const normal = await find("Cancel me (normal)");
    expect(normal.completed).toBe(false);
    await cancelTask(normal, prefs);
    const n = await fresh(normal.task_id);
    expect([n.completed, n.tags.map((x) => x.title)]).toEqual([true, ["Cancelled"]]);

    const repeating = await find("Cancel me (repeats daily)");
    await cancelTask(repeating, prefs);
    const tasks = (await all()).filter((x) => x.title === repeating.title);
    expect(tasks.find((x) => !x.completed)?.tags).toEqual([]);
    expect(tasks.find((x) => x.completed)?.tags.map((x) => x.title)).toEqual(["Cancelled"]);
  });

  it("moves and deletes only the completed occurrence of a repeating task", async () => {
    const water = await find("Water the plants");
    await cancelTask(water, { cancelBehavior: "move", cancelTag: "Cancelled", cancelList: "Inbox" });
    expect((await fresh(water.task_id)).list_title).toBe("Live Testing");
    const moved = (
      await twoDo<{ tasks: Task[] }>("query_tasks", {
        search: water.title,
        include_completed: true,
        paused_filter: "include",
      })
    ).tasks.find((x) => x.title === water.title && x.completed && x.list_title === "Inbox");
    expect(moved).toBeDefined();
    await twoDo("move_task", { task_id: moved!.task_id, list_id: listId });

    const created = await twoDo<{ task: Task }>("create_task", {
      title: "Skip me (repeats daily)",
      list_id: listId,
      due_date: today,
      recurrence: { frequency: "daily", based_on: "due_date" },
    });
    await cancelTask(created.task, { cancelBehavior: "delete", cancelTag: "Cancelled", cancelList: "" });
    const left = (await all()).filter((x) => x.title === "Skip me (repeats daily)");
    expect(left.map((x) => [x.completed, x.due_date === today])).toEqual([[false, false]]);
  });
});
