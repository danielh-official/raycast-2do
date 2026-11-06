import { ScopedTasks, Scope } from "./scoped-tasks";

const scope: Scope = { focus: "all", include_completed: false, paused_filter: "only" };

export default function Command() {
  return <ScopedTasks scope={scope} byPausedTag />;
}
