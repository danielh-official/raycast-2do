import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  getPreferenceValues,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { showFailureToast, useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import {
  actionURL,
  CancelPrefs,
  cancelTask,
  isCancelled,
  List as TwoDoList,
  scopeArgs,
  SmartList,
  Task,
  taskLinks,
  twoDo,
} from "./2do";
import { TaskForm } from "./task-form";

const FOCUSES = [
  ["all", "All", Icon.Tray],
  ["today", "Today", Icon.Calendar],
  ["starred", "Starred", Icon.Star],
  ["scheduled", "Scheduled", Icon.Clock],
  ["done", "Done", Icon.CheckCircle],
] as const;

const PRIORITY_TAGS = {
  high: { value: "High", color: Color.Red },
  medium: { value: "Medium", color: Color.Orange },
  low: { value: "Low", color: Color.Blue },
};

// The ⌘L action for each 2Do action type.
const RUN_ACTION: Record<string, { title: string; icon: Icon }> = {
  url: { title: "Open Link", icon: Icon.Link },
  call: { title: "Call", icon: Icon.Phone },
  message: { title: "Send Message", icon: Icon.Message },
  mail: { title: "Send Email", icon: Icon.Envelope },
  visit: { title: "Open in Maps", icon: Icon.Map },
  google: { title: "Search Google", icon: Icon.MagnifyingGlass },
};

export default function Command() {
  const [scope, setScope] = useState<string>();
  const lists = useCachedPromise(() => twoDo<{ list: TwoDoList[] }>("list_lists").then((r) => r.list));
  const smartLists = useCachedPromise(() =>
    twoDo<{ smart_lists: SmartList[] }>("list_smart_lists").then((r) => r.smart_lists),
  );
  const tasks = useCachedPromise(
    // ponytail: capped at 200 (matters for Done); paginate with offset/total_count if that gets hit
    (scope: string) =>
      twoDo<{ tasks: Task[] }>("query_tasks", { ...scopeArgs(scope), limit: 200 }).then((r) => r.tasks),
    [scope ?? ""],
    { execute: !!scope },
  );

  async function run(title: string, command: string, args: object) {
    try {
      await twoDo(command, args);
      await showToast({ style: Toast.Style.Success, title });
      tasks.revalidate();
    } catch (error) {
      await showFailureToast(error, { title: "2Do command failed" });
    }
  }

  const prefs = getPreferenceValues<CancelPrefs>();

  async function cancel(t: Task) {
    const deletes = prefs.cancelBehavior === "delete";
    try {
      if (deletes) {
        const ok = await confirmAlert({
          title: `Delete "${t.title}"?`,
          message: "Cancel Task is set to delete tasks. This can't be undone from Raycast.",
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
      tasks.revalidate();
    } catch (error) {
      await showFailureToast(error, { title: "Could not cancel task" });
    }
  }

  return (
    <List
      isLoading={tasks.isLoading || lists.isLoading}
      searchBarPlaceholder="Filter tasks"
      searchBarAccessory={
        <List.Dropdown tooltip="Scope" storeValue onChange={setScope}>
          <List.Dropdown.Section>
            {FOCUSES.map(([id, title, icon]) => (
              <List.Dropdown.Item key={id} value={`focus:${id}`} title={title} icon={icon} />
            ))}
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Lists">
            {lists.data?.map((l) => (
              <List.Dropdown.Item key={l.collection_id} value={l.collection_id} title={l.title} />
            ))}
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Smart Lists">
            {smartLists.data?.map((l) => (
              <List.Dropdown.Item key={l.collection_id} value={l.collection_id} title={l.title} />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {!tasks.isLoading && <List.EmptyView icon={Icon.CheckCircle} title="No Tasks" />}
      {tasks.data?.map((t) => {
        const links = taskLinks(t);
        const actionTarget = actionURL(t.action);
        const primary = actionTarget
          ? { ...RUN_ACTION[t.action.type], target: actionTarget, value: t.action.value }
          : links[0] && { ...RUN_ACTION.url, target: links[0], value: links[0] };
        return (
          <List.Item
            key={t.task_id}
            title={t.title}
            subtitle={t.list_title}
            keywords={[
              t.notes,
              ...t.tags.map((tag) => tag.title),
              ...links,
              ...(t.action.value ? [t.action.value] : []),
            ]}
            icon={
              isCancelled(t, prefs)
                ? { source: Icon.XMarkCircle, tintColor: Color.SecondaryText }
                : t.completed
                  ? { source: Icon.CheckCircle, tintColor: Color.Green }
                  : Icon.Circle
            }
            accessories={[
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
              ...(t.starred ? [{ icon: { source: Icon.Star, tintColor: Color.Yellow } }] : []),
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Edit Task"
                  icon={Icon.Pencil}
                  target={<TaskForm task={t} onSaved={tasks.revalidate} />}
                />
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
                    run(
                      t.completed ? "Marked not done" : "Completed",
                      t.completed ? "uncomplete_task" : "complete_task",
                      {
                        task_id: t.task_id,
                      },
                    )
                  }
                />
                {!t.completed && (
                  <Action
                    title="Cancel Task"
                    icon={Icon.XMarkCircle}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
                    onAction={() => cancel(t)}
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
      })}
    </List>
  );
}
