import type { Routine } from "../../types";
import { type AiError, aiErrorForStatus } from "./errors";
import { type RoutinePayload, routineSchema } from "./schema";

/**
 * BROWSER-side AI client — the app's fetch wrapper for the stateless proxy
 * route. It never talks to OpenRouter directly and never sees the API key; it
 * only POSTs to `/api/generate-routine`. This is the module the server firewall
 * (rule 4) forbids the route from importing.
 *
 * Two layers (design.md §D3):
 *   - `postGenerateRoutine` — the raw dispatch: offline short-circuit + the
 *     HTTP/error surface, returning the streaming `Response`.
 *   - `generateRoutine` — consumes that stream: reasoning deltas drive the live
 *     thinking summary, content deltas assemble the routine JSON, which is Zod-
 *     validated and turned into a domain `Routine` before it is trusted.
 */

/**
 * The profile/goals subset sent to the proxy so the split fits the user. Mirrors
 * the server-side `PromptContext` (prompt.ts) — every onboarding field that
 * shapes a routine, so the user never re-types it. `displayName` is intentionally
 * excluded (identifying, no training value; kept on-device — local-first).
 */
export interface GenerateContext {
  focus: string;
  daysPerWeek: number;
  gender: string;
  age: number;
  bodyweightKg?: number;
  heightCm?: number;
  unit: "metric" | "imperial";
  notes?: string;
}

export type GenerateOutcome =
  | { ok: true; response: Response }
  | { ok: false; error: AiError };

export type RoutineOutcome =
  | { ok: true; routine: Routine }
  | { ok: false; error: AiError };

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * The one dispatch to the proxy, shared by build + edit (design.md §B). Surfaces
 * `{ kind: 'offline' }` without a network hit; otherwise returns the streaming
 * `Response` or a specific `AiError`.
 */
async function postToProxy(body: object): Promise<GenerateOutcome> {
  if (isOffline()) {
    return { ok: false, error: { kind: "offline" } };
  }
  try {
    const response = await fetch("/api/generate-routine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return { ok: false, error: aiErrorForStatus(response.status) };
    }
    return { ok: true, response };
  } catch {
    return { ok: false, error: { kind: "network" } };
  }
}

/**
 * POST a generation request. Surfaces `{ kind: 'offline' }` without a network
 * hit. `ctx` is optional so the foundation smoke test can dispatch a bare prompt.
 */
export async function postGenerateRoutine(
  prompt: string,
  ctx?: GenerateContext,
): Promise<GenerateOutcome> {
  return postToProxy({
    prompt,
    profile: ctx
      ? {
          gender: ctx.gender,
          age: ctx.age,
          unit: ctx.unit,
          bodyweightKg: ctx.bodyweightKg,
          heightCm: ctx.heightCm,
        }
      : undefined,
    goals: ctx
      ? { focus: ctx.focus, daysPerWeek: ctx.daysPerWeek, notes: ctx.notes }
      : undefined,
  });
}

interface StreamDelta {
  choices?: { delta?: { content?: string; reasoning?: string } }[];
}

/** Add client-owned ids + metadata to the validated AI payload (schema.ts §note). */
function assembleRoutine(payload: RoutinePayload): Routine {
  return {
    id: crypto.randomUUID(),
    name: payload.name,
    subtitle: payload.subtitle,
    createdAt: Date.now(),
    active: true,
    days: payload.days.map((day) => ({
      id: crypto.randomUUID(),
      name: day.name,
      exercises: day.exercises.map((exercise) => ({
        id: crypto.randomUUID(),
        name: exercise.name,
        sets: exercise.sets.map((set) => ({
          reps: set.reps,
          restSeconds: set.restSeconds,
          ...(set.targetWeightKg !== undefined
            ? { targetWeightKg: set.targetWeightKg }
            : {}),
        })),
      })),
    })),
  };
}

/** Strip a domain `Routine` to the id-less schema shape sent to the model (§B). */
export function stripToPayload(routine: Routine): RoutinePayload {
  return {
    name: routine.name,
    ...(routine.subtitle !== undefined ? { subtitle: routine.subtitle } : {}),
    days: routine.days.map((day) => ({
      name: day.name,
      exercises: day.exercises.map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets.map((set) => ({
          reps: set.reps,
          restSeconds: set.restSeconds,
          ...(set.targetWeightKg !== undefined
            ? { targetWeightKg: set.targetWeightKg }
            : {}),
        })),
      })),
    })),
  };
}

const normalize = (name: string): string => name.trim().toLowerCase();

function assembleSets(
  sets: RoutinePayload["days"][number]["exercises"][number]["sets"],
) {
  return sets.map((set) => ({
    reps: set.reps,
    restSeconds: set.restSeconds,
    ...(set.targetWeightKg !== undefined
      ? { targetWeightKg: set.targetWeightKg }
      : {}),
  }));
}

/**
 * Assemble the edited AI payload back into a `Routine`, PRESERVING ids by
 * hierarchical normalized-name match-and-consume (design.md §C). Unchanged days
 * and exercises keep their ids so workout/calendar history stays joined; new or
 * renamed items get fresh UUIDs. `id` + `createdAt` are taken from `previous` —
 * the routine is edited, not recreated.
 */
export function assembleEditedRoutine(
  payload: RoutinePayload,
  previous: Routine,
): Routine {
  const remainingDays = [...previous.days];

  const days = payload.days.map((day) => {
    const matchIndex = remainingDays.findIndex(
      (prev) => normalize(prev.name) === normalize(day.name),
    );
    const prevDay =
      matchIndex === -1 ? null : remainingDays.splice(matchIndex, 1)[0];
    const remainingExercises = prevDay ? [...prevDay.exercises] : [];

    return {
      id: prevDay?.id ?? crypto.randomUUID(),
      name: day.name,
      exercises: day.exercises.map((exercise) => {
        const exIndex = remainingExercises.findIndex(
          (prev) => normalize(prev.name) === normalize(exercise.name),
        );
        const prevExercise =
          exIndex === -1 ? null : remainingExercises.splice(exIndex, 1)[0];
        return {
          id: prevExercise?.id ?? crypto.randomUUID(),
          name: exercise.name,
          sets: assembleSets(exercise.sets),
        };
      }),
    };
  });

  return {
    id: previous.id,
    name: payload.name,
    subtitle: payload.subtitle,
    createdAt: previous.createdAt,
    active: true,
    days,
  };
}

export interface StreamHandlers {
  /** Called with the accumulated reasoning each time more thinking arrives. */
  onThinking?: (thinking: string) => void;
}

/**
 * Consume the proxy's SSE stream: `delta.reasoning` grows the thinking summary,
 * `delta.content` assembles the routine JSON. The JSON is validated with
 * `routineSchema` at stream end — never trust the model's shape at the boundary
 * — then turned into a domain `Routine`. Any malformed payload → `parse`.
 */
async function consumeStream(
  response: Response,
  assemble: (payload: RoutinePayload) => Routine,
  handlers: StreamHandlers,
): Promise<RoutineOutcome> {
  const body = response.body;
  if (body === null) return { ok: false, error: { kind: "parse" } };

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let thinking = "";

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (data === "" || data === "[DONE]") return;
    let delta: StreamDelta;
    try {
      delta = JSON.parse(data) as StreamDelta;
    } catch {
      return; // ignore keep-alive / non-JSON comment lines
    }
    const chunk = delta.choices?.[0]?.delta;
    if (chunk?.reasoning) {
      thinking += chunk.reasoning;
      handlers.onThinking?.(thinking);
    }
    if (chunk?.content) {
      content += chunk.content;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        handleLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
      }
    }
    handleLine(buffer);
  } catch {
    return { ok: false, error: { kind: "network" } };
  }

  try {
    const payload = routineSchema.parse(JSON.parse(content));
    return { ok: true, routine: assemble(payload) };
  } catch {
    return { ok: false, error: { kind: "parse" } };
  }
}

/**
 * The high-level seam the generation hook calls: dispatch + stream consumption,
 * yielding a validated domain `Routine` or a specific `AiError`.
 */
export async function generateRoutine(
  prompt: string,
  ctx: GenerateContext,
  handlers: StreamHandlers = {},
): Promise<RoutineOutcome> {
  const dispatched = await postGenerateRoutine(prompt, ctx);
  if (!dispatched.ok) {
    return { ok: false, error: dispatched.error };
  }
  return consumeStream(dispatched.response, assembleRoutine, handlers);
}

/**
 * The edit seam (design.md §B): send the current routine (stripped of ids) plus
 * a targeted `instruction`, then assemble the response back into a `Routine`
 * with ids preserved for unchanged content (§C). Reuses the one dispatch + one
 * stream parser; no thinking log is wired for edits.
 */
export async function editRoutine(
  current: Routine,
  instruction: string,
): Promise<RoutineOutcome> {
  const dispatched = await postToProxy({
    mode: "edit",
    instruction,
    routine: stripToPayload(current),
  });
  if (!dispatched.ok) {
    return { ok: false, error: dispatched.error };
  }
  return consumeStream(
    dispatched.response,
    (payload) => assembleEditedRoutine(payload, current),
    {},
  );
}
