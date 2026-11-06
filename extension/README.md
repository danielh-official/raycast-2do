# 2Do

Add, browse, and edit [2Do](https://www.2doapp.com) tasks from Raycast.

> [!NOTE]
> This is a community extension. It is not made, endorsed, or supported by Beehive Innovations, the developer of 2Do.

## Requirements

- macOS with the 2Do Mac app installed (direct download or Setapp).
- A 2Do version that includes the AppleScript Automation Suite. Tested with 2Do 2026.4.3. With an older 2Do, commands say to update it.

## Setup

The first time a command talks to 2Do, macOS asks whether Raycast may control 2Do. Click **Allow**.

If you clicked **Don't Allow**, turn it back on in **System Settings → Privacy & Security → Automation → Raycast → 2Do**.

## Commands

### Add Task

Create a task with a title, notes, action, list, start and due dates (with optional times), priority, star, and tags. The list you pick is remembered for next time.

Check **Repeat** to make the task repeat: daily, on weekdays, weekly (optionally on chosen days), monthly (optionally on, say, the second Tuesday), yearly, or every so many days, weeks, months or years. Choose whether it repeats from the due date or from when you complete it, and whether it ends after a number of times or on a date. A repeating task with no start or due date starts today.

For tags not in 2Do yet, type their names in **New Tags**, separated by commas. Saving creates them in 2Do. A name that matches an existing tag, in any letter case, uses that tag instead of creating another.

The action is 2Do's one-tap task action: **Link** (a URL), **Call** or **Message** (a phone number), **Email** (an address), **Visit** (a place, opened in Maps), or **Google** (search terms). Edit Task changes or removes it.

### Add Link

Enter a web address and continue to the task form, with the address as the title. Check **Read page title and description** to read the page first: the task form then opens with the page title as the task title and the page's description (if it has one) in the notes. The checkbox remembers its last setting.

Some sites (Goodreads, for example) block automated reading. Keep a browser open with the [Raycast browser extension](https://www.raycast.com/browser-extension) (Raycast Companion) installed and enabled to get past those blocks. If reading fails, a toast says why.

Either way, the task form opens with the address as the task's Link action, so 2Do can open it.

### View Tasks

Browse tasks by scope: All, Today, Starred, Scheduled, Done, any list, or any smart list. Type to filter by title, notes, tag, or link.

Repeating tasks show a repeat icon whose tooltip gives the rule, like "Every 3 days" or "Weekly on Mon, Fri".

⌘L runs the task's 2Do action: it opens the link, calls or messages the number (through FaceTime or Messages), starts an email, opens the place in Maps, or searches Google. A task with no action opens the first link in its notes instead. An icon shows which kind of action a task has. Choose Link lists every link, from the action and the notes.

| Action                              | Shortcut |
| ----------------------------------- | -------- |
| Edit Task                           | ↵        |
| Run Action (or open the first link) | ⌘L       |
| Choose Link (2 or more)             | ⇧⌘L      |
| Complete / Mark as Not Done         | ⌘D       |
| Cancel Task                         | ⇧⌘D      |
| Log Progress (goals)                | ⌘G       |
| Add Journal Entry                   | ⌘J       |
| Show Journal                        | ⇧⌘J      |
| Star / Unstar                       | ⌘.       |
| Open in 2Do                         | ⌘O       |

### Goals

Track progress toward a number on any task, like pages read or kilometers run. 2Do has no goals of its own, so the extension keeps them in the task's notes, readable in 2Do on any device:

```
@goal: 32 pages

November 6, 2026: 10
2026-11-05 2 pm - -1
November 4, 2026: 4

@endgoal
```

Each line is a date, then `:` or `-`, then an amount; a negative number corrects a mistake. Dates can be in any common format, like `2026-11-05`, `Nov 6, 2026` or `6 Nov 2026`, with or without a time. Ambiguous dates like `05/11/2026` follow your Mac's region. Lines with times count toward their day.

The extension writes one date-only line per day, newest first, in the **Goal Date Format** preference ("November 6, 2026" by default). It never rewrites lines you typed: logging adds to that day's date-only line, or adds one. The rest of the notes are left alone.

- **Make a goal:** check **Add a goal** in Add Task or Edit Task, and fill in **Total**, **Units** and, optionally, **Current**. When Current is above 0, **Last Completed** sets its date (today by default). The task also gets the **Goal** tag, which is created in 2Do if needed. Its name is set in the extension's preferences.
- **Change a goal:** Edit Task changes Total and Units, keeping its history. Unchecking **Add a goal** removes the goal and its history, after asking.
- **Log Progress (⌘G):** add an amount for a day (today by default). Logging twice on one day adds to that day's date-only line. When the total is reached, a toast offers to complete the task.
- **In task lists:** a goal task shows a progress ring, with today's share in a second color, and "13/32 pages".

### Journal

Keep timestamped notes on a task, like a call log. They live in a block in the task's notes, newest first:

```
@journal

November 6, 2026 11:00 am - Called the president, went to voicemail
November 5, 2026 2:00 pm

Called again, discussed policy.
They'll send the paperwork.

@endjournal
```

An entry starts with a date and optional time in any common format. Short entries put the text after `-` on the same line. Longer ones put the timestamp on its own line, with the text below. No tag is involved.

- **Add Journal Entry (⌘J):** on any task. Write the entry and pick when it happened (now by default). Leave the time out for a date-only entry. The entry is written in the **Journal Date Format** preference ("November 6, 2026 2:05 pm" by default) and slotted in by time. Lines you typed are never rewritten.
- **Show Journal (⇧⌘J):** reads a task's entries, newest first. Tasks with a journal show a book icon.

Edit Task's Notes field leaves out the goal and journal blocks and saves them as they are, after the rest of the notes. Use Log Progress and Add Journal Entry to change them.

### View Tasks: Today, Now, Later Today, Starred, Scheduled, Paused, Goals, Done

One command per scope, so you can open it straight from Raycast's root search or give it a hotkey. Each has the same task actions as View Tasks. Its dropdown narrows the scope to one list or smart list, and only offers those that contain at least one of the scope's tasks.

- **Now** is today's tasks that have started: no start time, or a start time that has passed. **Later Today** is the rest of today's tasks.
- **Paused** is the tasks hidden by paused tags. Its dropdown can also narrow to one paused tag.
- **Goals** is the open tasks with a goal in their notes.

### Cancel Task

By default, Cancel Task follows 2Do's convention: it adds the **Cancelled** tag and completes the task, so it shows in Done with an ✕ instead of a check. Change what it does in the extension's preferences:

- **Cancel Task:** Complete and Tag (default), Tag Only, Move to List and Complete, or Delete. Delete always asks first.
- **Cancel Tag:** the tag to add (default "Cancelled"). If it doesn't exist yet, it's created in 2Do the first time a task is cancelled.
- **Cancel List:** the list to move cancelled tasks to, for Move to List and Complete.

Cancelling a project or checklist that still has open subtasks asks first, because completing it completes them too.
