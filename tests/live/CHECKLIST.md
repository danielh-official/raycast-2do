# Manual Raycast checklist

What the live tests can't check: how things look and behave in Raycast. Run the extension with `npm run dev` (in `extension/`), and reset both lists first:

```bash
osascript -l JavaScript scripts/clear-demo.js && osascript -l JavaScript scripts/seed-demo.js   # repo root
cd tests && osascript -l JavaScript live/clear.js && osascript -l JavaScript live/seed.js
```

The happy path uses the **Demo** list, and the unhappy path uses **Live Testing**. Task names below are from the seed scripts.

## Task list (View Tasks, set to the Demo list)

- [ ] Rows show tags, priority, due date, star, and an action icon (phone, map, envelope, link) on tasks with actions.
- [ ] "Read Designing Data-Intensive Applications" shows a ring, with today's share in blue, and "24/40 pages". Hovering the text shows "+6 today".
- [ ] "Drink 8 glasses of water" (a repeating goal) shows its ring with "5/8 glasses".
- [ ] "Insurance claim follow-up" shows a book icon. Hovering says "3 journal entries".
- [ ] ⌘L on "Book a dentist appointment" offers to call (FaceTime), on "Pick up dry cleaning" opens Maps, and on "Read the Raycast extension guidelines" opens the page.
- [ ] ⌘K on a goal task lists Run Action, Log Progress (⌘G), Add Journal Entry (⌘J), Complete (⌘D), Cancel Task (⇧⌘D), Star (⌘.) and Open in 2Do (⌘O).

## Goals

- [ ] Log Progress (⌘G) on "Run 20 km this week" with 3: the toast says "Progress logged, 14/20 km", and the ring grows.
- [ ] Log Progress on "Drink 8 glasses of water" with 3: the toast says "Goal reached" with a Complete Task button.
- [ ] Edit Task on a goal: the Notes field shows only "Chapter 4 next." (no `@goal` block). Total and Units are filled in, with no Current field.
- [ ] Change Total to 50, save, and in 2Do only the `@goal:` line changed.
- [ ] Uncheck "Add a goal" and save: it asks "Remove the goal?". Cancel leaves it unchanged.
- [ ] Add Task with "Add a goal" checked, Current 3: Last Completed appears, set to today. Saving writes a block with a line like "November 6, 2026: 3".
- [ ] Show Progress (⇧⌘G) on "Read Designing Data-Intensive Applications": "24 of 40 pages · 60% · +6 today", then a table of three entries, newest first, with totals 24, 18, 8.
- [ ] Log Progress from inside Show Progress: the table updates after saving.

## Projects and checklists

- [ ] Add Task with the List set to Demo: a "Project or Checklist" field offers "Plan the team offsite" and "Pack for the trip". Picking one adds the task inside it (check in 2Do).
- [ ] Switching the List to one without projects or checklists hides the field.
- [ ] Edit Task on a normal Demo task: picking a project moves the task into it. It then leaves the Demo task list, since items don't show there yet.
- [ ] Edit Task on "Plan the team offsite" doesn't show the field.
- [ ] Add Item (⌘N) on "Pack for the trip": no List, Start or Due fields. Saving shows "Item added" and stays in Raycast. Inside Show Items, the top "Add Item" row does the same, and the list updates.
- [ ] ⌘D on "Pack for the trip" (3 open items) opens a submenu. Each choice asks to confirm, and Not Now changes nothing.

## Journal

- [ ] Show Journal (⇧⌘J) on "Insurance claim follow-up": entries newest first, dated like "Friday, November 6 11 am (… hours ago)". The multi-line entry keeps its line breaks.
- [ ] Add Journal Entry (⌘J) from Show Journal: the new entry appears there after saving.
- [ ] Add a two-line entry: in 2Do, it's the timestamp on its own line, then a blank line, then the text.

## Scoped commands

- [ ] View Tasks: Today's dropdown only offers lists and smart lists with tasks today. Picking Demo narrows the list.
- [ ] View Tasks: Later Today shows "Evening walk" (before 7:30 pm); View Tasks: Now doesn't.
- [ ] View Tasks: Goals shows the three Demo goals.
- [ ] View Tasks: Paused shows "Learn the cello", and the dropdown has a Paused Tags section with Someday.
- [ ] View Tasks: Done shows "Try a new note-taking app" with a gray ✕, and "Renew the car registration" with a green check.
- [ ] Reopen a scoped command within 10 minutes: no long loading bar (cached smart lists).

## Add Link

- [ ] Paste a URL, check "Read page title and description": the tip and the "Get Raycast Companion" link appear.
- [ ] Continue: the task form fills in the page title, description, and the Link action.
- [ ] With an invalid URL ("example.com"): the field shows an error.

## Unhappy paths (View Tasks, set to the Live Testing list)

- [ ] "Broken: goal without @endgoal" shows an orange ⚠️. Hovering explains the missing @endgoal.
- [ ] Its ⌘K has "Fix Goal and Journal Syntax". Running it asks first, then the ⚠️ disappears, and Edit Task's Notes shows "Call the library about the next book."
- [ ] Add Journal Entry (⌘J) on "Broken: journal without @endjournal": it asks "Fix the notes' syntax first?". Cancel writes nothing; Fix and Continue adds `@endjournal` after "Booked the venue", then the entry.
- [ ] "Broken: @goal without a total", "Broken: unreadable goal line" and "Broken: text before the first journal entry" show ⚠️ with no Fix action.
- [ ] Edit Task on a broken task shows the ⚠️ Notes Syntax description at the top.
- [ ] Show Journal on "Broken: text before the first journal entry" shows the warning above the entries.
- [ ] Cancel Task on "Cancel me (repeats daily)": in 2Do, the completed copy is tagged Cancelled, and the next occurrence isn't.
- [ ] With Cancel Task set to Delete, cancelling "Water the plants (repeats weekly)" asks "Delete this occurrence…?".
- [ ] Set Cancel Tag to a tag that doesn't exist, then cancel: the toast explains, and nothing changes.
- [ ] Set Goal Tag to a tag that doesn't exist, then save a goal: the toast explains, and nothing changes.
- [ ] Set Ambiguous Dates to Day First: "Run 20 km (ambiguous slash and dotted dates)" keeps "8/20 km", but its "+3 today" disappears, because today's slash date now reads as a different day. Set it back to Month First afterwards.
