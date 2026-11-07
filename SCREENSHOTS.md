# Screenshots

Raycast Store screenshots live in `extension/metadata/` as 2000 × 1250 PNGs, numbered in the order the Store shows them (`1.png`, `2.png`, …). The current ones use the "Demo" list on a gradient background.

The Store shows at most **six** screenshots, so the needed ones below are in priority order. A suggested final set is at the end.

**Demo tasks:** a list named **Demo** in 2Do holds realistic, happy-path tasks for screenshots: actions, goals with progress, a journal, a project, a checklist, and repeating, paused and cancelled tasks. Keep the list for screenshots only. To reset it to fresh tasks with dates relative to today, run from the repo root:

```bash
osascript -l JavaScript scripts/clear-demo.js && osascript -l JavaScript scripts/seed-demo.js
```

The edge cases are in a separate **Live Testing** list, for `npm run test:live`.

**Capturing:**

- Use Raycast's **Capture Window** command with **Save to Metadata**, running the extension in `npm run dev` (Capture Window hides development-only elements).
- Keep the same background as the current ones.
- Use demo tasks only; Store screenshots are public.

([Raycast's guidelines](https://developers.raycast.com/basics/prepare-an-extension-for-store#screenshots))

## Current

- [x] **View Tasks** (`1.png`): the task list with tags, priorities, due dates and stars, and the scope dropdown set to the Demo list.
- [x] **Edit Task** (`2.png`): the edit form filled in for "Reply to Sam about the project kickoff". _Out of date: it predates the Action dropdown and the "Add a goal" checkbox._
- [x] **Add Task** (`3.png`): the empty add form, with the remembered list. _Out of date for the same reason._

## Needed

- [ ] **Goals:** View Tasks: Goals, with a few goal tasks showing progress rings (today's share in the second color) and progress like "13/32 pages".
- [ ] **Show Journal:** a task's journal with several entries, dated like "Friday, November 6 3 pm (2 hours ago)", including a multi-line entry.
- [ ] **Add Link:** the first step, with a URL and "Read page title and description" checked, plus the Raycast Companion tip. Or the second step: the task form filled in with the page's title and description.
- [ ] **Task form with an action and a goal:** Edit Task with the Action dropdown set (Link or Call) and "Add a goal" checked, showing Total, Units, Current and Last Completed. This could replace `2.png` and `3.png`.
- [ ] **Scoped command:** View Tasks: Today, or Now, with the dropdown open on lists and smart lists that have tasks in that scope.
- [ ] **Log Progress:** the Amount and Date form for a goal task.
- [ ] **Task actions:** the Actions panel (⌘K) on a task, showing Run Action (⌘L), Choose Link (⇧⌘L), Log Progress (⌘G), Add Journal Entry (⌘J), Cancel Task (⇧⌘D) and the rest.
- [ ] **Paused:** View Tasks: Paused, with the dropdown on its Paused Tags section.
- [ ] **Cancelled in Done:** View Tasks: Done, with cancelled tasks showing a gray ✕ next to completed ones.

## Suggested final six

1. View Tasks or a scoped command: the list, with goal rings and action icons visible
2. Goals
3. Show Journal
4. Add Link
5. Task form with an action and a goal (replaces the current Edit Task and Add Task)
6. Task actions panel
