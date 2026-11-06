import { confirmAlert } from "@raycast/api";
import { checkNotes, fixNotes } from "./notes";
import { dayFirst } from "./preferences";

// Before an action writes a task's notes: if the goal or journal syntax has a fixable problem, asks
// to fix it first. Returns the notes to write from (fixed or unchanged), or undefined if cancelled.
export async function remediate(notes: string, action: string): Promise<string | undefined> {
  const fixable = checkNotes(notes, dayFirst()).filter((i) => i.fixable);
  if (!fixable.length) return notes;
  const ok = await confirmAlert({
    title: "Fix the notes' syntax first?",
    message: `${fixable.map((i) => i.message).join("\n")}\n\nFixing adds the missing end line, then continues to ${action}.`,
    primaryAction: { title: "Fix and Continue" },
    dismissAction: { title: "Cancel" },
  });
  return ok ? fixNotes(notes, dayFirst()) : undefined;
}
