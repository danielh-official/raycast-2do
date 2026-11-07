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
- [ ] Show Progress (⇧⌘G) on "Read Designing Data-Intensive Applications": the section title says "24 of 40 pages · 60% · +6 today", over three entries, newest first, with totals 24, 18, 8.
- [ ] In Show Progress: Log Progress (⌘G) adds a row; Edit Entry (⌘E) on today's entry changes its amount and keeps its date text; Delete Entry (⌃X) asks, then removes it.
- [ ] ⌘D on "Run 20 km this week" (not reached) opens Complete Goal Task with "Log the remaining … km for today". ⌘D on "Drink 8 glasses of water" (repeating) also offers "Next Occurrence". Esc changes nothing.

## Add Task

- [ ] New Tags under Tags: "Live Testing, live testing" in Add Task (List: Live Testing) adds one "Live Testing" tag, reusing the existing one. A name not yet in 2Do shows up in 2Do's tags after saving.
- [ ] Repeat set to Weekly shows "On" with the seven days; Monthly shows "On", and picking "The Second" adds a Weekday field; Custom shows Every and Unit. Ends "On a Date" shows End Date.
- [ ] Repeat set to Daily with no Start or Due: saving shows "Set a start or due date to repeat" on Repeat.
- [ ] Edit Task on "Drink 8 glasses of water" shows Repeat: Daily. Changing it to Monthly on the Last Friday saves, and the row's repeat icon tooltip says "Repeats: Monthly on the last Fri".

## Projects and checklists

- [ ] Add Task with the List set to Demo: a "Project or Checklist" field offers "Plan the team offsite" and "Pack for the trip". Picking one adds the task inside it (check in 2Do).
- [ ] Switching the List to one without projects or checklists hides the field.
- [ ] Add Task with Type set to Checklist hides the Project or Checklist field, and creates a checklist in the list.
- [ ] Edit Task on a normal Demo task: picking a project moves the task into it. It then leaves the Demo task list, since items don't show there yet.
- [ ] Edit Task on "Plan the team offsite" doesn't show the field.
- [ ] Add Item (⌘N) on "Pack for the trip": no List, Start or Due fields. Saving shows "Item added" and stays in Raycast. Inside Show Items, the top "Add Item" row does the same, and the list updates.
- [ ] ⌘D on "Pack for the trip" (3 open items) opens a submenu. Each choice asks to confirm, and Not Now changes nothing.

## Journal

- [ ] Show Journal (⇧⌘J) on "Insurance claim follow-up": a list, newest first, dated like "Friday, November 6 11 am (… hours ago)". The side panel shows the text, line breaks included.
- [ ] In Show Journal: Add Journal Entry (⌘N) adds a row; Edit Entry (⌘E) with only new text keeps the timestamp, and with a new time moves the entry into order; Delete Entry (⌃X) asks, then removes it.
- [ ] Add a two-line entry: in 2Do, it's the timestamp on its own line, then a blank line, then the text.

## Scoped commands

- [ ] View Tasks: Today's dropdown only offers lists and smart lists with tasks today. Picking Demo narrows the list.
- [ ] View Tasks: Later Today shows "Evening walk" (before 7:30 pm); View Tasks: Now doesn't.
- [ ] View Tasks: Goals shows the three Demo goals.
- [ ] View Tasks: Deadlines shows an Overdue section with "Return the library books", then Upcoming in due-date order: today's tasks, then tomorrow's, then "Pack for the trip" and "Plan the team offsite". Tasks without a due date aren't listed.
- [ ] View Tasks: Paused shows "Learn the cello". Filter by Paused Tag (⌘T) offers Someday; picking it puts "(Someday)" in the title, and the dropdown then offers only lists with Someday tasks. "All Paused Tags" clears it.
- [ ] View Tasks: Done shows "Try a new note-taking app" with a gray ✕, and "Renew the car registration" with a green check.
- [ ] In View Tasks: Done, Mark as Not Done (⌘D) on "Try a new note-taking app" brings it back without the Cancelled tag. With Cancel Task set to Move to List and Complete, a completed task in the Cancel List opens a form asking for the list to move it to.
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
- [ ] Show Journal on "Broken: text before the first journal entry" shows the warning as the first row.
- [ ] Cancel Task on "Cancel me (repeats daily)": in 2Do, the completed copy is tagged Cancelled, and the next occurrence isn't.
- [ ] With Cancel Task set to Delete, cancelling "Water the plants (repeats weekly)" asks "Delete this occurrence…?".
- [ ] Set Cancel Tag to a tag that doesn't exist, then cancel: the toast explains, and nothing changes.
- [ ] Set Goal Tag to a tag that doesn't exist, then save a goal: the toast explains, and nothing changes.
- [ ] Set Ambiguous Dates to Day First: "Run 20 km (ambiguous slash and dotted dates)" keeps "8/20 km", but its "+3 today" disappears, because today's slash date now reads as a different day. Set it back to Month First afterwards.
