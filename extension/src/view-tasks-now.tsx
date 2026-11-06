import { hasStarted } from "./2do";
import { ScopedTasks } from "./scoped-tasks";

const scope = { focus: "today", include_completed: false };

export default function Command() {
  return <ScopedTasks scope={scope} where={(t) => hasStarted(t)} />;
}
