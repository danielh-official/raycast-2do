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
import { completeGoalTask, GoalPrefs, isRepeating, Task, twoDo, ymd } from "./2do";
import { DisplayFormat, formatDisplay } from "./dates";
import { checkGoal, goalProgress, logProgress, parseGoal, progressHistory } from "./goal";
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

// A goal's progress entries, newest first, with a running total, and dates shown per the Entry
// Display Date preferences. Reloads the task so progress logged from here shows up.
export function GoalProgressView({ task: initial, onChange }: { task: Task; onChange: () => void }) {
  const { data: task = initial, revalidate } = useCachedPromise(
    (id: string) => twoDo<{ task: Task }>("get_task", { task_id: id }).then((r) => r.task),
    [initial.task_id],
    { initialData: initial },
  );
  const { journalDisplayFormat, journalRelativeTime } = getPreferenceValues<{
    journalDisplayFormat: DisplayFormat;
    journalRelativeTime: boolean;
  }>();
  const goal = parseGoal(task.notes, dayFirst());
  const markdown = [`# ${task.title}`];
  if (!goal) markdown.push("This task no longer has a goal.");
  else {
    const { done, today } = goalProgress(goal, ymd(new Date()));
    const unit = goal.unit ? ` ${goal.unit}` : "";
    markdown.push(
      `**${done} of ${goal.total}${unit}** · ${Math.round((done / goal.total) * 100)}%${today ? ` · ${signed(today)} today` : ""}`,
      ...checkGoal(task.notes, dayFirst()).map((i) => `> ⚠️ ${i.message}`),
    );
    const rows = progressHistory(goal);
    markdown.push(
      rows.length
        ? [
            "| When | Amount | Total |",
            "| --- | ---: | ---: |",
            ...rows.map(
              (e) =>
                `| ${formatDisplay(e, journalDisplayFormat, journalRelativeTime)} | ${signed(e.amount)} | ${e.total} |`,
            ),
          ].join("\n")
        : "No progress logged yet.",
    );
  }

  return (
    <Detail
      navigationTitle="Progress"
      markdown={markdown.join("\n\n")}
      actions={
        goal && (
          <ActionPanel>
            <Action.Push
              title="Log Progress"
              icon={Icon.PlusCircle}
              target={
                <LogProgressForm
                  task={task}
                  onLogged={() => {
                    revalidate();
                    onChange();
                  }}
                />
              }
            />
          </ActionPanel>
        )
      }
    />
  );
}
