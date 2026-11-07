import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Form,
  getPreferenceValues,
  Icon,
  showHUD,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { FormValidation, showFailureToast, useCachedPromise, useForm } from "@raycast/utils";
import {
  ACTIONS,
  actionValueError,
  applyGoal,
  GoalPrefs,
  goalValueError,
  List,
  listParents,
  saveTask,
  Tag,
  tagOptions,
  Task,
  taskToValues,
  TaskValues,
  twoDo,
} from "./2do";
import { parseGoal } from "./goal";
import { PageInfo } from "./link";
import { checkNotes, joinNotes, splitNotes } from "./notes";
import { dayFirst } from "./preferences";

// Creates a task, or edits `task` when given. `link` prefills a new task from a web page, with
// the page as the task's link. `parentId` is the project or checklist an edited item is in.
// `addTo` adds a new item to that project or checklist; checklist items have no dates.
export function TaskForm({
  task,
  link,
  parentId,
  addTo,
  onSaved,
}: {
  task?: Task;
  link?: PageInfo & { url: string };
  parentId?: string;
  addTo?: Task;
  onSaved?: () => void;
}) {
  const { pop } = useNavigation();
  const lists = useCachedPromise(() => twoDo<{ list: List[] }>("list_lists").then((r) => r.list));
  const tags = useCachedPromise(() => twoDo<{ tags: Tag[] }>("list_tags").then((r) => r.tags));
  const hidden = task ? splitNotes(task.notes).blocks : [];
  const issues = task ? checkNotes(task.notes, dayFirst()) : [];

  const { handleSubmit, itemProps, values, setValue } = useForm<TaskValues>({
    initialValues: task
      ? { ...taskToValues(task), parent_id: parentId ?? "" }
      : {
          action_type: link ? "url" : "none",
          action_value: link?.url ?? "",
          parent_id: addTo?.task_id ?? "",
          task_type: "normal",
          ...(addTo && { list_id: addTo.list_id }),
          is_goal: false,
          goal_last: new Date(),
          ...(link && { title: link.title, notes: link.description }),
        },
    validation: {
      title: FormValidation.Required,
      action_value: (v): string | undefined => actionValueError(values.action_type, v),
      goal_total: (v): string | undefined => (values.is_goal ? goalValueError("total", v) : undefined),
      goal_current: (v): string | undefined => (values.is_goal ? goalValueError("current", v) : undefined),
    },
    async onSubmit(v) {
      try {
        // Compare and merge with the task as it is now, not as the list loaded it: the hidden blocks
        // keep progress or journal entries added since, and an action or list changed in 2Do since
        // still counts as changed when the form sets it back.
        const current = task && (await twoDo<{ task: Task }>("get_task", { task_id: task.task_id })).task;
        const blocks = current ? splitNotes(current.notes).blocks : [];
        const full = { ...v, notes: joinNotes(v.notes ?? "", blocks), ...(addTo && { parent_id: addTo.task_id }) };
        if (!v.is_goal && parseGoal(full.notes)) {
          const ok = await confirmAlert({
            title: "Remove the goal?",
            message: "Its progress history in the notes will be deleted.",
            primaryAction: { title: "Remove Goal", style: Alert.ActionStyle.Destructive },
          });
          if (!ok) return;
        }
        await saveTask(await applyGoal(full, getPreferenceValues<GoalPrefs>()), current, parentId);
        if (task || addTo) {
          await showToast({ style: Toast.Style.Success, title: task ? "Task updated" : "Item added" });
          onSaved?.();
          pop();
        } else {
          await showHUD(`Added "${v.title}" to 2Do`);
        }
      } catch (error) {
        await showFailureToast(error, { title: task ? "Could not update task" : "Could not add task" });
      }
    },
  });

  // A project or checklist put in another becomes a normal task in 2Do, so they aren't offered one.
  const canNest = !task || task.task_type === "normal";
  const parents = useCachedPromise(listParents, [values.list_id ?? ""], {
    execute: canNest && !addTo && !!values.list_id,
  });

  return (
    <Form
      navigationTitle={task ? "Edit Task" : addTo ? `Add Item to ${addTo.title}` : undefined}
      isLoading={lists.isLoading || tags.isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={task ? "Save Task" : addTo ? "Add Item" : "Add Task"} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      {issues.length > 0 && (
        <Form.Description
          title="⚠️ Notes Syntax"
          text={[
            ...issues.map((i) => i.message),
            ...(issues.some((i) => i.fixable)
              ? [
                  "Saving keeps the goal and journal as they are. To fix them, use Fix Goal and Journal Syntax on the task.",
                ]
              : []),
          ].join("\n")}
        />
      )}
      <Form.TextField title="Title" placeholder="Task" {...itemProps.title} />
      {!task && !addTo && (
        <Form.Dropdown title="Type" {...itemProps.task_type}>
          <Form.Dropdown.Item value="normal" title="Task" icon={Icon.Circle} />
          <Form.Dropdown.Item value="project" title="Project" icon={Icon.Folder} />
          <Form.Dropdown.Item value="checklist" title="Checklist" icon={Icon.CheckList} />
        </Form.Dropdown>
      )}
      <Form.TextArea
        title="Notes"
        placeholder="Notes"
        info={
          hidden.length
            ? "The goal and journal are kept out of this field and saved as they are. Update them with Log Progress and Add Journal Entry."
            : undefined
        }
        {...itemProps.notes}
      />
      {values.action_type !== undefined && (
        <Form.Dropdown title="Action" {...itemProps.action_type}>
          <Form.Dropdown.Item value="none" title="None" />
          {Object.entries(ACTIONS).map(([type, a]) => (
            <Form.Dropdown.Item key={type} value={type} title={a.title} />
          ))}
        </Form.Dropdown>
      )}
      {values.action_type && values.action_type !== "none" && (
        <Form.TextField
          title={ACTIONS[values.action_type].label}
          placeholder={ACTIONS[values.action_type].placeholder}
          {...itemProps.action_value}
        />
      )}
      {!addTo && (
        <Form.Dropdown
          title="List"
          storeValue={!task}
          {...itemProps.list_id}
          onChange={(listId) => {
            itemProps.list_id.onChange?.(listId);
            if (listId !== values.list_id) setValue("parent_id", "");
          }}
        >
          {lists.data?.map((l) => (
            <Form.Dropdown.Item key={l.list_id} value={l.list_id} title={l.title} />
          ))}
        </Form.Dropdown>
      )}
      {(parents.data?.length ?? 0) > 0 && (values.task_type ?? "normal") === "normal" && (
        <Form.Dropdown title="Project or Checklist" {...itemProps.parent_id}>
          <Form.Dropdown.Item value="" title="None" icon={Icon.Minus} />
          {parents.data?.map((p) => (
            <Form.Dropdown.Item
              key={p.task_id}
              value={p.task_id}
              title={p.title}
              icon={p.task_type === "project" ? Icon.Folder : Icon.CheckList}
            />
          ))}
        </Form.Dropdown>
      )}
      {addTo?.task_type !== "checklist" && (
        <>
          <Form.DatePicker title="Start" {...itemProps.start} />
          <Form.DatePicker title="Due" {...itemProps.due} />
        </>
      )}
      <Form.Dropdown title="Priority" {...itemProps.priority}>
        <Form.Dropdown.Item value="none" title="None" />
        <Form.Dropdown.Item value="low" title="Low" />
        <Form.Dropdown.Item value="medium" title="Medium" />
        <Form.Dropdown.Item value="high" title="High" />
      </Form.Dropdown>
      <Form.Checkbox label="Starred" {...itemProps.starred} />
      <Form.TagPicker title="Tags" {...itemProps.tag_ids}>
        {tagOptions(tags.data, task).map((t) => (
          <Form.TagPicker.Item key={t.tag_id} value={t.tag_id} title={t.title} />
        ))}
      </Form.TagPicker>
      <Form.Separator />
      <Form.Checkbox title="Goal" label="Add a goal" {...itemProps.is_goal} />
      {values.is_goal && (
        <>
          <Form.TextField title="Total" placeholder="32" {...itemProps.goal_total} />
          <Form.TextField title="Units" placeholder="pages" {...itemProps.goal_unit} />
          {!(task && parseGoal(task.notes)) && !parseGoal(values.notes ?? "") && (
            <>
              <Form.TextField title="Current" placeholder="0" {...itemProps.goal_current} />
              {Number(values.goal_current) > 0 && (
                <Form.DatePicker title="Last Completed" type={Form.DatePicker.Type.Date} {...itemProps.goal_last} />
              )}
            </>
          )}
        </>
      )}
    </Form>
  );
}
