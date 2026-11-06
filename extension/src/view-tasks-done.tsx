import { ScopedTasks } from "./scoped-tasks";

const scope = { focus: "done", include_completed: true };

export default function Command() {
  return <ScopedTasks scope={scope} />;
}
