import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { type GenerateContext, postGenerateRoutine } from "./client";

/**
 * The browser client's request contract: `postGenerateRoutine` must forward the
 * FULL profile/goals context to the proxy so the user never re-types onboarding
 * data (design.md §D2). Regression guard for age/gender (added 2026-07-10) and
 * the other profile fields being dropped from the payload.
 */

const CTX: GenerateContext = {
  focus: "strength",
  daysPerWeek: 4,
  gender: "female",
  age: 41,
  bodyweightKg: 72,
  heightCm: 168,
  unit: "metric",
  notes: "left knee prefers low-impact",
};

/** Intercept the proxy call and capture the JSON body the client sent. */
async function captureBody(
  prompt: string,
  ctx?: GenerateContext,
): Promise<Record<string, unknown>> {
  let captured: Record<string, unknown> = {};
  server.use(
    http.post("/api/generate-routine", async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      // Any non-streaming body is fine — the test only inspects the request.
      return HttpResponse.json(
        { error: { kind: "provider" } },
        { status: 500 },
      );
    }),
  );
  await postGenerateRoutine(prompt, ctx);
  return captured;
}

afterEach(() => {
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
});

describe("postGenerateRoutine — request body", () => {
  it("sends the complete profile, including age and gender", async () => {
    const body = await captureBody("push pull legs", CTX);

    expect(body.prompt).toBe("push pull legs");
    expect(body.profile).toEqual({
      gender: "female",
      age: 41,
      unit: "metric",
      bodyweightKg: 72,
      heightCm: 168,
    });
    expect(body.goals).toEqual({
      focus: "strength",
      daysPerWeek: 4,
      notes: "left knee prefers low-impact",
    });
  });

  it("omits the profile/goals when dispatched without context", async () => {
    const body = await captureBody("bare prompt");
    expect(body.profile).toBeUndefined();
    expect(body.goals).toBeUndefined();
  });
});
