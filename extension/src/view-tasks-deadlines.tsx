import { deadlineSections } from "./2do";
import { Scope, ScopedTasks } from "./scoped-tasks";

// 2Do has no "has a due date" filter, but a due date on or before the far future matches every one.
const scope: Scope = { focus: "all", include_completed: false, due_on_or_before: "9999-12-31" };

export default function Command() {
  return <ScopedTasks scope={scope} sections={deadlineSections} />;
}
