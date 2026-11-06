import { ScopedTasks } from "./scoped-tasks";

const scope = { focus: "scheduled", include_completed: false };

export default function Command() {
  return <ScopedTasks scope={scope} />;
}
