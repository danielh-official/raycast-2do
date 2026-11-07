# Plan

Five features for the 2Do Raycast extension:

1. [x] Add a link
2. [ ] Bulk add links (tabled for now)
3. [x] Cancel a task**,** with a preference for what cancelling does
4. [x] Track goal progress on a task, driven by syntax in the notes, with a history of each bit of progress
5. [x] Add dated notes to a task, driven by syntax in the notes (the journal)

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
  - `ensureTag` used this, adding a placeholder task with the tag and then deleting it. It was **removed** so that Store review isn't worried by shell calls and placeholder tasks. Missing tags are now errors (`requireTag`).
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

- **A tag can mirror the feature**, so it's visible and filterable in 2Do itself. For goals, it's off by default: the Goal Tag preference is empty until the user names a tag. A tag that's set must already exist in 2Do, or saving fails with a message, as Cancel Task's tag does. The journal has no tag.
- **The data is a block in the notes:** an `@name:` header line through an `@endname` line. Text outside the block is left alone. Lines inside it that aren't entries are ignored. A missing end line means the block runs to the end of the notes.
- **One line per date, newest first**, as local `yyyy-MM-dd`. Dates only, no times, to keep the notes short. A second entry on the same day merges into that day's line.
- **Read-modify-write:** actions that change the block call `get_task` first and write back from that fresh copy.
- **Forms:** the Add and Edit forms carry the feature's fields behind a checkbox. Unchecking removes the block and the tag, after a confirmation, because the history goes with it.

### 4. Goal progress (done)

```
@goal: 32 pages

November 6, 2026: 10
2026-11-05 2 pm - -1
November 4, 2026: 4

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
  - Ambiguous slash dates follow the **Ambiguous Dates** preference: month first (the default) or day first. This replaced reading the Mac's region with `defaults read -g AppleLocale`, so the extension runs no shell commands. Its only process is `runAppleScript`, which talks to 2Do. `preferences.ts`'s `dayFirst()` is passed in wherever goal or journal dates are read, keeping `dates.ts` free of Raycast APIs.
  - A timestamp only counts when it makes up the whole text before the separator.
- [x] Goal entries are `<timestamp>` then `:` or ` - ` then an amount. Each separator is tried in turn, since times contain colons. A dash must have spaces around it, so `2026-11-05 -1` is ignored rather than misread as +1.
- [x] Entries with times count toward their day.
- [x] The extension never rewrites lines it didn't write:
  - Logging adds to the day's date-only line, keeping its format, or inserts a new one before the first older entry.
  - Editing a goal only changes the header line.
- [x] The **Goal Date Format** preference sets how the extension writes dates: November 6, 2026 (default), Nov 6, 2026, 6 Nov 2026, or 2026-11-06. The journal should default to the same long month name.

### 5. Dated notes: the journal (done)

It follows the goal convention, except that it has **no tag**, since entries are plain notes, and its entries can carry times.

```
@journal

November 6, 2026 11:00 am - Called the president, went to voicemail
2026-11-05 2 pm

Called again, discussed policy.

@endjournal
```

- [x] `journal.ts`:
  - `parseJournal` reads an entry as a timestamp in any common format, then ` - ` (also `–`, `—` or `:`) and text, or a timestamp alone with the text below. Lines without a timestamp continue the entry above.
  - `addJournalEntry` slots a new entry before the first entry that isn't newer. It never rewrites lines. Multi-line entries get blank lines around them, and a block is started at the end of the notes if needed.
  - `formatEntry` writes `November 6, 2026 2:05 pm - text`, or the timestamp, a blank line, then multi-line text. Picking a date without a time writes a date-only entry.
- [x] `dates.ts`: `parseTimestamp` also returns `at`, for ordering (date-only entries count from the start of their day), and `formatTime` writes "2:05 pm".
- [x] **Journal Date Format** preference, defaulting to November 6, 2026.
- [x] **Add Journal Entry** (⌘J) on any task, reading the task fresh first. **Show Journal** (⇧⌘J) is a Detail view, newest first, with timestamps as written, that reloads after an entry is added. Tasks with a journal show a book icon.
- [x] Tests in `tests/journal.test.ts`.

**Follow-up: hide the blocks from Edit Task.**

- [x] `notes.ts`: `splitNotes` separates the Notes field's text from the goal and journal blocks, using the same header and end lines as `goal.ts` and `journal.ts`. `joinNotes` puts the blocks back after the text.
- [x] `taskToValues` fills Notes with the text only. On save, `TaskForm` re-reads the task and joins its current blocks back, so progress or journal entries added while the form was open aren't lost. Goal changes then apply to the joined notes.
- [x] Blocks end up after the text. Notes that already end with their blocks, which is how the extension writes them, round-trip unchanged. Text typed below a block in 2Do moves above it on the next save.
- [x] The Notes field shows an info note when blocks are hidden.

**Follow-up: journal display dates.**

- [x] Show Journal displays timestamps with `formatDisplay` in `dates.ts`, which only affects display; the notes keep what was written.
  - **Journal Display Date** preference: `weekday` ("Friday, November 6, 2026", the default), `long`, `short`, `iso`, or `written` (as typed).
  - **Show relative time** preference, a checkbox that's on by default, adds `relativeTime`. That's minutes and hours for timed entries, then calendar days ("today", "yesterday"), weeks, months and years, using `Intl.RelativeTimeFormat`.
  - Times show as "3 pm", or "3:05 pm" when there are minutes.
  - The year is left out when it's the current one, in every style except `iso` and `written`.

**Follow-up: hardening before publishing.**

- [x] **Syntax checks** (`checkGoal`, `checkJournal`, `checkNotes`), because worst cases are silently ignored text, not lost text:
  - A missing end line is fixable (`closeGoal` after the last entry; `closeJournal` after the last entry's paragraph).
  - A header without a total, unreadable goal lines, and text before the first journal entry are warnings only.
  - **Where they show:** a ⚠️ accessory with the messages, and a "Fix Goal and Journal Syntax" action. Log Progress and Add Journal Entry ask "Fix and Continue" first (`remediate.ts`). Edit Task and Show Journal show the warnings, and Edit Task's saves keep blocks as they are.
- [x] **2Do too old or missing:** `twoDo` rewords "Message not understood" (-1708) as "update 2Do to the latest version", and "Application can't be found" (-2700) as "2Do isn't installed".
- [x] **Smart-list results** are cached per scope in Raycast's `Cache`, re-queried when a command opens only if they're more than 10 minutes old, and after task actions. The smart list picked in the dropdown is queried fresh, so filtering is never stale.
- [x] **Dates:** chrono-node already reads weekdays, ordinals (6th), abbreviations (Nov.), ISO times and "at 2:05 PM". Dotted dates (6.11.2026) are now always day-first. Still not read: compact dates (20261106), "14h05", ISO weeks, and non-English month names.
- [x] **Repeating tasks:** confirmed on a scratch task. Completing one keeps the open task, moved to its next date, and leaves a completed copy, and both keep the notes. A repeating goal carries its progress forward; it doesn't reset.

**Follow-up: nitpicks.**

- [x] **Multiple blocks:** only the topmost goal and topmost journal count, everywhere: parsing, logging, adding entries, header edits, removal, and Edit Task's hidden blocks (`splitNotes`). Later blocks are ordinary notes text. Removing the topmost goal promotes the next one.
- [x] ~~**Tag goals** checkbox~~. It was replaced by an optional **Goal Tag**, empty by default. When it's set, the tag must exist in 2Do. Removing a goal still removes that tag, as cleanup.
- [x] `removeGoal` removes the blank line after a block at the top of the notes, so no blank line is left at the start.

---

## Repeating tasks, projects, and checklists

The data, checked on Nov 6 (54 open tasks):
- **Repeating (18 tasks):** completing one keeps the same task ID, moved to its next date, and adds a completed copy with a new ID. Both keep the notes and tags. `complete_task` returns only the open task, so the copy has to be found by searching its title and taking the latest `completion_date`. Recurrence needs `based_on` (for example `{ frequency: "daily", based_on: "due_date" }`).
- **Projects (2) and checklists (4):** their items never appear in `query_tasks`, in any scope, and only come back from `list_subtasks` (`{ item_count, tasks }`). Completing a parent completes its open items (`recursive` defaults to true).

### Build now (touches Cancel Task)

- [x] **Cancel only this occurrence of a repeating task.** Tagging before completing tagged the next occurrence too, which was confirmed on a scratch task. `cancelTask` now does this, verified live: the completed copy got the tag, and the next occurrence stayed clean.
  - Complete first, then act on the completed occurrence: the copy for a repeating task, the task itself otherwise.
  - **Complete and Tag:** complete, then tag the copy, so the next occurrence stays clean. That's one step instead of tagging, completing, then untagging by hand.
  - **Move to List and Complete:** complete, then move the copy. Moving first would move the whole series.
  - **Delete:** complete, then delete the copy, which skips this occurrence. Deleting the task itself would delete the series.
  - **Tag Only** has no completion, so it tags the open task, as now.

### Planned

- [ ] **Completing a goal task** (Complete Task on a task with a goal):
  - If the goal isn't reached, ask whether to log the remaining progress first.
  - For a repeating goal task, also ask whether the next occurrence starts fresh (its goal reset to 0, with the history kept on the completed copy) or keeps the running total, as now. Both are valid uses: each occurrence with its own goal, or one running goal across occurrences.
- [ ] **Repeat indicator:** a repeat icon on repeating tasks, with the rule ("Daily", "Every 2 weeks") as its tooltip. No editing of repetition in the forms for now.
- [ ] **Projects and checklists:**
  - A **Show Items** action lists a parent's items, with the usual task actions.
  - The parent shows its items' progress, like "3/6", as a ring.
  - If the parent is also a goal, the goal still displays and Log Progress still works, but **the ring shows item progress, not goal progress.**
- [ ] **Completing a parent with open items:** ask whether to **complete** or **cancel** the remaining items (cancelling uses the Cancel Task preferences), with a way to back out without deciding. It always asks when there are open items.
- [ ] **Creating:** an **Add Item** action on projects and checklists (`create_task` under the parent), and a **Type** field (Task, Project or Checklist) in Add Task.
- [x] **Project or Checklist field** in Add Task and Edit Task. It shows when the chosen list has any, and lists them (`listParents`).
  - Creating uses `parent_task_id` *instead of* `list_id`, since 2Do takes exactly one destination. Editing uses `move_task` with `parent_task_id`, which gives the task a new ID.
  - The field resets when the list changes.
  - Not offered to projects or checklists themselves: on a scratch task, 2Do turned a checklist moved into a project into a normal task.
- [x] **Show Progress (⇧⌘G)** on goal tasks, like Show Journal:
  - a summary line, ⚠️ warnings, and a table of entries, newest first, with running totals (`progressHistory`)
  - Log Progress from inside it
  - Goal entries now carry `stamp` (as written) and `at` (for ordering), like journal entries.
  - The display preferences were renamed **Entry Display Date**, since they now apply to both views.

### Later questions

- If a project or checklist is a goal, does the goal ever override item progress for the ring?
- If an item is itself a goal, does it count as one item toward its parent, or by its goal's progress?

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
