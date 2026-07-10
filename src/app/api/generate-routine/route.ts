import {
  type AiError,
  aiErrorForStatus,
} from "@/modules/routine-generation/api/ai/errors";
import {
  buildRoutinePrompt,
  type PromptContext,
} from "@/modules/routine-generation/api/ai/prompt";
import { routineJsonSchema } from "@/modules/routine-generation/api/ai/schema";

/**
 * The ONE server-side module: a STATELESS OpenRouter proxy.
 *
 * Firewall rule 4 (security-load-bearing, Biome-enforced): this route may import
 * ONLY `modules/routine-generation/api/ai/{prompt,schema,errors}`. It must never
 * import `shared/db`, any `*Repo`, or `api/ai/client` — the persistence layer is
 * browser-only; the server is forbidden to touch user data (design.md §0/§2).
 *
 * It holds no state across requests and persists nothing. `OPENROUTER_API_KEY` +
 * `OPENROUTER_MODEL` are read from server env only (never `NEXT_PUBLIC_*`), so
 * neither the key nor the model id ever reaches the client bundle. The user's
 * profile/goals arrive in the request body (the server can't read the browser DB
 * — design.md §D2); the routine payload + the model's reasoning stream straight
 * back to the client as Server-Sent Events (design.md §D3).
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function jsonError(error: AiError, status: number): Response {
  return Response.json({ error }, { status });
}

interface RequestBody {
  prompt: string;
  ctx: PromptContext;
}

/** Validate + narrow the client body into a prompt + prompt context. */
function parseBody(payload: unknown): RequestBody | null {
  if (typeof payload !== "object" || payload === null) return null;
  const body = payload as {
    prompt?: unknown;
    profile?: { bodyweightKg?: unknown; unit?: unknown };
    goals?: { focus?: unknown; daysPerWeek?: unknown };
  };

  const prompt = typeof body.prompt === "string" ? body.prompt : null;
  if (prompt === null || prompt.trim() === "") return null;

  const focus = body.goals?.focus;
  const daysPerWeek = body.goals?.daysPerWeek;
  const unit = body.profile?.unit;
  if (typeof focus !== "string") return null;
  if (typeof daysPerWeek !== "number") return null;
  if (unit !== "metric" && unit !== "imperial") return null;

  const ctx: PromptContext = { focus, daysPerWeek, unit };
  if (typeof body.profile?.bodyweightKg === "number") {
    ctx.bodyweightKg = body.profile.bodyweightKg;
  }
  return { prompt, ctx };
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model) {
    return jsonError({ kind: "provider" }, 500);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError({ kind: "parse" }, 400);
  }

  const body = parseBody(payload);
  if (body === null) {
    return jsonError({ kind: "parse" }, 400);
  }

  const messages = buildRoutinePrompt(body.prompt, body.ctx);

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        response_format: {
          type: "json_schema",
          json_schema: { name: "routine", schema: routineJsonSchema },
        },
      }),
    });
  } catch {
    return jsonError({ kind: "provider" }, 502);
  }

  if (!upstream.ok || upstream.body === null) {
    return jsonError(aiErrorForStatus(upstream.status), upstream.status);
  }

  // Pass the upstream SSE straight back — no buffering (would defeat the live
  // thinking summary), no state retained (design.md §D3). Stateless proxy.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
