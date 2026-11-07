# Release Schedule

Which work on `main` goes to the Store, and when. The process is in [AGENTS.md](AGENTS.md#releases).

## Releases

### Initial Version (released 2026-11-01)

The Store's current version: [raycast/extensions#32601](https://github.com/raycast/extensions/pull/32601), published from `ba15ea2`, plus the Store's own edits pulled back as `de83d50` (the CHANGELOG date and compressed images). The `release` branch starts at `de83d50`, and `main`'s work follows it directly.

### Second Release (planned)

**Links and actions:**

- **Add Link** command: create a task from a web address, optionally reading the page's title and description.
- An **Action** field in Add Task and Edit Task, for any 2Do action: link, call, message, email, visit, or Google search.
- Running a task's action from View Tasks (⌘L), and choosing from all of its links (⇧⌘L).

Commits: `5d0877f`, `1812caf`, `bf53e28`, `f5e15b2`, `99da5b1`.

Why this cut: they're the first commits after the Initial Version, so they apply on the `release` branch without the later work. They depend on nothing else, share one theme, and add about 375 lines over 9 extension files. Everything else on `main` is about 3,100 lines over 31 files.

Checked with a dry run on `de83d50`: all five cherry-pick cleanly. They add their CHANGELOG lines to the Initial Version section, written before the Store merge, so those lines move to a new section, and the first one brings `PLAN.md`, which stays on `main`.

### Later releases (not yet scheduled)

Remaining features, in an order that respects their dependencies:

| Feature                 | Depends on                              |
| ----------------------- | --------------------------------------- |
| Clear 2Do errors        | nothing                                 |
| Cancel Task             | nothing (its later commits: `TaskItem`) |
| Scoped View Tasks       | nothing                                 |
| Deadlines               | Scoped View Tasks                       |
| Goals and journal notes | Goals                                   |
| Goals                   | `TaskItem`                              |
| Journal                 | Goals, Goals and journal notes          |
| New Tags                | nothing                                 |
| Projects and checklists | Cancel Task, `TaskItem`                 |
| Repeating tasks         | Cancel Task, `TaskItem`                 |

- `TaskItem` is the task row, split out of View Tasks by `309565e` (Scoped View Tasks). Nearly every commit after it edits `task-item.tsx`, so `309565e` ships with the first release that needs it.
- "Goals and journal notes" is the plumbing Goals and Journal share: date parsing, hiding their blocks in Edit Task, and syntax warnings. It ships with Goals.
- Features after Links and actions were built on top of each other, so their commits edit the same files (`2do.ts`, `task-form.tsx`, `task-item.tsx`, the README and CHANGELOG). Cherry-picking them out of order means resolving conflicts by hand.

## Feature x Commit Map

Every commit on `main` after the Initial Version, oldest first. Commits that change only planning docs, screenshots, or test tooling don't ship to the Store.

| Commit    | Subject                                                                               | Feature(s)                                 |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| `5d0877f` | Add 'Add Link' command to create tasks from web pages                                 | Links and actions                          |
| `1812caf` | Enhance 'Add Link' command functionality and documentation                            | Links and actions                          |
| `bf53e28` | Add link field to the task form                                                       | Links and actions                          |
| `f5e15b2` | Open task links from View Tasks                                                       | Links and actions                          |
| `99da5b1` | Configure any 2Do action in the task form                                             | Links and actions                          |
| `fa4d8c1` | Add Cancel Task action with configurable behavior                                     | Cancel Task                                |
| `309565e` | Extract the task row into TaskItem                                                    | Scoped View Tasks                          |
| `76ace8c` | Add View Tasks: Today command                                                         | Scoped View Tasks                          |
| `2cb13f1` | Add View Tasks: Starred command                                                       | Scoped View Tasks                          |
| `7e27c42` | Add View Tasks: Scheduled command                                                     | Scoped View Tasks                          |
| `e6d7878` | Add View Tasks: Done command                                                          | Scoped View Tasks                          |
| `59756b7` | Add View Tasks: Now command                                                           | Scoped View Tasks                          |
| `aff0e50` | Add View Tasks: Later Today command                                                   | Scoped View Tasks                          |
| `affff25` | Add View Tasks: Paused command                                                        | Scoped View Tasks                          |
| `a3c3b86` | Document the scoped View Tasks commands                                               | Scoped View Tasks                          |
| `a43b689` | Add goals tracked in task notes                                                       | Goals                                      |
| `93ea8e1` | Read goal entries in any common date format                                           | Goals and journal notes                    |
| `682c38e` | Default goal dates to the full month name                                             | Goals                                      |
| `583fddd` | Add a journal of timestamped entries in task notes                                    | Journal                                    |
| `17941a9` | Hide goal and journal blocks from Edit Task notes                                     | Goals and journal notes                    |
| `6b2e4aa` | Show journal dates with weekday and relative time                                     | Journal                                    |
| `d53b206` | Hide the current year in journal display dates                                        | Journal                                    |
| `7cd6788` | Use only the topmost goal and journal blocks; make the goal tag optional              | Goals and journal notes, Goals             |
| `30c067d` | Update CHANGELOG.md                                                                   | Changelog only                             |
| `560807e` | Require existing tags instead of creating them; restructure CHANGELOG                 | Goals, Cancel Task                         |
| `5c41657` | Read ambiguous dates from a preference, not the Mac's region                          | Goals and journal notes                    |
| `4828e9c` | Explain when 2Do is too old or not installed                                          | Clear 2Do errors                           |
| `bafd017` | Read dotted dates day first                                                           | Goals and journal notes                    |
| `10ca670` | Refresh smart-list results at most every 10 minutes                                   | Scoped View Tasks                          |
| `1cd4fe7` | Warn about broken goal and journal syntax, and offer a fix                            | Goals and journal notes                    |
| `3936f0a` | Add SCREENSHOTS.md checklist for Store screenshots                                    | Not shipped: screenshots                   |
| `8eff807` | Cancel only this occurrence of a repeating task; plan repeating, projects, checklists | Cancel Task, Repeating tasks               |
| `7d187ea` | Compare Edit Task saves against the task as it is in 2Do                              | Goals and journal notes, Links and actions |
| `43f7f81` | Add a live test suite against the real 2Do                                            | Not shipped: test tooling                  |
| `f7dd6f8` | Add Demo list scripts for Store screenshots                                           | Not shipped: screenshots                   |
| `7b9b9a1` | Put tasks inside a project or checklist from Add and Edit Task                        | Projects and checklists                    |
| `9b41511` | Show a goal's progress entries with Show Progress                                     | Goals                                      |
| `a5695ff` | Show folder and checklist icons for projects and checklists                           | Projects and checklists                    |
| `36e5ead` | Show a repeat icon with the rule on repeating tasks                                   | Repeating tasks                            |
| `2839bb9` | Add Show Items for projects and checklists                                            | Projects and checklists                    |
| `4884909` | Show item progress as a ring on projects and checklists                               | Projects and checklists                    |
| `3202c2d` | Ask whether to complete or cancel a parent's open items                               | Projects and checklists, Cancel Task       |
| `7efffb2` | Add items to projects and checklists                                                  | Projects and checklists                    |
| `900042a` | Create projects and checklists from Add Task                                          | Projects and checklists                    |
| `7279f20` | Ask how to complete a goal task that isn't reached or repeats                         | Goals, Repeating tasks                     |
| `5955647` | Show goal progress as a list of entries you can edit                                  | Goals                                      |
| `4f1c0e2` | Show the journal as a list of entries you can edit                                    | Journal                                    |
| `1e0cb3c` | Update the plan with answered questions and what's next                               | Not shipped: planning                      |
| `37bdaae` | Add a New Tags field for tags not in 2Do yet                                          | New Tags                                   |
| `feb8b92` | Filter View Tasks: Paused by a paused tag and a list together                         | Scoped View Tasks                          |
| `bb26d46` | Set how a task repeats in Add Task and Edit Task                                      | Repeating tasks                            |
| `8544b6d` | Fix cancelling a repeating task: search its list for the copy                         | Cancel Task, Repeating tasks               |
| `1c70b67` | Undo the cancel when marking a cancelled task not done                                | Cancel Task                                |
| `860c037` | Update the Paused screenshot note for Filter by Paused Tag                            | Not shipped: screenshots                   |
| `1bb740b` | Add View Tasks: Deadlines, overdue first, then by due date                            | Deadlines                                  |
| `8768988` | Plan: consider a release branch for Store PRs                                         | Not shipped: planning                      |
| `28ef584` | Add AGENTS.md file to reference PLAN.md                                               | Not shipped: planning                      |
| `67ddfc8` | Add a release schedule and the release process                                        | Not shipped: planning                      |
