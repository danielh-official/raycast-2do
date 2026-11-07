// Deletes every task in the "Demo" 2Do list (keep that list for screenshot tasks only).
// Run from the repo root: osascript -l JavaScript scripts/clear-demo.js
function run() {
  const app = Application("2Do");
  const call = (c, a) => JSON.parse(JSON.stringify(app[c]({ arguments: a })));
  const list = call("list_lists", {}).list.find((l) => l.title === "Demo");
  if (!list) throw new Error('No 2Do list named "Demo". Create it in 2Do first; the automation can\'t create lists.');
  const query = () =>
    call("query_tasks", { list_id: list.list_id, include_completed: true, paused_filter: "include", limit: 500 }).tasks;
  let deleted = 0;
  for (const t of query()) {
    try {
      if (call("delete_task", { task_id: t.task_id }).deleted) deleted++;
    } catch (e) {}
  }
  return JSON.stringify({ deleted, left: query().length });
}
