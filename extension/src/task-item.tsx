import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  environment,
  getPreferenceValues,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import {
  actionURL,
  CancelPrefs,
  cancelTask,
  isCancelled,
  isRepeating,
  repeatRule,
  Task,
  taskLinks,
  twoDo,
  ymd,
} from "./2do";
import { goalProgress, parseGoal } from "./goal";
import { parseJournal } from "./journal";
import { AddJournalEntryForm, JournalView } from "./journal-view";
import { ItemsView } from "./items-view";
import { GoalProgressView, LogProgressForm } from "./log-progress";
import { TaskForm } from "./task-form";
import { checkNotes, fixNotes } from "./notes";
import { dayFirst } from "./preferences";

// A progress ring like getProgressIcon's, with today's share of the progress in a second color.
function goalIcon(done: number, today: number, total: number) {
  const share = (n: number) => Math.max(0, Math.min(1, n / total));
  const todayShare = Math.min(share(done), share(today));
  const before = share(done) - todayShare;
  const r = 40;
  const c = 2 * Math.PI * r;
  const arc = (from: number, length: number, color: string) =>
    length > 0
      ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-dasharray="${length * c} ${c}" stroke-dashoffset="${-from * c}" transform="rotate(-90 50 50)" />`
      : "";
  const track = environment.appearance === "light" ? "black" : "white";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100px" height="100px"><circle cx="50" cy="50" r="${r}" fill="none" stroke="${track}" stroke-width="10" opacity="0.1" />${arc(0, before, Color.Green)}${arc(before, todayShare, Color.Blue)}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const PRIORITY_TAGS = {
  high: { value: "High", color: Color.Red },
  medium: { value: "Medium", color: Color.Orange },
  low: { value: "Low", color: Color.Blue },
};

// Projects and checklists keep their type icon even when they're goals.
const PARENT_ICONS = { project: Icon.Folder, checklist: Icon.CheckList };

// The ⌘L action for each 2Do action type.
const RUN_ACTION: Record<string, { title: string; icon: Icon }> = {
  url: { title: "Open Link", icon: Icon.Link },
  call: { title: "Call", icon: Icon.Phone },
  message: { title: "Send Message", icon: Icon.Message },
  mail: { title: "Send Email", icon: Icon.Envelope },
  visit: { title: "Open in Maps", icon: Icon.Map },
  google: { title: "Search Google", icon: Icon.MagnifyingGlass },
};

// A task row with its actions. `onChange` reloads the list after an action changes the task.
// `parentId` is set for a project's or checklist's items.
export function TaskItem({ task: t, parentId, onChange }: { task: Task; parentId?: string; onChange: () => void }) {
  const prefs = getPreferenceValues<CancelPrefs>();
  const links = taskLinks(t);
  const actionTarget = actionURL(t.action);
  const primary = actionTarget
    ? { ...RUN_ACTION[t.action.type], target: actionTarget, value: t.action.value }
    : links[0] && { ...RUN_ACTION.url, target: links[0], value: links[0] };
  const goal = parseGoal(t.notes, dayFirst());
  const progress = goal && goalProgress(goal, ymd(new Date()));
  const journal = parseJournal(t.notes, dayFirst());
  const issues = checkNotes(t.notes, dayFirst());
  const repeat = repeatRule(t);

  async function fixSyntax() {
    try {
      const { task: fresh } = await twoDo<{ task: Task }>("get_task", { task_id: t.task_id });
      const fixable = checkNotes(fresh.notes, dayFirst()).filter((i) => i.fixable);
      if (!fixable.length) return showToast({ style: Toast.Style.Success, title: "Nothing to fix" });
      const ok = await confirmAlert({
        title: "Fix the notes' syntax?",
        message: `${fixable.map((i) => i.message).join("\n")}\n\nFixing adds the missing end line.`,
        primaryAction: { title: "Fix" },
      });
      if (!ok) return;
      await twoDo("update_task", { task_id: t.task_id, notes: fixNotes(fresh.notes, dayFirst()) });
      await showToast({ style: Toast.Style.Success, title: "Syntax fixed" });
      onChange();
    } catch (error) {
      await showFailureToast(error, { title: "Could not fix the syntax" });
    }
  }

  async function run(title: string, command: string, args: object) {
    try {
      await twoDo(command, args);
      await showToast({ style: Toast.Style.Success, title });
      onChange();
    } catch (error) {
      await showFailureToast(error, { title: "2Do command failed" });
    }
  }

  async function cancel() {
    const deletes = prefs.cancelBehavior === "delete";
    try {
      if (deletes) {
        const ok = await confirmAlert({
          title: isRepeating(t) ? `Delete this occurrence of "${t.title}"?` : `Delete "${t.title}"?`,
          message: isRepeating(t)
            ? "Cancel Task is set to delete tasks. This occurrence is deleted and the next one stays. This can't be undone from Raycast."
            : "Cancel Task is set to delete tasks. This can't be undone from Raycast.",
          primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
        });
        if (!ok) return;
      } else if (prefs.cancelBehavior !== "tag" && t.task_type !== "normal") {
        const { tasks: subtasks } = await twoDo<{ tasks: Task[] }>("list_subtasks", { task_id: t.task_id });
        const open = subtasks.filter((s) => !s.completed).length;
        const ok =
          open === 0 ||
          (await confirmAlert({
            title: `Cancel "${t.title}"?`,
            message: `Its ${open === 1 ? "open subtask" : `${open} open subtasks`} will be completed too.`,
            primaryAction: { title: "Cancel Task" },
            dismissAction: { title: "Keep Task" },
          }));
        if (!ok) return;
      }
      await cancelTask(t, prefs);
      await showToast({ style: Toast.Style.Success, title: deletes ? "Deleted" : "Cancelled" });
      onChange();
    } catch (error) {
      await showFailureToast(error, { title: "Could not cancel task" });
    }
  }

  return (
    <List.Item
      title={t.title}
      subtitle={t.list_title}
      keywords={[t.notes, ...t.tags.map((tag) => tag.title), ...links, ...(t.action.value ? [t.action.value] : [])]}
      icon={
        isCancelled(t, prefs)
          ? { source: Icon.XMarkCircle, tintColor: Color.SecondaryText }
          : t.completed
            ? { source: Icon.CheckCircle, tintColor: Color.Green }
            : t.task_type !== "normal"
              ? { source: PARENT_ICONS[t.task_type], tooltip: t.task_type === "project" ? "Project" : "Checklist" }
              : goal && progress
                ? goalIcon(progress.done, progress.today, goal.total)
                : Icon.Circle
      }
      accessories={[
        ...(issues.length
          ? [
              {
                icon: { source: Icon.Warning, tintColor: Color.Orange },
                tooltip: issues.map((i) => i.message).join("\n"),
              },
            ]
          : []),
        ...(goal && progress
          ? [
              {
                text: `${progress.done}/${goal.total}${goal.unit ? ` ${goal.unit}` : ""}`,
                tooltip: progress.today ? `${progress.today > 0 ? "+" : ""}${progress.today} today` : undefined,
              },
            ]
          : []),
        ...t.tags.map((tag) => ({ tag: tag.title })),
        ...(t.priority !== "none" ? [{ tag: PRIORITY_TAGS[t.priority] }] : []),
        ...(t.presentation.due_date_formatted
          ? [
              {
                text: {
                  value: t.presentation.due_date_formatted,
                  color: t.presentation.is_overdue ? Color.Red : undefined,
                },
              },
            ]
          : []),
        ...(primary ? [{ icon: primary.icon, tooltip: `${primary.title}: ${primary.value}` }] : []),
        ...(journal?.length
          ? [{ icon: Icon.Book, tooltip: `${journal.length} journal ${journal.length === 1 ? "entry" : "entries"}` }]
          : []),
        ...(repeat ? [{ icon: Icon.Repeat, tooltip: `Repeats: ${repeat}` }] : []),
        ...(t.starred ? [{ icon: { source: Icon.Star, tintColor: Color.Yellow } }] : []),
      ]}
      actions={
        <ActionPanel>
          <Action.Push
            title="Edit Task"
            icon={Icon.Pencil}
            target={<TaskForm task={t} parentId={parentId} onSaved={onChange} />}
          />
          {t.task_type !== "normal" && (
            <Action.Push
              title="Show Items"
              icon={Icon.List}
              shortcut={{ modifiers: ["cmd"], key: "i" }}
              target={<ItemsView parent={t} onChange={onChange} />}
            />
          )}
          {goal && (
            <Action.Push
              title="Log Progress"
              icon={Icon.PlusCircle}
              shortcut={{ modifiers: ["cmd"], key: "g" }}
              target={<LogProgressForm task={t} onLogged={onChange} />}
            />
          )}
          {goal && (
            <Action.Push
              title="Show Progress"
              icon={Icon.LineChart}
              shortcut={{ modifiers: ["cmd", "shift"], key: "g" }}
              target={<GoalProgressView task={t} onChange={onChange} />}
            />
          )}
          <Action.Push
            title="Add Journal Entry"
            icon={Icon.Book}
            shortcut={{ modifiers: ["cmd"], key: "j" }}
            target={<AddJournalEntryForm task={t} onAdded={onChange} />}
          />
          {issues.some((i) => i.fixable) && (
            <Action title="Fix Goal and Journal Syntax" icon={Icon.WrenchScrewdriver} onAction={fixSyntax} />
          )}
          {journal?.length ? (
            <Action.Push
              title="Show Journal"
              icon={Icon.List}
              shortcut={{ modifiers: ["cmd", "shift"], key: "j" }}
              target={<JournalView task={t} onChange={onChange} />}
            />
          ) : null}
          {primary && (
            <Action.Open
              title={primary.title}
              icon={primary.icon}
              target={primary.target}
              shortcut={{ modifiers: ["cmd"], key: "l" }}
            />
          )}
          {links.length > 1 && (
            <ActionPanel.Submenu
              title="Choose Link"
              icon={Icon.Link}
              shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
            >
              {links.map((url) => (
                <Action.OpenInBrowser key={url} title={url} url={url} />
              ))}
            </ActionPanel.Submenu>
          )}
          <Action
            title={t.completed ? "Mark as Not Done" : "Complete Task"}
            icon={t.completed ? Icon.Circle : Icon.CheckCircle}
            shortcut={{ modifiers: ["cmd"], key: "d" }}
            onAction={() =>
              run(t.completed ? "Marked not done" : "Completed", t.completed ? "uncomplete_task" : "complete_task", {
                task_id: t.task_id,
              })
            }
          />
          {!t.completed && (
            <Action
              title="Cancel Task"
              icon={Icon.XMarkCircle}
              shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
              onAction={cancel}
            />
          )}
          <Action
            title={t.starred ? "Unstar" : "Star"}
            icon={Icon.Star}
            shortcut={Keyboard.Shortcut.Common.Pin}
            onAction={() =>
              run(t.starred ? "Unstarred" : "Starred", "update_task", { task_id: t.task_id, starred: !t.starred })
            }
          />
          <Action
            title="Open in 2Do"
            icon={Icon.AppWindow}
            shortcut={Keyboard.Shortcut.Common.Open}
            onAction={() => twoDo("open_task", { task_id: t.task_id }).catch((e) => showFailureToast(e))}
          />
        </ActionPanel>
      }
    />
  );
}
