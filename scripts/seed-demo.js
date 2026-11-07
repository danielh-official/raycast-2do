// Seeds the "Demo" 2Do list with realistic, happy-path tasks for Store screenshots (see SCREENSHOTS.md):
// actions, goals with progress, a journal, a project, a checklist, repeating and paused tasks.
// Dates are relative to today. Edge cases live in tests/live/seed.js instead.
// Run from the repo root: osascript -l JavaScript scripts/clear-demo.js && osascript -l JavaScript scripts/seed-demo.js
function run() {
  const app = Application("2Do");
  const call = (c, a) => JSON.parse(JSON.stringify(app[c]({ arguments: a })));
  const list = call("list_lists", {}).list.find((l) => l.title === "Demo");
  if (!list) throw new Error('No 2Do list named "Demo". Create it in 2Do first; the automation can\'t create lists.');
  const tags = call("list_tags", {}).tags;
  const tagIds = (...titles) => titles.map((t) => tags.find((x) => x.title === t)?.tag_id).filter(Boolean);
  const tagged = (...titles) => ({ tag_update: { operation: "set", tag_ids: tagIds(...titles) } });

  const pad = (n) => String(n).padStart(2, "0");
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  };
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const months = [
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
  const long = (d) => `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const today = day(0);

  const created = [];
  const add = (args) => {
    const r = call("create_task", { list_id: list.list_id, ...args });
    const t = r.task || r;
    created.push(t.title);
    return t.task_id;
  };

  add({
    title: "Reply to Sam about the project kickoff",
    priority: "high",
    starred: true,
    due_date: iso(today),
    ...tagged("Email"),
  });
  add({
    title: "Ship v1.1 release notes",
    priority: "medium",
    starred: true,
    due_date: iso(today),
    ...tagged("New Features"),
  });
  add({
    title: "Book a dentist appointment",
    priority: "medium",
    due_date: iso(today),
    action: { type: "call", value: "+1 555 0100" },
    ...tagged("Phone", "Health"),
  });
  add({
    title: "Pick up dry cleaning",
    due_date: iso(today),
    action: { type: "visit", value: "1 Infinite Loop, Cupertino" },
    ...tagged("Outside"),
  });
  add({
    title: "Email the landlord about the lease",
    due_date: iso(day(1)),
    action: { type: "mail", value: "landlord@example.com" },
  });
  add({ title: "Review the quarterly budget", priority: "high", starred: true, due_date: iso(day(1)) });
  add({ title: "Return the library books", due_date: iso(day(-2)), ...tagged("Outside") });
  add({
    title: "Read the Raycast extension guidelines",
    action: { type: "url", value: "https://developers.raycast.com/basics/prepare-an-extension-for-store" },
    ...tagged("Learning"),
  });
  add({
    title: "Evening walk",
    start_date: iso(today),
    start_time: "19:30",
    due_date: iso(today),
    ...tagged("Outside", "Health"),
  });

  add({
    title: "Read Designing Data-Intensive Applications",
    ...tagged("Learning"),
    notes: `Chapter 4 next.\n\n@goal: 40 pages\n\n${long(today)}: 6\n${long(day(-1))}: 10\n${long(day(-2))}: 8\n\n@endgoal`,
  });
  add({
    title: "Run 20 km this week",
    ...tagged("Health"),
    notes: `@goal: 20 km\n\n${long(today)}: 5\n${long(day(-2))}: 6\n\n@endgoal`,
  });
  add({
    title: "Drink 8 glasses of water",
    due_date: iso(today),
    recurrence: { frequency: "daily", based_on: "due_date" },
    ...tagged("Health"),
    notes: `@goal: 8 glasses\n\n${long(today)}: 5\n\n@endgoal`,
  });

  add({
    title: "Insurance claim follow-up",
    priority: "medium",
    notes: `Claim #48213\n\n@journal\n\n${long(today)} 11:00 am - Called the adjuster, went to voicemail\n${long(day(-1))} 2:00 pm\n\nCalled again and went over the policy.\nThey'll email the paperwork by Friday.\n\n${long(day(-3))} 9:30 am - Filed the claim online\n\n@endjournal`,
  });

  const offsite = add({ title: "Plan the team offsite", task_type: "project", due_date: iso(day(14)) });
  const pick = call("create_task", { title: "Pick a date", parent_task_id: offsite });
  call("complete_task", { task_id: (pick.task || pick).task_id });
  for (const item of ["Book the venue", "Send the invites", "Order catering"])
    call("create_task", { title: item, parent_task_id: offsite });
  const trip = add({ title: "Pack for the trip", task_type: "checklist", due_date: iso(day(3)) });
  for (const item of ["Passport", "Chargers", "Toothbrush", "Sunscreen"]) {
    const r = call("create_task", { title: item, parent_task_id: trip });
    if (item === "Passport") call("complete_task", { task_id: (r.task || r).task_id });
  }

  add({ title: "Water the plants", due_date: iso(day(2)), recurrence: { frequency: "weekly", based_on: "due_date" } });
  add({ title: "Learn the cello", ...tagged("Someday", "Learning") });
  const done = add({ title: "Renew the car registration" });
  call("complete_task", { task_id: done });
  const dropped = add({ title: "Try a new note-taking app", ...tagged("Cancelled") });
  call("complete_task", { task_id: dropped });

  return `Created ${created.length} tasks (plus project and checklist items) in Demo:\n` + created.join("\n");
}
