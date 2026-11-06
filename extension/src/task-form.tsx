import { Action, ActionPanel, Form, showHUD, showToast, Toast, useNavigation } from "@raycast/api";
import { FormValidation, showFailureToast, useCachedPromise, useForm } from "@raycast/utils";
import { List, saveTask, Tag, tagOptions, Task, taskToValues, TaskValues, twoDo } from "./2do";
import { PageInfo } from "./link";

// Creates a task, or edits `task` when given. `link` prefills a new task from a web page, with
// the page as the task's link.
export function TaskForm({
  task,
  link,
  onSaved,
}: {
  task?: Task;
  link?: PageInfo & { url: string };
  onSaved?: () => void;
}) {
  const { pop } = useNavigation();
  const lists = useCachedPromise(() => twoDo<{ list: List[] }>("list_lists").then((r) => r.list));
  const tags = useCachedPromise(() => twoDo<{ tags: Tag[] }>("list_tags").then((r) => r.tags));

  const { handleSubmit, itemProps } = useForm<TaskValues>({
    initialValues: task ? taskToValues(task) : link && { title: link.title, notes: link.description, url: link.url },
    validation: {
      title: FormValidation.Required,
      url: (v) => {
        if (v && !(/^[a-z][\w+.-]*:\/\//i.test(v) && URL.canParse(v)))
          return "Enter a full link, like https://example.com";
      },
    },
    async onSubmit(v) {
      try {
        await saveTask(v, task);
        if (task) {
          await showToast({ style: Toast.Style.Success, title: "Task updated" });
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

  return (
    <Form
      navigationTitle={task ? "Edit Task" : undefined}
      isLoading={lists.isLoading || tags.isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={task ? "Save Task" : "Add Task"} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Title" placeholder="Task" {...itemProps.title} />
      <Form.TextArea title="Notes" placeholder="Notes" {...itemProps.notes} />
      {(!task || ["url", "none"].includes(task.action.type)) && (
        <Form.TextField title="Link" placeholder="https://" {...itemProps.url} />
      )}
      <Form.Dropdown title="List" storeValue={!task} {...itemProps.list_id}>
        {lists.data?.map((l) => (
          <Form.Dropdown.Item key={l.list_id} value={l.list_id} title={l.title} />
        ))}
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
        {tagOptions(tags.data, task).map((t) => (
          <Form.TagPicker.Item key={t.tag_id} value={t.tag_id} title={t.title} />
        ))}
      </Form.TagPicker>
    </Form>
  );
}
