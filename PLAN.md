# Plan

Five features for the 2Do Raycast extension:

1. [x] Add a link
2. [ ] Bulk add links (tabled for now)
3. [x] Cancel a task**,** with a preference for what cancelling does
4. [x] Track goal progress on a task, driven by syntax in the notes, with a history of each bit of progress
5. [ ] Add dated notes to a task, driven by syntax in the notes

Ship them in that order, one commit (or PR) per feature. Each feature lands with its tests, a README section, and a CHANGELOG line.

## What 2Do gives us

The Automation Suite was checked against 2Do 2026.4.3 with read-only calls and calls that used a fake `task_id`.

- **Links are task actions.** A task has `action: { type: "none" }` or `action: { type: "url", value: "https://…" }`. 2Do shows the URL as the task's "Visit website" action. `create_task` and `update_task` accept `action`, and `update_task_action` takes `{ task_id, action }`. These were confirmed on a scratch task:
  - The types are `none`, `url`, `call`, `message`, `mail` and `visit` (a place), plus `google` (a search).
  - Every type but `none` needs a non-empty `value`.
  - `none` must have no `value`; `{ type: "none" }` clears the action.
- **There's no batch create.** Bulk adding means one `create_task` call per link.
- **Cancelled tasks are completed tasks with a "Cancelled" tag.** That's 2Do's convention, and 18 tasks in the current database follow it. `complete_task` on a project or checklist also completes its subtasks (`recursive` defaults to true).
- **The automation can't create tags, but 2Do's URL scheme can.**
  - The suite has `list_tags` but no `create_tag`, and `tag_update` takes only tag IDs. Its operations are `set`, `append` and `remove`.
  - Writing a tag name into the notes doesn't create the tag. 2Do's "detect details" only runs as you type in Quick Entry or the task editor.
  - `twodo://x-callback-url/add?task=…&tags=Name&ignoredefaults=1`, opened with `open -g`, does create a missing tag. This was confirmed by creating the Goal tag, with 2Do staying in the background.
  - `ensureTag` uses this: it adds a placeholder task carrying the tag, waits for the tag to appear, then deletes the placeholder.
- **Notes are plain text.** Whatever syntax we use has to read well in 2Do on Mac and iOS, because the 2Do app won't render or understand it.

## Code layout

- `extension/src/2do.ts`: 2Do calls and task logic (exists).
- `extension/src/link.ts`: reads a web page's title and description, from an open browser tab or a direct fetch (exists, added for Add Link).
- `extension/src/goal.ts`: pure functions that parse and rewrite the goal block. They don't call 2Do, so they're easy to unit test. Dated notes should get a sibling module built the same way.
- `tests/2do.test.ts` (exists) and `tests/notes.test.ts` (new).
- Pull a `ymd(date)` helper (local `yyyy-MM-dd`) out of `dateFields` so the notes code formats dates the same way.

**Read-modify-write rule.** Any action that edits notes (log progress, add a dated note) calls `get_task` first and writes back from that fresh copy, not from the list's cached data. That way an edit made in 2Do since the list loaded isn't lost.

---

## 1. Add a link

**Goal:** a task can carry a URL, set from Raycast, that opens from Raycast.

**Done** (commits `0275f60` and `9429dab`):

- [x] **Add Link** command (`add-link.tsx`). It starts as a Link field and a **Read page title and description** checkbox, which remembers its last setting.
  - Unchecked: Continue opens the task form with the URL as the title.
  - Checked: Continue reads the page first. The task form opens with the page title as the task title and the page's description in the notes.
  - Either way, the task form shows the URL, and saving sets it as the task's link action.
- [x] Page reading (`link.ts`):
  - It tries a browser tab showing the page first, through Raycast Companion (`readTab`). The browser has already passed any bot check, so this works on sites like Goodreads.
  - Otherwise it fetches the page directly, with a 10-second timeout (`fetchPage`).
  - The title comes from `<title>`, then `og:title`. The description comes from the description meta tag, then `og:description`, then `twitter:description`.
- [x] A failure toast explains why reading failed: the site refused (401/403/429/503), an AWS WAF bot check, no page title, a network error, or a timeout. The task form still opens, with the URL as the title.
- [x] While the checkbox is checked, the form shows a tip to keep a browser open with Raycast Companion installed and enabled, plus a **Get Raycast Companion** link in the top-right corner.
- [x] `saveTask` sends `action: { type: "url", value }` when creating a task with `TaskValues.url`.
- [x] Tests in `tests/link.test.ts` and `tests/2do.test.ts`. README and CHANGELOG are updated.
- [x] `extension/tsconfig.json` has `"types": ["node"]`, because TypeScript 6 no longer loads `@types/node` automatically.

**Done next:**

- [x] **Link field** in the task form (Add Task, Edit Task, and Add Link's second step). It's stored as `TaskValues.url` and read from `task.action` when `type === "url"`.
  - The field accepts any scheme with `://`, since existing tasks use `x-apple-health://` and `readdle-spark://`.
  - The action goes in the `update_task` call, which accepts `action`, only when the link changed. Clearing the link sends `{ type: "none" }`.
  - The field is hidden for tasks with a non-URL action (call, email, …), so saving can't overwrite it.
- [x] **View Tasks links** (`taskLinks` in `2do.ts`):
  - The primary link is the task's link action, otherwise the first URL in its notes.
  - **Open Link** (⌘L) opens the primary link.
  - **Choose Link** (⇧⌘L), a submenu shown only with 2 or more links, lists every link with the primary first.
  - Tasks with links show a link icon whose tooltip is the primary link, and their URLs are included in search.
- [x] Tests for `taskLinks`, and for `saveTask` setting, changing, clearing, and skipping the link, and leaving non-URL actions alone.

**Then, all 2Do actions:**

- [x] The form's Link field became an **Action** dropdown, offering None, Link (`url`), Call (`call`), Message (`message`), Email (`mail`), Visit (`visit`) and Google (`google`).
  - A value field follows it, labelled for the chosen type: URL, Phone Number, Email Address, Address, or Search Terms. It's required, and Link needs a full URL.
  - Add Link opens with Link selected and the URL filled in.
  - If 2Do ever reports a type the extension doesn't know, the form hides the action and saving leaves it alone.
- [x] In View Tasks, ⌘L runs the action through the matching scheme: the URL itself, `tel:`, `sms:`, `mailto:`, `maps://?q=`, or a Google search. A task with no action opens the first link in its notes. The accessory icon shows the action type.
- [x] Tests for `actionURL`, `actionValueError`, and `saveTask` setting, changing, clearing and preserving actions.

**Optional, not planned:** prefill Add Link from a URL on the clipboard.

## 2. Bulk add links

**Tabled for now.** Skipped in favor of feature 3; the design below still stands.

**Goal:** paste many URLs and get one task per URL.

- New command **Add Links** (`add-links.tsx`), as a form with:
  - **Links**: a text area with one URL per line. Blank lines and duplicates are ignored. Lines that aren't URLs fail validation, and the error lists them.
  - **List**, **Tags**, **Priority**, and **Due**, applied to every task. Reuse the existing dropdown and tag-picker code.
- Titles: offer the same **Read page title and description** checkbox as Add Link, and reuse `readTab` and `fetchPage` from `link.ts`, a few pages at a time. When a page can't be read, use the URL as the title, as Add Link does, and count it in the end-of-run summary. The title can always be fixed later in Edit Task.
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

**Done**, as planned above, with these details settled:

- [x] The behavior values are `complete-and-tag`, `tag`, `move` and `delete`, shown as Complete and Tag, Tag Only, Move to List and Complete, and Delete.
- [x] Tag and list titles are matched case-insensitively. An empty Cancel List gets its own error.
- [x] On a scratch task, `move_task` returned `{ task: { task_id } }` with a **new** ID, which `cancelTask` uses to complete the task.
- [x] The open-subtask check uses `list_subtasks`, which returns `{ tasks: [{ completed, … }] }`. It applies to the two behaviors that complete the task.
- [x] The Done view gives completed tasks carrying the cancel tag a gray ✕.
- [ ] Not built: an "Uncancel" action. It would need `tag_update` with `remove`, which is still unverified.

## Extra: a View Tasks command per scope (added mid-plan)

- [x] Seven commands: **View Tasks: Today**, **Now**, **Later Today**, **Starred**, **Scheduled**, **Paused** and **Done**. The original View Tasks stays, and covers what a "View Tasks: All" would.
  - 2Do has no "now" or "later today" scope, so both query Today and split it by start time (`hasStarted`). Now has no start time, or a start time that has passed; Later Today has a start time still ahead.
  - **Paused** queries `paused_filter: "only"`, and its dropdown adds a **Paused Tags** section. Smart-list lookups for Paused add `paused_filter: "include"`, since smart lists leave out paused tasks by default.
- [x] Each command's dropdown has **All Lists**, then the lists and smart lists that contain at least one task in that scope.
  - 2Do's `query_tasks` "accepts only one target identifier", so a scope and a list can't be queried together.
  - Lists filter by the task's `list_id`.
  - Smart lists use one extra `query_tasks` per smart list, matching task IDs. That's about 0.3 s for 10 smart lists.
  - If the chosen filter no longer has tasks in the scope, it falls back to All Lists.
- [x] The task row and its actions moved to `task-item.tsx`, shared by View Tasks and the scoped commands. The shared scoped view is `scoped-tasks.tsx`.
- [ ] **Tabled:** in Paused, filter by a paused tag *and* a list or smart list at the same time.
  - Raycast allows one search-bar dropdown, so the tag would need another control.
  - The likely approach: a "Filter by Paused Tag" action (⌘T) sets the tag, the navigation title shows it, and the dropdown offers only lists with tasks under that tag.

## Notes convention (set by goals, the template for dated notes)

Goals aren't a 2Do feature, so the extension stores them in the notes, staying as close to 2Do as possible:

- **A tag mirrors the feature**, so it's visible and filterable in 2Do itself. The default is "Goal", and the name is set in preferences. A missing tag is created on first use through `ensureTag`, as Cancel Task now does too.
- **The data is a block in the notes:** an `@name:` header line through an `@endname` line. Text outside the block is left alone. Lines inside it that aren't entries are ignored. A missing end line means the block runs to the end of the notes.
- **One line per date, newest first**, as local `yyyy-MM-dd`. Dates only, no times, to keep the notes short. A second entry on the same day merges into that day's line.
- **Read-modify-write:** actions that change the block call `get_task` first and write back from that fresh copy.
- **Forms:** the Add and Edit forms carry the feature's fields behind a checkbox. Unchecking removes the block and the tag, after a confirmation, because the history goes with it.

### 4. Goal progress (done)

```
@goal: 32 pages

Nov 6, 2026: 10
2026-11-05 2 pm - -1
Nov 4, 2026: 4

@endgoal
```

- [x] `goal.ts`: `parseGoal`, `formatGoal` and `appendGoal` (new blocks), `setGoalHeader`, `removeGoal`, `logProgress` and `goalProgress` (done, and today's share).
- [x] **Add a goal** checkbox in Add Task and Edit Task:
  - It reveals **Total** (required, above 0) and **Units**.
  - When the task isn't a goal yet, it also reveals **Current**, plus **Last Completed** (default today) when Current is above 0.
  - Editing a goal changes the header in place and keeps its history (`applyGoal` in `2do.ts`).
- [x] **Log Progress** (⌘G; ⌘P is reserved by Raycast): Amount and Date. When the total is reached, a toast offers **Complete Task**.
- [x] Task rows show a progress ring as the icon: earlier progress in green, today's share in blue. It's built like `getProgressIcon`'s SVG, with "13/32 pages" as an accessory.
- [x] **View Tasks: Goals:** open tasks with a goal block, with the usual list and smart-list dropdown.
- [x] Tests in `tests/goal.test.ts`, plus `ensureTag` and `applyGoal` tests that mock `open`, so tests never reach 2Do.

**Follow-up: flexible dates.**

- [x] `dates.ts` reads timestamps with chrono-node's strict English parser, which ignores relative words like "today". It handles `2026-11-05`, `Nov 6, 2026 11:00 am`, `6 Nov 2026 2pm` and `11/5/26`.
  - Ambiguous slash dates follow the Mac's region, from `defaults read -g AppleLocale`: `en_US` reads month first.
  - A timestamp only counts when it makes up the whole text before the separator.
- [x] Goal entries are `<timestamp>` then `:` or ` - ` then an amount. Each separator is tried in turn, since times contain colons. A dash must have spaces around it, so `2026-11-05 -1` is ignored rather than misread as +1.
- [x] Entries with times count toward their day.
- [x] The extension never rewrites lines it didn't write:
  - Logging adds to the day's date-only line, keeping its format, or inserts a new one before the first older entry.
  - Editing a goal only changes the header line.
- [x] The **Goal Date Format** preference sets how the extension writes dates: Nov 6, 2026 (default), 6 Nov 2026, or 2026-11-06.

### 5. Dated notes

**To revisit:** the syntax below predates the goal convention. Redo it as a tagged `@name:` … `@endname` block with one line per date, newest first.

**Original syntax.** A `Log:` line starts the section:

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

1. ~~**"Add a link"**: a link on any task, or a "save this URL as a task" command?~~ Answered: both. The Add Link command is built, and the link on any task is the rest of section 1.
2. **Bulk titles:** **an optional checkbox, the same as Add Link** (reading pages, or using the URL as the title)?
3. **Cancel default:** **Complete and tag "Cancelled"**, which matches the existing `cancel-2do-task` skill and the 18 existing cancelled tasks?
4. ~~**Goal reached:**~~ Answered: a toast offers to complete the task.
5. ~~**Syntax keywords:**~~ Answered for goals: `@goal:` … `@endgoal`. Dated notes still need a name.
6. ~~**Entry order:**~~ Answered: newest first, one line per date.
7. **Recurring tasks:** when a repeating task completes, 2Do creates the next instance. Should its notes, and with them the goal history, carry over? This is still unchecked.

## Verify before building

- ~~Which operations `tag_update` accepts besides `set` and `append`.~~ The 2Do binary lists `set`, `append` and `remove`, so an "Uncancel" action is possible.
- That `create_task` with `action.type: "url"` accepts custom schemes (`readdle-spark://`, `x-apple-health://`), since existing tasks use them.
- ~~That `move_task` returns the new `task_id` in the shape documented in the sdef.~~ Confirmed: it returns `{ task: { task_id } }`, and the ID changes.
