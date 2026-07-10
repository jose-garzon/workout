import { type AiError, aiErrorForStatus } from "./errors";
import { buildRoutinePrompt, type PromptContext } from "./prompt";
import { rateLimitOk } from "./rateLimit";
import { routineJsonSchema } from "./schema";

/**
 * SERVER-side OpenRouter service — the whole request handler for the stateless
 * AI proxy, factored out of `app/api/generate-routine/route.ts` so the route is
 * a one-line delegate (the app layer only wires; the work lives in the module).
 *
 * Server-safe (pure, no Dexie): imports only its `api/ai/` siblings — never
 * `shared/db`, any `*Repo`, or the browser `client`. This is the counterpart to
 * `client.ts`: client is browser→proxy, this is proxy→OpenRouter. The API key +
 * model are read from server env here and never leave the server (design.md §0/
 * §2, §D2–D3).
 */

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

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

/** Client IP for rate limiting — first `x-forwarded-for` hop, else `x-real-ip`. */
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Handle a routine-generation request end to end: rate-limit by IP, read env,
 * validate the body, call OpenRouter with structured output + streaming, and
 * pipe the upstream SSE straight back — no buffering (would defeat the live
 * thinking summary), no durable state. Stateless proxy (design.md §D9).
 */
export async function handleGenerateRoutine(
  request: Request,
): Promise<Response> {
  // Shed abuse before any work — the endpoint is unauthenticated and spends the
  // server's key (design.md §D9).
  if (!rateLimitOk(clientKey(request))) {
    return jsonError({ kind: "rate-limit" }, 429);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model) {
    return jsonError({ kind: "provider" }, 500);
  }
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL;

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
    upstream = await fetch(`${baseUrl}/chat/completions`, {
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

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
