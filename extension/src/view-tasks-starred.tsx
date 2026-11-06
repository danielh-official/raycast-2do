import { ScopedTasks } from "./scoped-tasks";

const scope = { focus: "starred", include_completed: false };

export default function Command() {
  return <ScopedTasks scope={scope} />;
}
