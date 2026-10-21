import { runAppleScript } from "@raycast/utils";

export type List = { list_id: string; collection_id: string; title: string };
export type SmartList = { smart_list_id: string; collection_id: string; title: string };
export type Tag = { tag_id: string; title: string };
export type Task = {
  task_id: string;
  title: string;
  notes: string;
  list_id: string;
  list_title: string;
  completed: boolean;
  starred: boolean;
  priority: "none" | "low" | "medium" | "high";
  start_date?: string;
  start_time?: string;
  due_date?: string;
  due_time?: string;
  tags: Tag[];
  presentation: { due_date_formatted?: string; is_overdue: boolean };
};

// Calls a command from 2Do's AppleScript "Automation Suite" (same commands and arguments as 2Do's MCP server).
// 2Do errors are thrown as script errors, e.g. "not_found: Task 'x' was not found."
export async function twoDo<T>(command: string, args: object = {}): Promise<T> {
  const out = await runAppleScript(
    `function run(argv) { return JSON.stringify(Application("2Do")[argv[0]]({ arguments: JSON.parse(argv[1]) })); }`,
    [command, JSON.stringify(args)],
    { language: "JavaScript" },
  );
  return JSON.parse(out);
}
