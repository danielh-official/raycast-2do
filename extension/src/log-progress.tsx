import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { showFailureToast, useForm } from "@raycast/utils";
import { Task, twoDo, ymd } from "./2do";
import { goalProgress, logProgress, parseGoal, writeGoal } from "./goal";

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
        const goal = parseGoal(fresh.notes);
        if (!goal) throw new Error("The task's notes no longer have a @goal block.");
        const next = logProgress(goal, ymd(date ?? new Date()), Number(amount));
        await twoDo("update_task", { task_id: task.task_id, notes: writeGoal(fresh.notes, next) });
        const { done } = goalProgress(next, ymd(new Date()));
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
