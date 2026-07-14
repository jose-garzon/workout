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

/**
 * The subset of the user's profile/goals the prompt needs (design.md §D2).
 * Carries every onboarding field that shapes a routine so the user never
 * re-types it: goal + days (split), plus gender / age / bodyweight / height
 * (load + volume) and any free-text goal notes. `displayName` is deliberately
 * omitted — it is identifying and has no training value, and keeping it on-device
 * honors the local-first data-minimization stance (the proxy is the one network
 * call). Optional fields are absent when the user left them blank.
 */
export interface PromptContext {
  focus: string;
  daysPerWeek: number;
  gender: string;
  age: number;
  bodyweightKg?: number;
  heightCm?: number;
  unit: "metric" | "imperial";
  notes?: string;
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

/** Height in the user's own units, for the context line (cm stored canonically). */
function formatHeight(ctx: PromptContext): string | null {
  if (ctx.heightCm === undefined) return null;
  if (ctx.unit === "imperial") {
    const totalInches = Math.round(ctx.heightCm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet} ft ${inches} in`;
  }
  return `${Math.round(ctx.heightCm)} cm`;
}

/** Build the chat messages for a routine-generation request (design.md §D2). */
export function buildRoutinePrompt(
  userPrompt: string,
  ctx: PromptContext,
): ChatMessage[] {
  const lines = [
    `Primary goal: ${ctx.focus}.`,
    `Training days per week: ${ctx.daysPerWeek}.`,
    `Gender: ${ctx.gender}.`,
    `Age: ${ctx.age}.`,
  ];
  const bodyweight = formatBodyweight(ctx);
  if (bodyweight) lines.push(`Bodyweight: ${bodyweight}.`);
  const height = formatHeight(ctx);
  if (height) lines.push(`Height: ${height}.`);
  if (ctx.notes && ctx.notes.trim() !== "") {
    lines.push(`Additional goal notes: ${ctx.notes.trim()}.`);
  }
  lines.push("", `Request: ${userPrompt}`);

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: lines.join("\n") },
  ];
}

const EDIT_SYSTEM_PROMPT = [
  "You are editing an EXISTING gym routine. Apply ONLY the requested change and",
  "return the FULL updated routine in the same JSON schema. Everything the",
  "instruction does not mention must stay exactly the same — same day names,",
  "same exercise names, same sets, reps, and rest. Do not rename or reorder",
  "anything you were not asked to change.",
  "Respond ONLY with JSON matching the provided schema — no prose, no markdown.",
].join(" ");

/**
 * Build the chat messages for an EDIT request (design.md §B). `routine` is the
 * user's current routine, already stripped of ids, echoed back purely as prompt
 * context — it is not re-validated here (the RESPONSE is validated client-side).
 */
export function buildEditPrompt(
  instruction: string,
  routine: unknown,
): ChatMessage[] {
  const content = [
    "Current routine:",
    JSON.stringify(routine),
    "",
    `Requested change: ${instruction}`,
  ].join("\n");

  return [
    { role: "system", content: EDIT_SYSTEM_PROMPT },
    { role: "user", content },
  ];
}
