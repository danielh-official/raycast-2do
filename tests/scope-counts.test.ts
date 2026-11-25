import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectMatchingTasks,
  countNowAndLaterToday,
  countPausedTags,
  countScope,
  loadScopeCounts,
  loadScopeTasks,
  mapPool,
  titleWithCount,
} from "../extension/src/scope-counts";
import type { Task } from "../extension/src/2do";

const { runAppleScript } = vi.hoisted(() => ({ runAppleScript: vi.fn() }));
vi.mock("@raycast/utils", () => ({ runAppleScript }));
vi.mock("@raycast/api", () => ({
  Form: { DatePicker: { isFullDay: (d?: Date | null) => !!d && d.getMilliseconds() === 1 } },
}));

const sent = () => runAppleScript.mock.calls.map(([, [command, args]]) => [command, JSON.parse(args)]);

const task = (over: Partial<Task> & Pick<Task, "task_id">): Task => ({
  title: over.task_id,
  notes: "",
  list_id: "inbox",
  list_title: "Inbox",
  completed: false,
  starred: false,
  priority: "none",
  tags: [],
  task_type: "normal",
  action: { type: "none" },
  presentation: { is_overdue: false },
  ...over,
});

beforeEach(() => {
  runAppleScript.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("titleWithCount", () => {
  it("adds the count when known", () => {
    expect(titleWithCount("Today", 2)).toBe("Today (2)");
    expect(titleWithCount("Today")).toBe("Today");
    expect(titleWithCount("Today", 0)).toBe("Today (0)");
  });
});

describe("mapPool", () => {
  it("limits how many jobs run at once", async () => {
    let active = 0;
    let maxActive = 0;
    const items = [1, 2, 3, 4, 5];
    await mapPool(items, 2, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active--;
    });
    expect(maxActive).toBe(2);
  });
});

describe("countScope", () => {
  it("reads total_count with limit 1 so the display cap does not apply", async () => {
    runAppleScript.mockResolvedValue(JSON.stringify({ tasks: [], item_count: 0, total_count: 42 }));
    await expect(countScope("focus:today")).resolves.toBe(42);
    expect(sent()).toEqual([["query_tasks", { focus: "today", include_completed: false, limit: 1 }]]);
  });

  it("counts Done with include_completed", async () => {
    runAppleScript.mockResolvedValue(JSON.stringify({ tasks: [], item_count: 0, total_count: 7 }));
    await expect(countScope("focus:done")).resolves.toBe(7);
    expect(sent()[0][1]).toMatchObject({ focus: "done", include_completed: true, limit: 1 });
  });
});

describe("countNowAndLaterToday", () => {
  it("splits Today's full set with hasStarted, paging past the display limit", async () => {
    const at = new Date(2026, 10, 6, 15, 0);
    runAppleScript
      .mockResolvedValueOnce(
        JSON.stringify({
          tasks: [
            task({ task_id: "started", start_date: "2026-11-06", start_time: "10:00" }),
            task({ task_id: "later", start_date: "2026-11-06", start_time: "17:00" }),
          ],
          item_count: 2,
          total_count: 3,
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          tasks: [task({ task_id: "all-day", start_date: "2026-11-06" })],
          item_count: 1,
          total_count: 3,
        }),
      );
    await expect(countNowAndLaterToday(at)).resolves.toEqual({
      now: 2,
      later: 1,
      nextStart: new Date("2026-11-06T17:00"),
    });
    expect(sent()).toEqual([
      ["query_tasks", { focus: "today", include_completed: false, limit: 200, offset: 0 }],
      ["query_tasks", { focus: "today", include_completed: false, limit: 200, offset: 2 }],
    ]);
  });
});

describe("countPausedTags", () => {
  it("counts each paused tag across the full paused-only set", async () => {
    runAppleScript.mockResolvedValue(
      JSON.stringify({
        tasks: [
          task({ task_id: "a", tags: [{ tag_id: "someday", title: "Someday" }] }),
          task({
            task_id: "b",
            tags: [
              { tag_id: "someday", title: "Someday" },
              { tag_id: "blocked", title: "Blocked" },
            ],
          }),
          task({ task_id: "c", tags: [{ tag_id: "other", title: "Other" }] }),
        ],
        item_count: 3,
        total_count: 3,
      }),
    );
    await expect(countPausedTags(["someday", "blocked"])).resolves.toEqual({ someday: 2, blocked: 1 });
  });
});

describe("collectMatchingTasks", () => {
  it("pages past non-matches until the display limit is filled", async () => {
    runAppleScript
      .mockResolvedValueOnce(
        JSON.stringify({
          tasks: [
            task({ task_id: "other", tags: [{ tag_id: "someday", title: "Someday" }] }),
            task({ task_id: "blocked-1", tags: [{ tag_id: "blocked", title: "Blocked" }] }),
          ],
          item_count: 2,
          total_count: 3,
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          tasks: [task({ task_id: "blocked-2", tags: [{ tag_id: "blocked", title: "Blocked" }] })],
          item_count: 1,
          total_count: 3,
        }),
      );
    const matched = await collectMatchingTasks(
      { focus: "all", include_completed: false, paused_filter: "only" },
      (t) => t.tags.some((tag) => tag.tag_id === "blocked"),
      2,
    );
    expect(matched.map((t) => t.task_id)).toEqual(["blocked-1", "blocked-2"]);
    expect(sent()).toHaveLength(2);
  });
});

describe("loadScopeTasks", () => {
  it("loads a direct scope with one capped query", async () => {
    runAppleScript.mockResolvedValue(
      JSON.stringify({ tasks: [task({ task_id: "t1" })], item_count: 1, total_count: 1 }),
    );
    await expect(loadScopeTasks("focus:starred")).resolves.toEqual([expect.objectContaining({ task_id: "t1" })]);
    expect(sent()[0][1]).toMatchObject({ focus: "starred", include_completed: false, limit: 200 });
  });
});

describe("loadScopeCounts", () => {
  it("loads simple scopes, Today split, and paused tags together", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6, 15, 0));
    runAppleScript.mockImplementation(async (_script: string, [command, json]: string[]) => {
      const args = JSON.parse(json);
      if (command !== "query_tasks") return "{}";
      if (args.focus === "today" && args.limit === 200) {
        return JSON.stringify({
          tasks: [
            task({ task_id: "n", start_date: "2026-11-06" }),
            task({ task_id: "l", start_date: "2026-11-06", start_time: "23:00" }),
          ],
          item_count: 2,
          total_count: 2,
        });
      }
      if (args.paused_filter === "only" && args.limit === 200) {
        return JSON.stringify({
          tasks: [task({ task_id: "p", tags: [{ tag_id: "someday", title: "Someday" }] })],
          item_count: 1,
          total_count: 1,
        });
      }
      return JSON.stringify({ tasks: [], item_count: 0, total_count: args.focus === "starred" ? 5 : 9 });
    });
    const { counts, nextStart } = await loadScopeCounts([
      "focus:starred",
      "focus:now",
      "focus:later-today",
      "paused-tag:someday",
      "list:inbox",
    ]);
    expect(counts["focus:starred"]).toBe(5);
    expect(counts["focus:now"]).toBe(1);
    expect(counts["focus:later-today"]).toBe(1);
    expect(counts["paused-tag:someday"]).toBe(1);
    expect(counts["list:inbox"]).toBe(9);
    expect(nextStart).toEqual(new Date("2026-11-06T23:00"));
  });

  it("keeps other counts when one scope fails", async () => {
    runAppleScript.mockImplementation(async (_script: string, [, json]: string[]) => {
      const args = JSON.parse(json);
      if (args.focus === "starred") throw new Error("boom");
      return JSON.stringify({ tasks: [], item_count: 0, total_count: 3 });
    });
    const { counts } = await loadScopeCounts(["focus:starred", "focus:all"]);
    expect(counts["focus:starred"]).toBeUndefined();
    expect(counts["focus:all"]).toBe(3);
  });
});
