import { getPreferenceValues } from "@raycast/api";

// The Ambiguous Dates preference: whether a date like 05/11/2026 in a goal or journal reads as
// 5 November rather than May 11.
export const dayFirst = () => getPreferenceValues<{ dateOrder: string }>().dateOrder === "day-first";
