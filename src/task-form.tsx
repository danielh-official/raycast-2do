import { Action, ActionPanel, Form, showHUD, showToast, Toast, useNavigation } from "@raycast/api";
import { FormValidation, showFailureToast, useCachedPromise, useForm } from "@raycast/utils";
import { List, Tag, Task, twoDo } from "./2do";

type Values = {
  title: string;
  notes: string;
  list_id: string;
  start: Date | null;
  due: Date | null;
  priority: string;
  starred: boolean;
  tag_ids: string[];
};

const pad = (n: number) => String(n).padStart(2, "0");

// 2Do takes floating local "yyyy-MM-dd" dates and optional "HH:mm" times. null clears (edit only).
function dateFields(prefix: "start" | "due", d: Date | null, clear: boolean) {
  const empty = clear ? { [`${prefix}_date`]: null, [`${prefix}_time`]: null } : {};
  if (!d) return empty;
  // ponytail: midnight counts as "no time" so untimed 2Do dates round-trip; a task timed at exactly 00:00 loses its time
  const fullDay = Form.DatePicker.isFullDay(d) || (d.getHours() === 0 && d.getMinutes() === 0);
  return {
    ...empty,
    [`${prefix}_date`]: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    ...(!fullDay && { [`${prefix}_time`]: `${pad(d.getHours())}:${pad(d.getMinutes())}` }),
  };
}

function toDate(date?: string, time?: string) {
  return date ? new Date(`${date}T${time ?? "00:00"}`) : null;
}

// Creates a task, or edits `task` when given.
export function TaskForm({ task, onSaved }: { task?: Task; onSaved?: () => void }) {
  const { pop } = useNavigation();
  const lists = useCachedPromise(() => twoDo<{ list: List[] }>("list_lists").then((r) => r.list));
  const tags = useCachedPromise(() => twoDo<{ tags: Tag[] }>("list_tags").then((r) => r.tags));

  const { handleSubmit, itemProps } = useForm<Values>({
    initialValues: task && {
      title: task.title,
      notes: task.notes,
      list_id: task.list_id,
      start: toDate(task.start_date, task.start_time),
      due: toDate(task.due_date, task.due_time),
      priority: task.priority,
      starred: task.starred,
      tag_ids: task.tags.map((t) => t.tag_id),
    },
    validation: { title: FormValidation.Required },
    async onSubmit(v) {
      const fields = {
        title: v.title,
        priority: v.priority,
        starred: v.starred,
        ...dateFields("start", v.start, !!task),
        ...dateFields("due", v.due, !!task),
      };
      try {
        if (task) {
          await twoDo("update_task", {
            ...fields,
            task_id: task.task_id,
            notes: v.notes,
            tag_update: { operation: "set", tag_ids: v.tag_ids },
          });
          if (v.list_id !== task.list_id) await twoDo("move_task", { task_id: task.task_id, list_id: v.list_id });
          await showToast({ style: Toast.Style.Success, title: "Task updated" });
          onSaved?.();
          pop();
        } else {
          await twoDo("create_task", {
            ...fields,
            list_id: v.list_id,
            notes: v.notes || undefined,
            ...(v.tag_ids.length > 0 && { tag_update: { operation: "set", tag_ids: v.tag_ids } }),
          });
          await showHUD(`Added "${v.title}" to 2Do`);
        }
      } catch (error) {
        await showFailureToast(error, { title: task ? "Could not update task" : "Could not add task" });
      }
    },
  });

  return (
    <Form
      isLoading={lists.isLoading || tags.isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={task ? "Save Task" : "Add Task"} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Title" placeholder="Task" {...itemProps.title} />
      <Form.TextArea title="Notes" {...itemProps.notes} />
      <Form.Dropdown title="List" storeValue={!task} {...itemProps.list_id}>
        {lists.data?.map((l) => <Form.Dropdown.Item key={l.list_id} value={l.list_id} title={l.title} />)}
      </Form.Dropdown>
      <Form.DatePicker title="Start" {...itemProps.start} />
      <Form.DatePicker title="Due" {...itemProps.due} />
      <Form.Dropdown title="Priority" {...itemProps.priority}>
        <Form.Dropdown.Item value="none" title="None" />
        <Form.Dropdown.Item value="low" title="Low" />
        <Form.Dropdown.Item value="medium" title="Medium" />
        <Form.Dropdown.Item value="high" title="High" />
      </Form.Dropdown>
      <Form.Checkbox label="Starred" {...itemProps.starred} />
      <Form.TagPicker title="Tags" {...itemProps.tag_ids}>
        {tags.data?.map((t) => <Form.TagPicker.Item key={t.tag_id} value={t.tag_id} title={t.title} />)}
      </Form.TagPicker>
    </Form>
  );
}
