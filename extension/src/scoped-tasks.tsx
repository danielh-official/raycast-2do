import { Action, ActionPanel, Cache, Icon, List } from "@raycast/api";
import { useCachedPromise, usePromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { List as TwoDoList, SmartList, Tag, Task, twoDo } from "./2do";
import { TaskItem } from "./task-item";

export type Scope = { focus: string; include_completed: boolean; paused_filter?: "only" };

type Filter = { value: string; title: string; match: (t: Task) => boolean };
type SmartListTasks = SmartList & { task_ids: string[] };

const cache = new Cache();
const SMART_LISTS_REFRESH = 10 * 60_000;

async function smartListTaskIds(smartListId: string, scope: Scope) {
  const { tasks } = await twoDo<{ tasks: Task[] }>("query_tasks", {
    smart_list_id: smartListId,
    include_completed: scope.include_completed,
    // Smart lists leave out paused tasks unless asked.
    ...(scope.paused_filter && { paused_filter: "include" }),
    limit: 200,
  });
  return tasks.map((t) => t.task_id);
}

// One 2Do scope, optionally cut down by `where`, then narrowed from the dropdown. 2Do can't query a
// scope and a list together, so lists filter by the task's list, and smart lists by the task IDs a
// separate query of each smart list returns. The dropdown offers only filters with tasks in scope.
// Querying every smart list is slow with many of them, so their task IDs are cached per scope and
// refreshed when a command opens at most every 10 minutes, or after a task action. A smart list
// picked in the dropdown is always queried fresh, so its filtering is never stale.
// With `byPausedTag`, a Filter by Paused Tag action narrows to one paused tag first, since Raycast
// allows only one dropdown; the dropdown then offers the lists with tasks under that tag.
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
  const [pausedTagId, setPausedTagId] = useState<string>();
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
  const cacheKey = `smart-lists:${JSON.stringify(scope)}`;
  const cached = useMemo(() => {
    const json = cache.get(cacheKey);
    return json ? (JSON.parse(json) as { at: number; lists: SmartListTasks[] }) : undefined;
  }, [cacheKey]);
  const smartLists = usePromise(
    async (scope: Scope): Promise<SmartListTasks[]> => {
      const { smart_lists } = await twoDo<{ smart_lists: SmartList[] }>("list_smart_lists");
      return Promise.all(
        smart_lists.map(async (l) => ({ ...l, task_ids: await smartListTaskIds(l.smart_list_id, scope) })),
      );
    },
    [scope],
    {
      execute: !cached || Date.now() - cached.at > SMART_LISTS_REFRESH,
      onData: (lists) => cache.set(cacheKey, JSON.stringify({ at: Date.now(), lists })),
    },
  );
  const smartListData = smartLists.data ?? cached?.lists ?? [];
  const picked = filter.startsWith("smart-list:") ? smartListData.find((l) => l.collection_id === filter) : undefined;
  const pickedTasks = usePromise(smartListTaskIds, [picked?.smart_list_id ?? "", scope], { execute: !!picked });

  const scoped = (tasks.data ?? []).filter((t) => where(t));
  const hasTag = (tagId: string) => (t: Task) => t.tags.some((x) => x.tag_id === tagId);
  // A paused tag whose last task left the scope falls back to all paused tags.
  const tagsInScope = (pausedTags.data ?? []).filter((tag) => scoped.some(hasTag(tag.tag_id)));
  const pausedTag = tagsInScope.find((tag) => tag.tag_id === pausedTagId);
  const inScope = pausedTag ? scoped.filter(hasTag(pausedTag.tag_id)) : scoped;
  const sections: [string, Filter[]][] = [
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
      smartListData.map((l) => {
        const ids = l === picked && pickedTasks.data ? pickedTasks.data : l.task_ids;
        return { value: l.collection_id, title: l.title, match: (t: Task) => ids.includes(t.task_id) };
      }),
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
    if (picked) pickedTasks.revalidate();
  }

  const tagFilter = tagsInScope.length > 0 && (
    <ActionPanel.Submenu title="Filter by Paused Tag" icon={Icon.Tag} shortcut={{ modifiers: ["cmd"], key: "t" }}>
      <Action
        title="All Paused Tags"
        icon={pausedTag ? Icon.Tag : Icon.Checkmark}
        onAction={() => setPausedTagId(undefined)}
      />
      {tagsInScope.map((tag) => (
        <Action
          key={tag.tag_id}
          title={tag.title}
          icon={tag === pausedTag ? Icon.Checkmark : Icon.Tag}
          onAction={() => setPausedTagId(tag.tag_id)}
        />
      ))}
    </ActionPanel.Submenu>
  );

  return (
    <List
      navigationTitle={pausedTag ? `View Tasks: Paused (${pausedTag.title})` : undefined}
      isLoading={
        tasks.isLoading || lists.isLoading || smartLists.isLoading || pickedTasks.isLoading || pausedTags.isLoading
      }
      searchBarPlaceholder="Filter tasks"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" value={active?.value ?? "all"} onChange={setFilter}>
          <List.Dropdown.Item value="all" title="All Lists" icon={Icon.Tray} />
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
        <TaskItem key={t.task_id} task={t} onChange={reload} extraActions={tagFilter || undefined} />
      ))}
    </List>
  );
}
