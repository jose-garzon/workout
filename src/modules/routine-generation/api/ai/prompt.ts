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

/**
 * The output contract, shared by build + edit. Weak/free models often ignore the
 * request's `response_format: json_schema` and wrap output in prose or ```json
 * fences, so we ALSO state the contract, spell the schema out in plain language,
 * and show one valid example — belt and suspenders for reliable JSON. The client
 * still Zod-validates the response; this just makes malformed payloads rarer.
 */
const OUTPUT_CONTRACT = [
  "Respond with ONE JSON object and NOTHING else — no prose, no explanation, no",
  "markdown, no ```json code fences. The very first character you output must be",
  '"{" and the very last must be "}".',
].join(" ");

/** Plain-language restatement of `routineSchema` (schema.ts) — belt and suspenders. */
const SCHEMA_SHAPE = [
  "The response is ONE JSON object matching this JSON schema:",
  "- name: string — a short routine name.",
  "- subtitle: string — OPTIONAL, one short (max ~12 words) motivational line.",
  "- days: non-empty array with ONE entry per training day. Each day is an object:",
  '    - name: string — e.g. "Push", "Pull", "Legs", "Upper".',
  "    - exercises: non-empty array of objects, each:",
  "        - name: string — the exercise name.",
  "        - sets: non-empty array of objects, each:",
  "            - reps: a whole number greater than 0.",
  "            - restSeconds: a whole number of 0 or more (never negative).",
  "            - targetWeightKg: OPTIONAL number greater than 0 — omit it unless a",
  "              specific load is clearly warranted.",
].join("\n");

/** A concrete, valid example so the model has a shape to copy (schema-conformant). */
const EXAMPLE = [
  "Example of a well-formed response (copy the SHAPE, not the content):",
  JSON.stringify({
    name: "Upper / Lower",
    subtitle: "Four focused days, real strength",
    days: [
      {
        name: "Upper",
        exercises: [
          {
            name: "Bench Press",
            sets: [
              { reps: 8, restSeconds: 120 },
              { reps: 8, restSeconds: 120 },
            ],
          },
          { name: "Barbell Row", sets: [{ reps: 10, restSeconds: 90 }] },
        ],
      },
      {
        name: "Lower",
        exercises: [
          { name: "Back Squat", sets: [{ reps: 5, restSeconds: 180 }] },
        ],
      },
    ],
  }),
].join("\n");

/**
 * Handle terse or vague requests gracefully. Users routinely type things like
 * "PPL", "get strong", or "upper/lower" — the model must infer a complete routine
 * rather than stall or ask questions (it cannot; this is a one-shot proxy call).
 */
const INTERPRET = [
  'Interpret the request generously. If it is brief or vague (e.g. "PPL", "get',
  'strong", "upper/lower", "3 day split"), infer a complete, sensible routine',
  "that honours the stated goal and the training-days count. Never ask the user to",
  "clarify and never return an empty or partial routine.",
].join(" ");

const SYSTEM_PROMPT = [
  [
    "You are a strength-training coach for an intermediate gym-goer with full-gym",
    "equipment access. Design a gym routine as STRUCTURE ONLY: a weekly split of",
    "training days, each with exercises and, per exercise, planned sets with reps",
    "and rest seconds. Also author a single short (max ~12 words) motivational",
    '"subtitle" for the routine. Do not add beginner form or safety guidance.',
  ].join(" "),
  INTERPRET,
  "Return EXACTLY as many day entries as the requested training-days count.",
  OUTPUT_CONTRACT,
  SCHEMA_SHAPE,
  EXAMPLE,
].join("\n\n");

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
  [
    "You are editing an EXISTING gym routine. Apply ONLY the requested change and",
    "return the FULL updated routine. Everything the instruction does not mention",
    "must stay EXACTLY the same — same day names, same exercise names, same sets,",
    "reps, and rest. Do not rename, reorder, add, or drop anything you were not",
    "asked to change.",
  ].join(" "),
  OUTPUT_CONTRACT,
  SCHEMA_SHAPE,
  EXAMPLE,
].join("\n\n");

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
