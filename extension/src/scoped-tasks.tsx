import { Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { List as TwoDoList, SmartList, Tag, Task, twoDo } from "./2do";
import { TaskItem } from "./task-item";

export type Scope = { focus: string; include_completed: boolean; paused_filter?: "only" };

type Filter = { value: string; title: string; match: (t: Task) => boolean };

// One 2Do scope, optionally cut down by `where`, then narrowed from the dropdown. 2Do can't query a
// scope and a list together, so lists filter by the task's list, and smart lists by the task IDs a
// separate query of each smart list returns. The dropdown offers only filters with tasks in scope.
export function ScopedTasks({
  scope,
  where = () => true,
  byPausedTag = false,
}: {
  scope: Scope;
  where?: (t: Task) => boolean;
  byPausedTag?: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const tasks = useCachedPromise(
    // ponytail: capped at 200, as in View Tasks
    (scope: Scope) => twoDo<{ tasks: Task[] }>("query_tasks", { ...scope, limit: 200 }).then((r) => r.tasks),
    [scope],
  );
  const lists = useCachedPromise(() => twoDo<{ list: TwoDoList[] }>("list_lists").then((r) => r.list));
  const pausedTags = useCachedPromise(
    () => twoDo<{ tags: (Tag & { paused: boolean })[] }>("list_tags").then((r) => r.tags.filter((t) => t.paused)),
    [],
    { execute: byPausedTag },
  );
  const smartLists = useCachedPromise(
    async (scope: Scope) => {
      const { smart_lists } = await twoDo<{ smart_lists: SmartList[] }>("list_smart_lists");
      return Promise.all(
        smart_lists.map(async (l) => {
          const { tasks } = await twoDo<{ tasks: Task[] }>("query_tasks", {
            smart_list_id: l.smart_list_id,
            include_completed: scope.include_completed,
            ...(scope.paused_filter && { paused_filter: "include" }),
            limit: 200,
          });
          return { ...l, task_ids: tasks.map((t) => t.task_id) };
        }),
      );
    },
    [scope],
  );

  const inScope = (tasks.data ?? []).filter((t) => where(t));
  const sections: [string, Filter[]][] = [
    [
      "Paused Tags",
      (byPausedTag ? (pausedTags.data ?? []) : []).map((tag) => ({
        value: `tag:${tag.tag_id}`,
        title: tag.title,
        match: (t) => t.tags.some((x) => x.tag_id === tag.tag_id),
      })),
    ],
    [
      "Lists",
      (lists.data ?? []).map((l) => ({
        value: l.collection_id,
        title: l.title,
        match: (t) => t.list_id === l.list_id,
      })),
    ],
    [
      "Smart Lists",
      (smartLists.data ?? []).map((l) => ({
        value: l.collection_id,
        title: l.title,
        match: (t) => l.task_ids.includes(t.task_id),
      })),
    ],
  ];
  const offered = sections.map(([title, filters]): [string, Filter[]] => [
    title,
    filters.filter((f) => inScope.some(f.match)),
  ]);
  // A filter that no longer has tasks in scope (say, its last one was completed) falls back to all.
  const active = offered.flatMap(([, filters]) => filters).find((f) => f.value === filter);
  const shown = active ? inScope.filter(active.match) : inScope;

  function reload() {
    tasks.revalidate();
    smartLists.revalidate();
  }

  return (
    <List
      isLoading={tasks.isLoading || lists.isLoading || smartLists.isLoading || pausedTags.isLoading}
      searchBarPlaceholder="Filter tasks"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" value={active?.value ?? "all"} onChange={setFilter}>
          <List.Dropdown.Item value="all" title={byPausedTag ? "All Paused" : "All Lists"} icon={Icon.Tray} />
          {offered.map(
            ([title, filters]) =>
              filters.length > 0 && (
                <List.Dropdown.Section key={title} title={title}>
                  {filters.map((f) => (
                    <List.Dropdown.Item key={f.value} value={f.value} title={f.title} />
                  ))}
                </List.Dropdown.Section>
              ),
          )}
        </List.Dropdown>
      }
    >
      {!tasks.isLoading && <List.EmptyView icon={Icon.CheckCircle} title="No Tasks" />}
      {shown.map((t) => (
        <TaskItem key={t.task_id} task={t} onChange={reload} />
      ))}
    </List>
  );
}
