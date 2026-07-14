import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { handleGenerateRoutine } from "./openrouter";
import { resetRateLimits } from "./rateLimit";

/**
 * The server proxy end to end: it validates the client body, folds the FULL
 * profile/goals into the OpenRouter messages, and passes the SSE stream back.
 * Regression guard that age/gender (and the other profile fields) survive
 * `parseBody` → `buildRoutinePrompt` on the server, not just the client payload.
 */

interface UpstreamCall {
  messages: { role: string; content: string }[];
}

/** Intercept the OpenRouter upstream and capture the chat messages it received. */
function captureUpstream(): { get: () => UpstreamCall | null } {
  const box: { value: UpstreamCall | null } = { value: null };
  server.use(
    http.post(
      "https://openrouter.ai/api/v1/chat/completions",
      async ({ request }) => {
        box.value = (await request.json()) as UpstreamCall;
        // A minimal valid SSE stream so the handler returns 200.
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new HttpResponse(stream, {
          headers: { "content-type": "text/event-stream" },
        });
      },
    ),
  );
  return { get: () => box.value };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/generate-routine", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

const FULL_BODY = {
  prompt: "a 4-day upper/lower split",
  profile: {
    gender: "female",
    age: 41,
    unit: "metric",
    bodyweightKg: 72,
    heightCm: 168,
  },
  goals: {
    focus: "strength",
    daysPerWeek: 4,
    notes: "left knee prefers low-impact",
  },
};

beforeEach(() => {
  resetRateLimits();
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "test-model";
});

afterEach(() => {
  process.env.OPENROUTER_API_KEY = undefined;
  process.env.OPENROUTER_MODEL = undefined;
});

describe("handleGenerateRoutine — prompt assembly", () => {
  it("folds the complete profile, including age and gender, into the upstream prompt", async () => {
    const upstream = captureUpstream();

    const response = await handleGenerateRoutine(request(FULL_BODY));
    expect(response.status).toBe(200);

    const call = upstream.get();
    expect(call).not.toBeNull();
    const userMessage =
      call?.messages.find((m) => m.role === "user")?.content ?? "";
    expect(userMessage).toContain("Gender: female.");
    expect(userMessage).toContain("Age: 41.");
    expect(userMessage).toContain("strength");
    expect(userMessage).toContain("72 kg");
    expect(userMessage).toContain("168 cm");
    expect(userMessage).toContain("left knee prefers low-impact");
  });

  it("rejects a body missing gender or age with a 400", async () => {
    const { profile, ...rest } = FULL_BODY;
    const { gender: _g, age: _a, ...profileNoIdentity } = profile;
    const response = await handleGenerateRoutine(
      request({ ...rest, profile: profileNoIdentity }),
    );
    expect(response.status).toBe(400);
  });
});

const EDIT_BODY = {
  mode: "edit",
  instruction: "add a legs day with squats",
  routine: {
    name: "PPL",
    days: [{ name: "Push", exercises: [{ name: "Bench", sets: [] }] }],
  },
};

describe("handleGenerateRoutine — edit branch", () => {
  it("accepts an edit body and folds the routine + instruction into the prompt", async () => {
    const upstream = captureUpstream();

    const response = await handleGenerateRoutine(request(EDIT_BODY));
    expect(response.status).toBe(200);

    const userMessage =
      upstream.get()?.messages.find((m) => m.role === "user")?.content ?? "";
    expect(userMessage).toContain("add a legs day with squats");
    expect(userMessage).toContain("Push");
  });

  it("rejects an edit body with an empty instruction with a 400", async () => {
    const response = await handleGenerateRoutine(
      request({ ...EDIT_BODY, instruction: "   " }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects an edit body whose routine is not an object with a 400", async () => {
    const response = await handleGenerateRoutine(
      request({ ...EDIT_BODY, routine: "nope" }),
    );
    expect(response.status).toBe(400);
  });
});
