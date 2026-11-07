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
import { completeGoalTask, GoalPrefs, isRepeating, rewriteNotes, Task, twoDo, ymd } from "./2do";
import { DisplayFormat, formatDisplay } from "./dates";
import {
  checkGoal,
  deleteGoalEntry,
  editGoalEntry,
  GoalEntry,
  goalProgress,
  logProgress,
  parseGoal,
  progressHistory,
} from "./goal";
import { dayFirst } from "./preferences";
import { remediate } from "./remediate";

// Logs progress on a goal task. Reads the task fresh before writing so edits made in 2Do since the
// list loaded aren't lost.
export function LogProgressForm({ task, onLogged }: { task: Task; onLogged: () => void }) {
  const { pop } = useNavigation();
  const unit = parseGoal(task.notes)?.unit;
  const { handleSubmit, itemProps } = useForm<{ amount: string; date: Date | null }>({
    initialValues: { amount: "1", date: new Date() },
    validation: {
      amount: (v) => (v?.trim() && Number(v) ? undefined : "Enter a number other than 0 (negative to correct)"),
    },
    async onSubmit({ amount, date }) {
      try {
        const { task: fresh } = await twoDo<{ task: Task }>("get_task", { task_id: task.task_id });
        if (!parseGoal(fresh.notes)) throw new Error("The task's notes no longer have a @goal block.");
        const current = await remediate(fresh.notes, "log progress");
        if (current === undefined) return;
        const { goalDateFormat } = getPreferenceValues<GoalPrefs>();
        const notes = logProgress(current, ymd(date ?? new Date()), Number(amount), goalDateFormat, dayFirst());
        await twoDo("update_task", { task_id: task.task_id, notes });
        const goal = parseGoal(notes, dayFirst())!;
        const { done } = goalProgress(goal, ymd(new Date()));
        const progress = `${done}/${goal.total}${goal.unit ? ` ${goal.unit}` : ""}`;
        onLogged();
        pop();
        if (done >= goal.total && !fresh.completed) {
          await showToast({
            style: Toast.Style.Success,
            title: "Goal reached",
            message: progress,
            primaryAction: {
              title: "Complete Task",
              onAction: async (toast) => {
                await twoDo("complete_task", { task_id: task.task_id });
                await toast.hide();
                onLogged();
              },
            },
          });
        } else {
          await showToast({ style: Toast.Style.Success, title: "Progress logged", message: progress });
        }
      } catch (error) {
        await showFailureToast(error, { title: "Could not log progress" });
      }
    },
  });

  return (
    <Form
      navigationTitle="Log Progress"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Log Progress" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Task" text={task.title} />
      <Form.TextField title={unit ? `Amount (${unit})` : "Amount"} placeholder="1" {...itemProps.amount} />
      <Form.DatePicker title="Date" type={Form.DatePicker.Type.Date} {...itemProps.date} />
    </Form>
  );
}

// Completing a goal task that isn't reached, or repeats: whether to log what's left first, and for a
// repeating task whether the next occurrence keeps the running total or starts fresh.
export function CompleteGoalForm({ task, onCompleted }: { task: Task; onCompleted: () => void }) {
  const { pop } = useNavigation();
  const goal = parseGoal(task.notes, dayFirst())!;
  const remaining = Math.round((goal.total - goalProgress(goal, ymd(new Date())).done) * 1000) / 1000;
  const repeating = isRepeating(task);
  const { handleSubmit, itemProps } = useForm<{ logRemaining: boolean; next: string }>({
    initialValues: { logRemaining: false, next: "keep" },
    async onSubmit({ logRemaining, next }) {
      try {
        const { goalDateFormat } = getPreferenceValues<GoalPrefs>();
        await completeGoalTask(
          task,
          { logRemaining: !!logRemaining, fresh: next === "fresh" },
          { goalDateFormat, dayFirst: dayFirst() },
        );
        onCompleted();
        pop();
        await showToast({ style: Toast.Style.Success, title: "Completed" });
      } catch (error) {
        await showFailureToast(error, { title: "Could not complete task" });
      }
    },
  });

  return (
    <Form
      navigationTitle="Complete Goal Task"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Complete Task" icon={Icon.CheckCircle} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Task" text={task.title} />
      {remaining > 0 && (
        <Form.Checkbox
          label={`Log the remaining ${remaining}${goal.unit ? ` ${goal.unit}` : ""} for today`}
          {...itemProps.logRemaining}
        />
      )}
      {repeating && (
        <Form.Dropdown title="Next Occurrence" {...itemProps.next}>
          <Form.Dropdown.Item value="keep" title="Keep the running total" />
          <Form.Dropdown.Item value="fresh" title="Start fresh from 0" />
        </Form.Dropdown>
      )}
    </Form>
  );
}

const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;

// Edits one progress entry's date and amount.
function EditProgressEntryForm({ task, entry, onSaved }: { task: Task; entry: GoalEntry; onSaved: () => void }) {
  const { pop } = useNavigation();
  const { handleSubmit, itemProps } = useForm<{ amount: string; date: Date | null }>({
    initialValues: { amount: String(entry.amount), date: new Date(entry.at) },
    validation: {
      amount: (v) => (v?.trim() && Number(v) ? undefined : "Enter a number other than 0 (negative to correct)"),
    },
    async onSubmit({ amount, date }) {
      try {
        const { goalDateFormat } = getPreferenceValues<GoalPrefs>();
        const day = date ? ymd(date) : entry.day;
        await rewriteNotes(task.task_id, (notes) =>
          editGoalEntry(notes, entry, { day, amount: Number(amount) }, goalDateFormat, dayFirst()),
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
      <Form.TextField title="Amount" {...itemProps.amount} />
      <Form.DatePicker title="Date" type={Form.DatePicker.Type.Date} {...itemProps.date} />
      <Form.Description text="Keeping the date keeps the entry's timestamp as written, time included." />
    </Form>
  );
}

// A goal's progress entries, newest first, each with its running total and actions to edit or
// delete it. Dates follow the Entry Display Date preferences. Reloads the task after changes.
export function GoalProgressView({ task: initial, onChange }: { task: Task; onChange: () => void }) {
  const {
    data: task = initial,
    revalidate,
    isLoading,
  } = useCachedPromise(
    (id: string) => twoDo<{ task: Task }>("get_task", { task_id: id }).then((r) => r.task),
    [initial.task_id],
    { initialData: initial },
  );
  const { journalDisplayFormat, journalRelativeTime } = getPreferenceValues<{
    journalDisplayFormat: DisplayFormat;
    journalRelativeTime: boolean;
  }>();
  const goal = parseGoal(task.notes, dayFirst());

  function reload() {
    revalidate();
    onChange();
  }

  async function remove(entry: GoalEntry) {
    const ok = await confirmAlert({
      title: "Delete this entry?",
      message: `${signed(entry.amount)} on ${entry.stamp}`,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!ok) return;
    try {
      await rewriteNotes(task.task_id, (notes) => deleteGoalEntry(notes, entry, dayFirst()));
      reload();
      await showToast({ style: Toast.Style.Success, title: "Entry deleted" });
    } catch (error) {
      await showFailureToast(error, { title: "Could not delete entry" });
    }
  }

  const logAction = (
    <Action.Push
      title="Log Progress"
      icon={Icon.PlusCircle}
      shortcut={{ modifiers: ["cmd"], key: "g" }}
      target={<LogProgressForm task={task} onLogged={reload} />}
    />
  );

  if (!goal)
    return (
      <List navigationTitle={task.title} isLoading={isLoading}>
        <List.EmptyView icon={Icon.LineChart} title="This task no longer has a goal" />
      </List>
    );

  const { done, today } = goalProgress(goal, ymd(new Date()));
  const unit = goal.unit ? ` ${goal.unit}` : "";
  const summary = `${done} of ${goal.total}${unit} · ${Math.round((done / goal.total) * 100)}%${today ? ` · ${signed(today)} today` : ""}`;

  return (
    <List navigationTitle={task.title} isLoading={isLoading} searchBarPlaceholder="Filter entries">
      <List.EmptyView
        icon={Icon.LineChart}
        title="No progress logged yet"
        actions={<ActionPanel>{logAction}</ActionPanel>}
      />
      {checkGoal(task.notes, dayFirst()).map((issue) => (
        <List.Item
          key={issue.message}
          icon={{ source: Icon.Warning, tintColor: Color.Orange }}
          title={issue.message}
          actions={<ActionPanel>{logAction}</ActionPanel>}
        />
      ))}
      <List.Section title={summary}>
        {progressHistory(goal).map((entry) => (
          <List.Item
            key={`${entry.line}:${entry.stamp}`}
            title={formatDisplay(entry, journalDisplayFormat, journalRelativeTime)}
            accessories={[
              { text: signed(entry.amount), tooltip: "Amount" },
              { text: `${entry.total}${unit}`, tooltip: "Running total" },
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Edit Entry"
                  icon={Icon.Pencil}
                  shortcut={Keyboard.Shortcut.Common.Edit}
                  target={<EditProgressEntryForm task={task} entry={entry} onSaved={reload} />}
                />
                {logAction}
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
      </List.Section>
    </List>
  );
}
