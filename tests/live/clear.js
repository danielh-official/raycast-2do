// Deletes every task in the "Live Testing" 2Do list (keep that list for the live tests only), and
// reports leftovers from the live tests that ended up in Inbox.
// Run from tests/: osascript -l JavaScript live/clear.js
function run() {
  const app = Application("2Do");
  const call = (c, a) => JSON.parse(JSON.stringify(app[c]({ arguments: a })));
  const list = call("list_lists", {}).list.find((l) => l.title === "Live Testing");
  if (!list)
    throw new Error('No 2Do list named "Live Testing". Create it in 2Do first; the automation can\'t create lists.');
  const tasks = call("query_tasks", {
    list_id: list.list_id,
    include_completed: true,
    paused_filter: "include",
    limit: 500,
  }).tasks;
  let deleted = 0;
  for (const t of tasks) {
    try {
      if (call("delete_task", { task_id: t.task_id }).deleted) deleted++;
    } catch (e) {}
  }
  const left = call("query_tasks", {
    list_id: list.list_id,
    include_completed: true,
    paused_filter: "include",
    limit: 500,
  }).tasks.length;
  const inbox = call("list_lists", {}).list.find((l) => l.title === "Inbox");
  const strays = call("query_tasks", {
    list_id: inbox.list_id,
    include_completed: true,
    paused_filter: "include",
    limit: 500,
  })
    .tasks.filter((t) => /Water the plants|Skip me|Cancel me|probe/.test(t.title))
    .map((t) => t.title);
  return JSON.stringify({ deleted, left, strays });
}
