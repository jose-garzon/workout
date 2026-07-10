/**
 * Prompt builder for routine generation — server-safe (pure, no Dexie). Used by
 * the stateless proxy route to shape the OpenRouter request. Kept isomorphic and
 * side-effect-free so it is safe to import server-side (design.md §2).
 *
 * The user's profile/goals arrive from the CLIENT in the request body — the
 * server is firewalled off `shared/db` (rule 4) and cannot read them itself
 * (design.md §D2). This module accepts them as a plain, minimal shape rather
 * than importing the profile-goals domain types, so it stays a dependency leaf.
 */

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** The subset of the user's profile/goals the prompt needs (design.md §D2). */
export interface PromptContext {
  focus: string;
  daysPerWeek: number;
  bodyweightKg?: number;
  unit: "metric" | "imperial";
}

const SYSTEM_PROMPT = [
  "You are a strength-training coach for an intermediate gym-goer with full-gym",
  "equipment access. Design a gym routine as STRUCTURE ONLY: a weekly split of",
  "training days, each with exercises and, per exercise, planned sets with reps",
  "and rest seconds. Also author a single short (max ~12 words) motivational",
  '"subtitle" for the routine. Do not add beginner form or safety guidance.',
  "Respond ONLY with JSON matching the provided schema — no prose, no markdown.",
].join(" ");

/** Weight in the user's own units, for the context line (kg stored canonically). */
function formatBodyweight(ctx: PromptContext): string | null {
  if (ctx.bodyweightKg === undefined) return null;
  if (ctx.unit === "imperial") {
    return `${Math.round(ctx.bodyweightKg * 2.2046)} lb`;
  }
  return `${Math.round(ctx.bodyweightKg)} kg`;
}

/** Build the chat messages for a routine-generation request (design.md §D2). */
export function buildRoutinePrompt(
  userPrompt: string,
  ctx: PromptContext,
): ChatMessage[] {
  const lines = [
    `Primary goal: ${ctx.focus}.`,
    `Training days per week: ${ctx.daysPerWeek}.`,
  ];
  const bodyweight = formatBodyweight(ctx);
  if (bodyweight) lines.push(`Bodyweight: ${bodyweight}.`);
  lines.push("", `Request: ${userPrompt}`);

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: lines.join("\n") },
  ];
}
