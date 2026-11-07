// Seeds the "Live Testing" 2Do list for the live tests: one task per feature, happy and unhappy
// paths (broken syntax, edge-case dates, tasks to cancel). Dates are relative to today.
// Run from tests/: osascript -l JavaScript live/seed.js
function run() {
  const app = Application("2Do");
  const call = (c, a) => JSON.parse(JSON.stringify(app[c]({ arguments: a })));
  const list = call("list_lists", {}).list.find((l) => l.title === "Live Testing");
  if (!list)
    throw new Error('No 2Do list named "Live Testing". Create it in 2Do first; the automation can\'t create lists.');
  const tags = call("list_tags", {}).tags;
  const tag = (title) => tags.find((t) => t.title === title).tag_id;

  const pad = (n) => String(n).padStart(2, "0");
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  };
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const long = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const short = (d) => `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const full = (d) => `${long[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const today = day(0),
    y1 = day(-1),
    y2 = day(-2),
    y3 = day(-3);

  const created = [];
  const add = (args) => {
    const r = call("create_task", { list_id: list.list_id, ...args });
    const t = r.task || r;
    created.push(t.title);
    return t.task_id;
  };

  // Basics
  add({ title: "Reply to Sam about the project kickoff", priority: "high", starred: true, due_date: iso(today) });
  add({ title: "Pay the electricity bill (overdue)", priority: "medium", due_date: iso(y2) });
  add({
    title: "Take vitamins (Now: started this morning)",
    start_date: iso(today),
    start_time: "08:00",
    due_date: iso(today),
  });
  add({
    title: "Evening walk (Later Today: starts 11:30 pm)",
    start_date: iso(today),
    start_time: "23:30",
    due_date: iso(today),
  });

  // Actions, one per type, and links in notes
  add({ title: "Read the 2Do website", action: { type: "url", value: "https://www.2doapp.com" } });
  add({ title: "Call the dentist", action: { type: "call", value: "+1 555 0100" } });
  add({ title: "Text Alex about dinner", action: { type: "message", value: "+1 555 0101" } });
  add({ title: "Email the landlord", action: { type: "mail", value: "landlord@example.com" } });
  add({ title: "Visit the library", action: { type: "visit", value: "1 Infinite Loop, Cupertino" } });
  add({ title: "Search for standing desks", action: { type: "google", value: "best standing desk 2026" } });
  add({
    title: "Compare standing desks (3 links in notes, no action)",
    notes:
      "Options:\n- https://www.example.com/desk-a\n- https://www.example.com/desk-b (sale).\n- See https://en.wikipedia.org/wiki/Desk_(furniture).",
  });
  add({
    title: "Plan the trip (link action plus a link in notes)",
    action: { type: "url", value: "https://www.example.com/itinerary" },
    notes: "Hotel: https://www.example.com/hotel",
  });

  // Goals
  add({
    title: "Read Designing Data-Intensive Applications (goal, mixed formats)",
    notes: `Reading on the train.\n\n@goal: 32 pages\n\n${full(today)}: 6\n${iso(today)} 7:30 am - 2\n${short(y1)}: 10\n${y2.getDate()} ${months[y2.getMonth()]} ${y2.getFullYear()}: -1\n${iso(y3)}: 4\n\n@endgoal`,
  });
  add({ title: "Drink water (goal reached)", notes: `@goal: 8 glasses\n\n${full(today)}: 8\n\n@endgoal` });
  add({ title: "Learn the guitar chords (goal, no entries yet)", notes: "@goal: 10 chords\n\n@endgoal" });
  add({
    title: "Daily push-ups (repeating goal)",
    due_date: iso(today),
    recurrence: { frequency: "daily", based_on: "due_date" },
    notes: `@goal: 50 push-ups\n\n${full(y1)}: 20\n\n@endgoal`,
  });
  add({
    title: "Run 20 km (ambiguous slash and dotted dates)",
    notes: `@goal: 20 km\n\n${pad(today.getMonth() + 1)}/${pad(today.getDate())}/${today.getFullYear()}: 3\n${y1.getDate()}.${y1.getMonth() + 1}.${y1.getFullYear()}: 5\n\n@endgoal`,
  });

  // Journal
  add({
    title: "Insurance claim follow-up (journal)",
    notes: `Claim #12345\n\n@journal\n\n${full(today)} 11:00 am - Called the adjuster, went to voicemail\n${iso(y1)} 2 pm\n\nCalled again, discussed the policy.\nThey'll send the paperwork.\n\n${short(y3)}: Emailed the claim form\n\n@endjournal`,
  });
  add({
    title: "Learn Spanish (goal and journal)",
    notes: `Duolingo plus a tutor.\n\n@goal: 30 lessons\n\n${full(today)}: 1\n${full(y1)}: 2\n\n@endgoal\n\n@journal\n\n${full(y1)} 6:00 pm - First tutor session went well\n\n@endjournal`,
  });

  // Broken syntax
  add({
    title: "Broken: goal without @endgoal",
    notes: `@goal: 5 pages\n\n${full(today)}: 2\n\nCall the library about the next book.`,
  });
  add({ title: "Broken: @goal without a total", notes: "@goal: lots\n\n@endgoal" });
  add({ title: "Broken: unreadable goal line", notes: `@goal: 10\n\n${iso(today)} -1\n${full(today)}: 2\n\n@endgoal` });
  add({
    title: "Broken: journal without @endjournal",
    notes: `@journal\n\n${full(today)} 9:00 am - Booked the venue\n\nAddress: 1 Main St`,
  });
  add({
    title: "Broken: text before the first journal entry",
    notes: `@journal\nstray note\n${full(today)} - First entry\n\n@endjournal`,
  });
  add({
    title: "Two goal blocks (topmost wins)",
    notes: `@goal: 5 pages\n\n${full(today)}: 1\n\n@endgoal\n\n@goal: 99 laps\n\n${full(today)}: 50\n\n@endgoal`,
  });

  // Projects and checklists
  const project = add({ title: "Plan the team offsite (project)", task_type: "project" });
  call("create_task", { title: "Book the venue", parent_task_id: project });
  call("create_task", { title: "Send the invites", parent_task_id: project });
  const done = call("create_task", { title: "Pick a date", parent_task_id: project });
  call("complete_task", { task_id: (done.task || done).task_id });
  const checklist = add({ title: "Pack for the trip (checklist)", task_type: "checklist" });
  for (const item of ["Passport", "Charger", "Toothbrush", "Socks"]) {
    const r = call("create_task", { title: item, parent_task_id: checklist });
    if (item === "Passport" || item === "Charger") call("complete_task", { task_id: (r.task || r).task_id });
  }

  // Repeating, paused, and cancel targets
  add({
    title: "Water the plants (repeats weekly)",
    due_date: iso(today),
    recurrence: { frequency: "weekly", based_on: "due_date" },
  });
  add({ title: "Learn the cello (paused: Someday)", tag_update: { operation: "set", tag_ids: [tag("Someday")] } });
  add({ title: "Cancel me (normal)", due_date: iso(today) });
  add({
    title: "Cancel me (repeats daily)",
    due_date: iso(today),
    recurrence: { frequency: "daily", based_on: "due_date" },
  });
  const finished = add({ title: "Finished task (completed)" });
  call("complete_task", { task_id: finished });
  const cancelled = add({
    title: "Dropped idea (cancelled)",
    tag_update: { operation: "set", tag_ids: [tag("Cancelled")] },
  });
  call("complete_task", { task_id: cancelled });

  return `Created ${created.length} tasks (plus project and checklist items) in Live Testing:\n` + created.join("\n");
}
