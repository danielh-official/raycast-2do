import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  invalidateSmartLists,
  loadSmartLists,
} from "../extension/src/smart-lists";

const { stored, runAppleScript } = vi.hoisted(() => ({
  stored: new Map<string, string>(),
  runAppleScript: vi.fn(),
}));
vi.mock("@raycast/utils", async () => ({
  // Use the ESM build so Vitest can mock Raycast's runtime API imports.
  ...await import("../extension/node_modules/@raycast/utils/dist/module.js"),
  runAppleScript,
}));
vi.mock("@raycast/api", () => ({
  Cache: class {
    get(key: string) {
      return stored.get(key);
    }
    set(key: string, value: string) {
      stored.set(key, value);
    }
    clear() {
      stored.clear();
    }
  },
}));

const lists = [
  { smart_list_id: "s1", collection_id: "smart-list:s1", title: "Work" },
];
const now = 1_800_000_000_000;

beforeEach(() => {
  stored.clear();
  vi.spyOn(Date, "now").mockReturnValue(now);
  runAppleScript
    .mockReset()
    .mockResolvedValue(JSON.stringify({ smart_lists: lists }));
});

describe("smart-list catalog cache", () => {
  it("loads the catalog once and reuses it within ten minutes", async () => {
    expect(await loadSmartLists()).toEqual(lists);
    vi.mocked(Date.now).mockReturnValue(now + 10 * 60_000 - 1);
    expect(await loadSmartLists()).toEqual(lists);
    expect(runAppleScript).toHaveBeenCalledTimes(1);
    expect(runAppleScript.mock.calls[0][1]).toEqual(["list_smart_lists", "{}"]);
  });

  it("refreshes after ten minutes and replaces the cached catalog", async () => {
    await loadSmartLists();
    vi.mocked(Date.now).mockReturnValue(now + 10 * 60_000 + 1);
    runAppleScript.mockResolvedValue(JSON.stringify({ smart_lists: [] }));
    expect(await loadSmartLists()).toEqual([]);
    expect(await loadSmartLists()).toEqual([]);
    expect(runAppleScript).toHaveBeenCalledTimes(2);
  });

  it("invalidates after task actions even while the catalog is fresh", async () => {
    await loadSmartLists();
    invalidateSmartLists();
    runAppleScript.mockResolvedValue(JSON.stringify({ smart_lists: [] }));
    expect(await loadSmartLists()).toEqual([]);
    expect(runAppleScript).toHaveBeenCalledTimes(2);
  });

  it.each([
    "{broken",
    "null",
    JSON.stringify({ timestamp: now, data: [{}] }),
    JSON.stringify({ timestamp: now, data: null }),
    JSON.stringify({ timestamp: now, data: [{ ...lists[0], title: 1 }] }),
  ])("recovers from invalid cached data: %s", async (value) => {
    await loadSmartLists();
    const key = [...stored.keys()][0];
    stored.set(key, value);
    runAppleScript.mockClear();
    expect(await loadSmartLists()).toEqual(lists);
    expect(runAppleScript).toHaveBeenCalledTimes(1);
  });

  it("does not cache query failures, allowing a retry", async () => {
    runAppleScript.mockRejectedValueOnce(new Error("2Do unavailable"));
    await expect(loadSmartLists()).rejects.toThrow("2Do unavailable");
    expect(stored.size).toBe(0);
    expect(await loadSmartLists()).toEqual(lists);
    expect(runAppleScript).toHaveBeenCalledTimes(2);
  });
});
