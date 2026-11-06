import {
  Action,
  ActionPanel,
  Detail,
  Form,
  getPreferenceValues,
  Icon,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { showFailureToast, useCachedPromise, useForm } from "@raycast/utils";
import { Task, twoDo } from "./2do";
import { DayFormat, DisplayFormat, formatDisplay } from "./dates";
import { addJournalEntry, parseJournal } from "./journal";
import { dayFirst } from "./preferences";

// Adds an entry to a task's journal. Reads the task fresh before writing so edits made in 2Do since
// the list loaded aren't lost. A date picked without a time writes a date-only entry.
export function AddJournalEntryForm({ task, onAdded }: { task: Task; onAdded: () => void }) {
  const { pop } = useNavigation();
  const { handleSubmit, itemProps } = useForm<{ text: string; when: Date | null }>({
    initialValues: { text: "", when: new Date() },
    validation: { text: (v) => (v?.trim() ? undefined : "Required") },
    async onSubmit({ text, when }) {
      try {
        const { task: fresh } = await twoDo<{ task: Task }>("get_task", { task_id: task.task_id });
        const date = when ?? new Date();
        const { journalDateFormat } = getPreferenceValues<{ journalDateFormat: DayFormat }>();
        const notes = addJournalEntry(
          fresh.notes,
          date,
          !Form.DatePicker.isFullDay(date),
          text,
          journalDateFormat,
          dayFirst(),
        );
        await twoDo("update_task", { task_id: task.task_id, notes });
        onAdded();
        pop();
        await showToast({ style: Toast.Style.Success, title: "Journal entry added" });
      } catch (error) {
        await showFailureToast(error, { title: "Could not add journal entry" });
      }
    },
  });

  return (
    <Form
      navigationTitle="Add Journal Entry"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Journal Entry" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Task" text={task.title} />
      <Form.TextArea title="Entry" placeholder="What happened?" {...itemProps.text} />
      <Form.DatePicker title="When" {...itemProps.when} />
    </Form>
  );
}

// The task's journal, newest first, with timestamps shown per the display preferences. Reloads the
// task so entries added from here show up.
export function JournalView({ task: initial, onChange }: { task: Task; onChange: () => void }) {
  const { data: task = initial, revalidate } = useCachedPromise(
    (id: string) => twoDo<{ task: Task }>("get_task", { task_id: id }).then((r) => r.task),
    [initial.task_id],
    { initialData: initial },
  );
  const entries = [...(parseJournal(task.notes, dayFirst()) ?? [])].sort((a, b) => b.at - a.at);
  const { journalDisplayFormat, journalRelativeTime } = getPreferenceValues<{
    journalDisplayFormat: DisplayFormat;
    journalRelativeTime: boolean;
  }>();
  const markdown = [
    `# ${task.title}`,
    ...entries.map(
      (e) => `### ${formatDisplay(e, journalDisplayFormat, journalRelativeTime)}\n\n${e.text.replace(/\n/g, "  \n")}`,
    ),
  ].join("\n\n");

  return (
    <Detail
      navigationTitle="Journal"
      markdown={entries.length ? markdown : `# ${task.title}\n\nNo journal entries yet.`}
      actions={
        <ActionPanel>
          <Action.Push
            title="Add Journal Entry"
            icon={Icon.Plus}
            target={
              <AddJournalEntryForm
                task={task}
                onAdded={() => {
                  revalidate();
                  onChange();
                }}
              />
            }
          />
        </ActionPanel>
      }
    />
  );
}
