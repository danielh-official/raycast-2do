import { parseGoal } from "./goal";
import { ScopedTasks } from "./scoped-tasks";

const scope = { focus: "all", include_completed: false };

export default function Command() {
  return <ScopedTasks scope={scope} where={(t) => !!parseGoal(t.notes)} />;
}
