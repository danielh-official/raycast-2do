import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Form,
  getPreferenceValues,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { showFailureToast, useCachedPromise, useForm } from "@raycast/utils";
import { rewriteNotes, Task, twoDo } from "./2do";
import { DayFormat, DisplayFormat, formatDisplay } from "./dates";
import {
  addJournalEntry,
  checkJournal,
  deleteJournalEntry,
  editJournalEntry,
  JournalEntry,
  parseJournal,
} from "./journal";
import { dayFirst } from "./preferences";
import { remediate } from "./remediate";

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
        const current = await remediate(fresh.notes, "add the entry");
        if (current === undefined) return;
        const date = when ?? new Date();
        const { journalDateFormat } = getPreferenceValues<{ journalDateFormat: DayFormat }>();
        const notes = addJournalEntry(
          current,
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

// The task, re-read from 2Do so changes made from a view show up there.
function useFreshTask(initial: Task) {
  return useCachedPromise(
    (id: string) => twoDo<{ task: Task }>("get_task", { task_id: id }).then((r) => r.task),
    [initial.task_id],
    { initialData: initial },
  );
}

function displayPrefs() {
  return getPreferenceValues<{ journalDisplayFormat: DisplayFormat; journalRelativeTime: boolean }>();
}

// Edits one journal entry's text and moment. A date picked without a time keeps it date-only.
function EditJournalEntryForm({ task, entry, onSaved }: { task: Task; entry: JournalEntry; onSaved: () => void }) {
  const { pop } = useNavigation();
  const when = new Date(entry.at);
  // Raycast marks a full-day date picker value with 1 millisecond.
  if (!entry.hasTime) when.setMilliseconds(1);
  const { handleSubmit, itemProps } = useForm<{ text: string; when: Date | null }>({
    initialValues: { text: entry.text, when },
    validation: { text: (v) => (v?.trim() ? undefined : "Required") },
    async onSubmit({ text, when }) {
      try {
        const date = when ?? new Date(entry.at);
        const { journalDateFormat } = getPreferenceValues<{ journalDateFormat: DayFormat }>();
        await rewriteNotes(task.task_id, (notes) =>
          editJournalEntry(
            notes,
            entry,
            { text, when: date, hasTime: !Form.DatePicker.isFullDay(date) },
            journalDateFormat,
            dayFirst(),
          ),
        );
        onSaved();
        pop();
        await showToast({ style: Toast.Style.Success, title: "Entry updated" });
      } catch (error) {
        await showFailureToast(error, { title: "Could not update entry" });
      }
    },
  });

  return (
    <Form
      navigationTitle="Edit Entry"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Entry" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Task" text={task.title} />
      <Form.TextArea title="Entry" {...itemProps.text} />
      <Form.DatePicker title="When" {...itemProps.when} />
      <Form.Description text="Keeping the same moment keeps the entry's timestamp as written." />
    </Form>
  );
}

// The task's journal as a list of entries, newest first, each with its text alongside and actions to
// edit or delete it. Dates follow the Entry Display Date preferences.
export function JournalView({ task: initial, onChange }: { task: Task; onChange: () => void }) {
  const { data: task = initial, revalidate, isLoading } = useFreshTask(initial);
  const entries = [...(parseJournal(task.notes, dayFirst()) ?? [])].sort((a, b) => b.at - a.at);
  const { journalDisplayFormat, journalRelativeTime } = displayPrefs();

  function reload() {
    revalidate();
    onChange();
  }

  async function remove(entry: JournalEntry) {
    const ok = await confirmAlert({
      title: "Delete this entry?",
      message: entry.text.split("\n")[0],
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!ok) return;
    try {
      await rewriteNotes(task.task_id, (notes) => deleteJournalEntry(notes, entry, dayFirst()));
      reload();
      await showToast({ style: Toast.Style.Success, title: "Entry deleted" });
    } catch (error) {
      await showFailureToast(error, { title: "Could not delete entry" });
    }
  }

  const addEntry = (
    <Action.Push
      title="Add Journal Entry"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<AddJournalEntryForm task={task} onAdded={reload} />}
    />
  );

  return (
    <List navigationTitle={task.title} isLoading={isLoading} isShowingDetail={entries.length > 0}>
      <List.EmptyView icon={Icon.Book} title="No journal entries yet" actions={<ActionPanel>{addEntry}</ActionPanel>} />
      {checkJournal(task.notes, dayFirst()).map((issue) => (
        <List.Item
          key={issue.message}
          icon={{ source: Icon.Warning, tintColor: Color.Orange }}
          title={issue.message}
          detail={<List.Item.Detail markdown={`⚠️ ${issue.message}`} />}
          actions={<ActionPanel>{addEntry}</ActionPanel>}
        />
      ))}
      {entries.map((entry) => (
        <List.Item
          key={`${entry.start}:${entry.stamp}`}
          title={formatDisplay(entry, journalDisplayFormat, journalRelativeTime)}
          keywords={[entry.text]}
          detail={<List.Item.Detail markdown={entry.text.replace(/\n/g, "  \n")} />}
          actions={
            <ActionPanel>
              <Action.Push
                title="Edit Entry"
                icon={Icon.Pencil}
                shortcut={Keyboard.Shortcut.Common.Edit}
                target={<EditJournalEntryForm task={task} entry={entry} onSaved={reload} />}
              />
              {addEntry}
              <Action
                title="Delete Entry"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={Keyboard.Shortcut.Common.Remove}
                onAction={() => remove(entry)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
