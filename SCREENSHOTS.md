# Screenshots

Raycast Store screenshots live in `extension/metadata/` as 2000 × 1250 PNGs, shown in filename order (`2do-1.png`, `2do-2.png`, …). The current ones use the "Demo" list on a gradient background.

The Store shows at most **six** screenshots. Each release in `PLAN.md`'s order adds or swaps in the shots for its features; a suggested final set is at the end.

**Demo tasks:** a list named **Demo** in 2Do holds realistic, happy-path tasks for screenshots. Keep the list for screenshots only. The scripts are on `experimental`; to reset the list with dates relative to today, run from the repo root:

```bash
osascript -l JavaScript scripts/clear-demo.js && osascript -l JavaScript scripts/seed-demo.js
```

`seed-demo.js` seeds every feature on `experimental`. For a release from `main`, seed only the features `main` has: unreleased ones, like goals and journals, show as raw notes text there.

The edge cases are in a separate **Live Testing** list, for `npm run test:live`.

**Capturing:**

- Use Raycast's **Capture Window** command with **Save to Metadata**, on a Retina display, running the extension in `npm run dev` (Capture Window hides development-only elements). Lint rejects any other size than 2000 × 1250.
- Keep the same background as the current ones.
- Use demo tasks only; Store screenshots are public.

([Raycast's guidelines](https://developers.raycast.com/basics/prepare-an-extension-for-store#screenshots))

## Current (Links and Actions)

- [x] **View Tasks** (`2do-1.png`): the Demo list with tags, priorities, due dates (an overdue one in red), stars, and action icons.
- [x] **Edit Task** (`2do-2.png`): "Book a dentist appointment" with the Action set to Call and its Phone Number.
- [x] **Add Task** (`2do-3.png`): the empty form, with the Action field and the remembered list.
- [x] **Add Link** (`2do-4.png`): the first step with "Read page title and description" checked, the Raycast Companion tip, and the "Get Raycast Companion" link.

## Needed, by release

1. **Task form additions:**
   - [ ] Edit Task with New Tags and Repeat filled in (for example Weekly on Mon and Thu). Could replace `2do-3.png`.
   - [ ] View Tasks showing the repeat icon on repeating tasks.
2. **Projects and checklists:**
   - [ ] View Tasks with project and checklist icons and their item-progress rings, like "1/3".
   - [ ] Show Items on "Pack for the trip".
3. **Scoped View Tasks and Deadlines:**
   - [ ] View Tasks: Today or Now, with the dropdown open on the lists and smart lists that have tasks in that scope.
   - [ ] View Tasks: Paused, filtered to the Someday tag (⌘T), with "(Someday)" in the title.
   - [ ] View Tasks: Deadlines, with "Return the library books" under Overdue and the upcoming tasks below it.
4. **Cancel Task:**
   - [ ] View Tasks: Done, with cancelled tasks showing a gray ✕ next to completed ones.
5. **Journal:**
   - [ ] Show Journal: several entries, dated like "Friday, November 6 3 pm (2 hours ago)", with a multi-line entry in the side panel.
6. **Goals:**
   - [ ] View Tasks: Goals, with progress rings (today's share in the second color) and progress like "13/32 pages".
   - [ ] Show Progress or Log Progress for a goal task.
   - [ ] Edit Task with "Add a goal" checked, showing Total, Units, Current and Last Completed.

## Suggested final six

1. View Tasks: the list with action icons, goal and item rings, and the repeat icon
2. Edit Task with an action, a repeat, and a goal
3. Add Link
4. View Tasks: Goals
5. Show Journal
6. Show Items, or View Tasks: Deadlines
