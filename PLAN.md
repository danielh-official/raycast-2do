# Plan

Five features for the 2Do Raycast extension:

1. Add a link
2. Bulk add links
3. Cancel a task**,** with a preference for what cancelling does
4. Track goal progress on a task, driven by syntax in the notes, with a history of each bit of progress
5. Add dated notes to a task, driven by syntax in the notes

Ship them in that order, one commit (or PR) per feature. Each feature lands with its tests, a README section, and a CHANGELOG line.

## What 2Do gives us

The Automation Suite was checked against 2Do 2026.4.3 with read-only calls and calls that used a fake `task_id`.

- **Links are task actions.** A task has `action: { type: "none" }` or `action: { type: "url", value: "https://…" }`. 2Do shows the URL as the task's "Visit website" action. `create_task` accepts `action`, and `update_task_action` takes `{ task_id, action }`. Other action types exist (call, email, and so on), and the extension must not overwrite them by accident.
- **There's no batch create.** Bulk adding means one `create_task` call per link.
- **Cancelled tasks are completed tasks with a "Cancelled" tag.** That's 2Do's convention, and 18 tasks in the current database follow it. `complete_task` on a project or checklist also completes its subtasks (`recursive` defaults to true).
- **The automation can't create tags.** The suite has `list_tags` but no `create_tag`. If the cancel tag doesn't exist, the extension has to say so instead of creating it.
- **Notes are plain text.** Whatever syntax we use has to read well in 2Do on Mac and iOS, because the 2Do app won't render or understand it.

## Code layout

- `extension/src/2do.ts`: 2Do calls and task logic (exists).
- `extension/src/notes.ts` (new): pure functions that parse and rewrite the progress and dated-note syntax. They don't call 2Do, so they're easy to unit test.
- `tests/2do.test.ts` (exists) and `tests/notes.test.ts` (new).
- Pull a `ymd(date)` helper (local `yyyy-MM-dd`) out of `dateFields` so the notes code formats dates the same way.

**Read-modify-write rule.** Any action that edits notes (log progress, add a dated note) calls `get_task` first and writes back from that fresh copy, not from the list's cached data. That way an edit made in 2Do since the list loaded isn't lost.

---

## 1. Add a link

**Goal:** a task can carry a URL, set from Raycast, that opens from Raycast.

- Add a `link` field to `TaskValues`, read from `task.action` when `type === "url"`.
- `TaskForm`: add a **Link** text field below Notes, validated as a URL when it's not empty.
- `saveTask`:
  - Create: include `action: { type: "url", value }` when a link is set.
  - Edit: call `update_task_action` only when the link changed. Clearing it sends `{ type: "none" }`.
  - If the task has a non-URL action (call, email, …), hide the Link field so saving can't overwrite that action.
- `view-tasks.tsx`: when a task has a URL, show an **Open Link** action (`Action.OpenInBrowser`, ⌘L) and a link icon accessory, and add the URL to the search keywords.
- Prefill (optional, small): in Add Task, if the clipboard holds a URL, offer it as the default Link.

**Tests:** `taskToValues` reads the link. `saveTask` sends the action on create, skips it when unchanged, clears it, and leaves non-URL actions alone.

## 2. Bulk add links

**Goal:** paste many URLs and get one task per URL.

- New command **Add Links** (`add-links.tsx`), as a form with:
  - **Links**: a text area with one URL per line. Blank lines and duplicates are ignored. Lines that aren't URLs fail validation, and the error lists them.
  - **List**, **Tags**, **Priority**, and **Due**, applied to every task. Reuse the existing dropdown and tag-picker code.
- Title for each task: the page's `<title>`, fetched with a short timeout (about 3 s, a few requests at a time). If that fails, use the URL without its scheme. The title can always be fixed later in Edit Task.
- Create the tasks one at a time with `create_task` (sequential is gentler on 2Do's AppleScript bridge), and show an animated toast with "Adding 3 of 12…".
- When it finishes, show a HUD for "Added 12 links to 2Do". If some fail, show a toast like "Added 10, 2 failed" with the failed URLs available to copy.
- Optional: a `Text` + `url` line format (`Read later https://…`) where the text before the URL becomes the title.

**Tests:** parsing the text area (trimming, dedupe, invalid lines, the title-plus-URL form) and title fallback. Keep it pure, in `2do.ts` or a small `links.ts`.

## 3. Cancel a task

**Goal:** a **Cancel Task** action in View Tasks, with behavior set by extension preferences.

Preferences (`package.json`, extension level):

| Preference        | Type      | Default             | Options                                                                |
| ----------------- | --------- | ------------------- | ---------------------------------------------------------------------- |
| `cancelBehavior`  | dropdown  | Complete and tag    | Complete and tag · Tag only · Move to list · Delete                    |
| `cancelTag`       | textfield | `Cancelled`         | Tag title used by the two tag options                                  |
| `cancelList`      | textfield | (empty)             | List title used by "Move to list". Required only for that option       |

- **Complete and tag** is the 2Do convention: append the tag (`tag_update: { operation: "append" }`), then `complete_task`.
- **Tag only** appends the tag and leaves the task open.
- **Move to list** moves the task with `move_task` to the list whose title matches `cancelList`, then completes it. A move can change `task_id`, so use the ID that `move_task` returns.
- **Delete** calls `delete_task` and always asks for confirmation first (`confirmAlert`, destructive style).

Details:

- Find the tag and list by title with `list_tags` and `list_lists`. If one is missing, show a failure toast that names it and points to the preference. Don't create it.
- If the task is a project or checklist with open subtasks, confirm before completing, because they'll be completed too.
- Action: **Cancel Task**, ⌘⇧D (next to Complete at ⌘D). Hide it for tasks that are already completed.
- Logic goes in `cancelTask(task, prefs)` in `2do.ts`, and the view only calls it.
- In the Done view, give tasks that carry the cancel tag an ✕ icon instead of the green check.

**Tests:** for each behavior, the exact sequence of 2Do commands, plus the missing-tag and missing-list errors and the use of the new `task_id` after a move.

## Notes syntax (shared by features 4 and 5)

Both features use **sections** in the notes. A section is a header line followed by `-`  bullet lines, and it ends at the first blank line or the first line that isn't a bullet. Everything else in the notes is left exactly as it was. Headers are matched case-insensitively at the start of a line, and a task has at most one section of each kind (the first one wins).

Dates are local `yyyy-MM-dd`, which sorts correctly and reads the same everywhere.

### 4. Goal progress

**Syntax.** A `Goal:` line starts tracking. Progress entries follow it:

```
Goal: 10 pages
- 2026-11-04 +3
- 2026-11-06 +2 Chapter 4 done
```

- Header: `Goal: <target> [unit]`. The target is a positive number, and the unit is optional free text.
- Entry: `- <yyyy-MM-dd> +<amount> [comment]`. The amount is a positive number. A `-<amount>` entry corrects a mistake.
- Current progress is the sum of the entries. Entries are appended in chronological order, so the section is the history.

**In Raycast:**

- View Tasks shows a progress accessory such as `5/10 pages`, with the icon from `getProgressIcon` in `@raycast/utils`, plus a tooltip with the last entry's date.
- **Log Progress** action (⌘P) pushes a small form with Amount (default 1), Date (default today), and Comment (optional). It appends an entry, using the read-modify-write rule.
- **Start Goal** action, shown only when the notes have no `Goal:` line, inserts the header (Target and Unit fields) at the top of the notes. Typing the syntax in 2Do or in Edit Task works just as well.
- When a logged entry reaches the target, show a toast with a **Complete Task** button. Don't complete the task automatically.
- **Show Progress** pushes a `Detail` view with a progress summary and the entry history as a Markdown table (date, amount, running total, comment).

`notes.ts` **API:** `parseGoal(notes) → { target, unit, entries, total } | null` and `appendProgress(notes, entry) → notes`.

**Tests:** parsing (units, decimals, negative corrections, comments, sections in the middle of other text, a malformed bullet ending the section), appending (to an empty section and to one with text after it), and a round trip that leaves the rest of the notes unchanged.

### 5. Dated notes

**Syntax.** A `Log:` line starts the section:

```
Log:
- 2026-11-04: Emailed the vendor for a quote.
- 2026-11-06: Quote came in at $400, waiting on approval.
```

- Entry: `- <yyyy-MM-dd>: <text>`. The colon after the date keeps these lines distinct from progress entries.
- Entries are appended in chronological order, the same as progress.

**In Raycast:**

- **Add Dated Note** action (⌘N) pushes a form with a Note text area and a Date (default today), then appends an entry using the read-modify-write rule. If the notes have no `Log:` section, it creates one at the end of the notes. Unlike goals, there's no separate "start" step, because adding the first note starts the log.
- Search keywords already include the notes, so log text is searchable as is.
- **Show Progress** from feature 4 becomes **Show Details**, rendering the goal (if any) and the log as a timeline, with the newest entry first in the view only.
- Optional accessory: the date of the latest log entry, shown as relative time ("2d").

`notes.ts` **API:** `parseLog(notes) → { date, text }[]` and `appendLog(notes, entry) → notes`.

**Tests:** the same kinds of cases as the goal tests, plus a task that has both sections and only the targeted one changing.

---

## Open questions

The plan assumes the answer in bold for each question. Change these before starting if the defaults are wrong.

1. **"Add a link":** is it a link on any task, as planned, or specifically a "save this URL as a task" command? Bulk Add Links already covers the second, so a single-link version could be a one-line form if wanted.
2. **Bulk titles:** **fetch page titles**, or skip the network and title tasks with the URL?
3. **Cancel default:** **Complete and tag "Cancelled"**, which matches the existing `cancel-2do-task` skill and the 18 existing cancelled tasks?
4. **Goal reached:** **offer to complete the task**, complete it automatically, or do nothing?
5. **Syntax keywords:** are `Goal:` and `Log:` the right words? Other candidates are `Progress:` and `Notes:`/`Journal:`.
6. **Entry order:** **oldest first** in the notes (append-only, readable as history) or newest first?
7. **Recurring tasks:** when a repeating task completes, 2Do creates the next instance. Should its notes, and with them the progress and log history, carry over? This needs checking in 2Do before features 4 and 5 ship.

## Verify before building

- Which operations `tag_update` accepts besides `set` and `append` (`remove`?). Validation only happens after the task is found, so check it on a scratch task. This is needed if "Uncancel" is added later.
- That `create_task` with `action.type: "url"` accepts custom schemes (`readdle-spark://`, `x-apple-health://`), since existing tasks use them.
- That `move_task` returns the new `task_id` in the shape documented in the sdef.
