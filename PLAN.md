# Plan

## Status rules

- A checked task means implemented on **`main`**, not merely prototyped on `experimental`. It does not necessarily mean published; see Releases.
- `experimental` is reference material, not a commitment to ship its implementation or design.
- Active work is ordered below. Frozen ideas are at the end, outside the release queue.
- Each release includes tests, accurate README coverage, and a CHANGELOG entry. Keep commits and Store PRs small enough for a human reviewer.

## Next

### Cancel Task

All cancellation features remain wanted. They exist in `experimental`, **not `main`**.

- [ ] **Cancel Task** action in View Tasks (⇧⌘D), hidden for completed tasks.
- [ ] Extension preferences:
  - **Cancel Task** (`cancelBehavior`): Complete and Tag (`complete-and-tag`, default), Tag Only (`tag`), Move to List and Complete (`move`), or Delete (`delete`).
  - **Cancel Tag** (`cancelTag`): `Cancelled` by default.
  - **Cancel List** (`cancelList`): empty by default, required for Move to List and Complete.
- [ ] Match tag/list names case-insensitively. Missing tags/lists and an empty required Cancel List produce actionable errors before anything changes; don't create them.
- [ ] **Complete and Tag:** complete first, then tag only the completed occurrence.
- [ ] **Tag Only:** append the cancel tag to the open task without completing it.
- [ ] **Move to List and Complete:** complete first, then move only the completed occurrence.
- [ ] **Delete:** always confirm destructively. Delete a non-repeating task directly; for a repeating task, complete then delete only the completed occurrence.
- [ ] **Cancel only this occurrence of a repeating task:** leave the next occurrence's tags, list, and existence untouched.
  - Completing a repeating task keeps its open task ID and creates a completed copy with another ID.
  - `complete_task` returns the open task, not the copy. Experimental finds the copy by searching the task's list for its exact title and taking the latest `completion_date`.
  - If the completed copy cannot be found, report that completion happened but cancellation could not finish.
- [ ] **Parent safety:** confirm cancellation of a project/checklist with open items when the behavior completes or deletes it. Tag Only does not complete children.
- [ ] **Cancelled-task appearance:** completed tasks with the cancel tag show a gray ✕; completed tasks in the configured Cancel List also count as cancelled for the move behavior.
- [ ] **Undo cancellation through Mark as Not Done:** remove the cancel tag when reopening. For a task cancelled into the Cancel List, ask which list to restore it to; the original list is not recorded.
  - Tag Only leaves the task open; Delete leaves nothing to reopen.
- [ ] **Complete Task and Cancel Remaining Items:** parents gain an alternative to completing their open items normally. Apply Cancel Task preferences to the open items, then complete the parent, with confirmation and a way to back out.
- [ ] Tests for command sequences, missing preferences/targets, repeating occurrences, reopened tasks, and parent completion/cancellation; README and CHANGELOG.

## Implemented on main

### Links and actions

- [x] **Add Link:** URL field and remembered **Read page title and description** checkbox, then a prefilled task form.
- [x] Read an open browser tab through Raycast Companion first, otherwise fetch directly with a 10-second timeout.
  - Title: `<title>`, then `og:title`.
  - Description: description meta tag, then `og:description`, then `twitter:description`.
  - Reading failures explain the refusal, bot check, missing title, network error, or timeout; the form still opens with the URL as its title.
- [x] Companion tip and installation link while page reading is enabled.
- [x] **Action** dropdown in Add/Edit Task: None, Link, Call, Message, Email, Visit, and Google, with an appropriate required value field.
  - Links accept custom schemes with `://`.
  - Edit Task only sends changed actions; clearing sends `{ type: "none" }`. Unknown action types are left untouched.
- [x] Run a task's action with ⌘L using its matching scheme; fall back to the first notes URL when there is no action.
- [x] **Choose Link** (⇧⌘L) lists multiple links, primary first. Action icons/tooltips and link search keywords.
- [x] Link/action tests, README, CHANGELOG, and explicit Node types for TypeScript 6.

### Repeats, tags, and compatibility

- [x] **New Tags** in Add/Edit Task: comma-separated names, deduplicated and matched case-insensitively against existing tags. Save via `tag_update: { operation: "set", tag_ids, tag_names }`.
- [x] **Repeat settings** in Add/Edit Task; only send changed recurrence and preserve a recurrence the form cannot represent.
  - Frequencies: daily, weekdays, weekly (optional weekdays), monthly (optional weekday and ordinal), yearly, custom interval/unit.
  - `based_on`: `due_date` or `completion`, required.
  - End rules: never, after count, or on date.
  - Limits: interval 1–999, ordinal 1–5 or -1, occurrence count 1–99; selected weekdays cannot be empty.
  - A repeat requires a start or due date; clearing both silently drops it. `frequency: "none"` clears it; `recurrence: null` is rejected.
  - Read 2Do's monthly weekday/end-date keys `wkdy` and `ldt ` too.
  - Checklist children have no dates and cannot repeat; the checklist, a project, and project children can.
- [x] Repeat icon with a rule tooltip.
- [x] Friendly errors for old or missing 2Do: -1708 suggests updating; -2700 says it isn't installed.

### Projects and checklists

- [x] **Type** in Add Task: Task, Project, or Checklist. Parents go in a list, not another parent.
- [x] **Project or Checklist** field in Add/Edit Task, reset when List changes; preserve an item's existing parent unless its destination changes.
  - Create with `parent_task_id` instead of `list_id`; edit/move with `move_task`, which can return a new task ID.
  - Don't offer nesting to projects/checklists: 2Do converts a nested parent into a normal task.
- [x] Parent type icons and cached item-progress rings such as 3/6.
- [x] **Show Items** (⌘I) with the usual task actions.
- [x] **Add Item** (⌘N), with its parent preset and destination fields hidden; checklist children also hide Start and Due.
- [x] **Complete a parent with open items:** confirm before completing its items, with Not Now to back out.
  - Cancelling remaining items is **not implemented on main**; see Cancel Task.
- [x] Shared task rows/actions in `task-item.tsx`.

### Form workflow

- [x] **Add Task stays open after adding:** success toast, reset form while retaining List, focus Title; refresh new-tag and parent choices when needed.
  - Edit Task and Add Item close after saving; Add Link returns to its cleared Link step.
- [x] **Tags Under List:** order is List → Project or Checklist (when shown) → Tags → New Tags in Add Task, Edit Task, and Add Link.

### Smart-list caching

- [x] Cache the smart-list dropdown catalog with `@raycast/utils` `withCache` (`maxAge: 10 * 60_000`, `validate`, `clearCache()`) to avoid repeated `list_smart_lists` queries.
  - No per-smart-list membership query fan-out or membership cache.
  - Reuse the catalog for ten minutes across command opens; invalidate and refresh after task actions.
  - Task queries for selected scopes stay fresh, including selected smart lists.

### New View Tasks Scopes

- [x] Now / Later Today (Today + `hasStarted`), Tomorrow (local start-date window), Deadlines (due window + Overdue/Upcoming).
- [x] Per paused tag as **Paused: {tag}** in the scope dropdown.
- [x] Dated-scope start-then-due ordering for Today, Now, Later Today, Tomorrow, and Scheduled; Deadlines by due date ascending; Done by completion date descending.

### View Tasks scope counts

- [x] Scope dropdown labels include full totals (not the 200-task display limit), e.g. **Today (2)**; Done counts completed tasks.
- [x] Counts load in the background after catalogs are ready; refresh after task changes. Simple scopes use `total_count` with `limit: 1`; Now/Later and paused tags paginate once each.

## Automation Suite reference

Checked against 2Do 2026.4.3, including scratch-task verification in November 2026.

- A task action has `type: "none"` or a supported type with a non-empty `value`. None must have no value.
- There is no batch create; bulk creation requires sequential `create_task` calls.
- 2Do's cancellation convention is a completed task with a Cancelled tag.
- `tag_update` requires `tag_ids`. Only `set` accepts `tag_names` and creates missing names; `append`/`remove` reject names. There is no tag creation/deletion command.
- Do not use shell calls or placeholder tasks to create tags. The old experimental `ensureTag` approach was removed.
- `move_task` returns `{ task: { task_id } }`; moving can change the ID.
- Repeating completion retains the open task, advances its dates, and creates a completed copy. Both retain notes/tags.
- Project/checklist items do not appear in `query_tasks`; use `list_subtasks` (`{ item_count, tasks }`). Completing a parent completes its open items by default.
- `query_tasks` accepts only one target identifier, so combining a scope with a list/smart list may require local filtering or separate membership queries.
- Notes are plain text. Any future notes-editing action must re-read the task before writing, preserving edits made since the UI loaded.

## Housekeeping and development support

Keep unrelated cleanup out of feature PRs; apply these patterns to new code where appropriate.

- [ ] **Action types:** derive `ActionType` from `ACTIONS` using `satisfies`; type `RUN_ACTION` against the same keys.
- [ ] **`twoDo` commands:** map command names to response types so command typos fail compilation and callers need not repeat response types.
- [ ] **Priority:** use the priority union in `TaskValues` and check `PRIORITY_TAGS` with `satisfies`.
- [ ] **Live integration tests:** experimental has a real-2Do suite with Demo-list seed/cleanup and a separate `test:live` command; not on main. No release priority assigned.
- [ ] **Screenshot demo scripts:** experimental has seed/clear scripts; not on main. No release priority assigned.

## Releases

`main` holds the Store version plus the release in progress. Draw selectively from `experimental`, leaving frozen features out. Follow [AGENTS.md](AGENTS.md#releases). Screenshots wait until a release needs them.

### Released

- **Initial Version** (2026-11-01, [raycast/extensions#32601](https://github.com/raycast/extensions/pull/32601)): Add Task and View Tasks.
- **Links and Actions** (2026-11-07, [raycast/extensions#33282](https://github.com/raycast/extensions/pull/33282)): Add Link, Action fields, running actions, and choosing links.
- **Repeats and New Tags** (2026-11-09, [raycast/extensions#33346](https://github.com/raycast/extensions/pull/33346)): Repeat settings/icon, New Tags, and old/missing-2Do errors.
- **Projects and Checklists** (2026-11-17, [raycast/extensions#33613](https://github.com/raycast/extensions/pull/33613)): Type/destination fields, Show Items, Add Item, parent icons/rings, and confirmation before completing open items.
- **Add Task Stays Open** (2026-11-23, [raycast/extensions#33807](https://github.com/raycast/extensions/pull/33807)): reset Add Task and Add Link for repeated entry.
- **Tags Under List** (2026-11-25, [raycast/extensions#33927](https://github.com/raycast/extensions/pull/33927)): Tags and New Tags below List / Project or Checklist in forms.
- **Smart List Performance** (2026-11-25, [raycast/extensions#33941](https://github.com/raycast/extensions/pull/33941)): ten-minute smart-list catalog cache; selected-scope tasks stay fresh.

### In progress and order

1. **New View Tasks Scopes:** implemented on main (scopes, paused-tag rows, counts, start/due on rows); not yet listed as released.
2. **Cancel Task:** all cancellation features above, including repeating occurrences, reopening, and cancelling remaining parent items.

No scoped-command, goal, or journal release is currently planned.

## Parked verification

- Whether `create_task` accepts a URL action with custom schemes such as `readdle-spark://` or `x-apple-health://`. The form accepts them; creation has not been tested.

## Frozen / considered, not currently planned

These are **not completed on main and are not active tasks**. Experimental prototypes do not change that status. Do not bring them into a release without revisiting the decision.

### Separate scoped Raycast commands

- [ ] Frozen: separate View Tasks commands for Today, Now, Later Today, Starred, Scheduled, Paused, Done, and Deadlines; experimental contains these.
- [ ] Frozen: each command's list/smart-list dropdown, matching-list-only choices, fallback to All Lists, and shared `scoped-tasks.tsx` UI.
  - Reusable query/filter logic may inform the active in-command scope work, but separate commands themselves are not planned.

### Bulk Add Links

- [ ] Frozen, unimplemented: paste one URL per line, ignoring blanks/duplicates and rejecting invalid lines.
  - Shared list/tags/priority/due fields, optional page-title/description reading, sequential creation, progress feedback, and a failure summary.
  - Optional title-plus-URL syntax and clipboard prefilling remain ideas, not requirements.

### Goals — considered, not currently planned

Projects/checklists cover much of the desired functionality and are preferred. Keep goals at the back, with no release slot.

- [ ] Frozen: goal notes blocks and parsing/writing helpers (`goal.ts`).
- [ ] Frozen: Add/Edit goal fields (total, units, current progress, last-completed date), optional goal tag, header edits, and confirmed removal of history.
- [ ] Frozen: dated progress logging, same-day aggregation, and a completion offer when the target is reached.
- [ ] Frozen: progress counts and two-color rings; parent item rings taking precedence.
- [ ] Frozen: Show Progress history, running totals, and entry editing/deletion.
- [ ] Frozen: goal-aware completion, logging remaining progress, and resetting or retaining progress for a repeating task.
- [ ] Frozen: View Tasks: Goals.
- [ ] Frozen: associated tests/docs and date-format preferences.

The `@goal: … @endgoal` implementation exists only in experimental and is not a shipping commitment.

### Journal — considered, not currently planned

The block-based experimental design is **not the desired future design**. Do not require or introduce `@journal … @endjournal` markers.

- [ ] Frozen: adding timestamped notes, Show Journal, entry editing/deletion, and journal indicators.
- [ ] Frozen / needs redesign: detect timed entries directly in ordinary notes using loose patterns such as `{timestamp} - {note}` or `{timestamp}: {note}`, without wrapper blocks.
  - The rules are deliberately unsettled: supported timestamps/separators, continuation lines, false positives, ordering, and safe edits all need a fresh design if revisited.
  - Experimental's block parser/writer and tests are historical reference, not an accepted specification.

### Shared goal/journal behavior — frozen with those ideas

- [ ] Frozen: chrono-node date parsing, ambiguous-date preference, dotted-date handling, and date-format preferences.
- [ ] Frozen: entry display styles, relative time, and omitting the current year.
- [ ] Frozen: hiding structured blocks from Edit Task, splitting/joining them, and hidden-block information.
- [ ] Frozen: syntax warnings, missing-end-marker repair, and Fix and Continue prompts.
- [ ] Frozen: topmost-block-only handling, preserving later blocks as ordinary notes, and removal whitespace cleanup.
- [ ] Frozen: conflict detection when editing/deleting individual entries after re-reading notes.
- [ ] Frozen: associated goal/journal/notes/date tests and documentation.

Historical parser limitations (compact dates, "14h05", ISO weeks, non-English month names) are not active work. Old answers about goal completion, block syntax, and entry ordering are superseded by this frozen status.
