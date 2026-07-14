import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import type { Routine } from "../../types";
import {
  assembleEditedRoutine,
  type GenerateContext,
  postGenerateRoutine,
  stripToPayload,
} from "./client";
import type { RoutinePayload } from "./schema";

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

/** A two-day routine with distinct, known ids for tracking id preservation. */
function previousRoutine(): Routine {
  return {
    id: "active",
    name: "PPL",
    subtitle: "no excuses",
    createdAt: 1000,
    active: true,
    days: [
      {
        id: "day-push",
        name: "Push",
        exercises: [
          {
            id: "ex-bench",
            name: "Bench Press",
            sets: [{ reps: 8, restSeconds: 120 }],
          },
          {
            id: "ex-ohp",
            name: "Overhead Press",
            sets: [{ reps: 10, restSeconds: 90 }],
          },
        ],
      },
      {
        id: "day-pull",
        name: "Pull",
        exercises: [
          { id: "ex-row", name: "Row", sets: [{ reps: 10, restSeconds: 90 }] },
        ],
      },
    ],
  };
}

/** Build the id-less payload the model returns, from a partial day list. */
function payload(days: RoutinePayload["days"]): RoutinePayload {
  return { name: "PPL", subtitle: "no excuses", days };
}

describe("stripToPayload", () => {
  it("drops every id/createdAt/active while keeping names + sets", () => {
    const stripped = stripToPayload(previousRoutine());
    expect(stripped).toEqual({
      name: "PPL",
      subtitle: "no excuses",
      days: [
        {
          name: "Push",
          exercises: [
            { name: "Bench Press", sets: [{ reps: 8, restSeconds: 120 }] },
            { name: "Overhead Press", sets: [{ reps: 10, restSeconds: 90 }] },
          ],
        },
        {
          name: "Pull",
          exercises: [{ name: "Row", sets: [{ reps: 10, restSeconds: 90 }] }],
        },
      ],
    });
  });
});

describe("assembleEditedRoutine — id preservation (design.md §C)", () => {
  it("preserves routine id + createdAt (edited, not recreated)", () => {
    const prev = previousRoutine();
    const result = assembleEditedRoutine(stripToPayload(prev), prev);
    expect(result.id).toBe("active");
    expect(result.createdAt).toBe(1000);
  });

  it("keeps ids of unchanged days and exercises", () => {
    const prev = previousRoutine();
    const result = assembleEditedRoutine(stripToPayload(prev), prev);
    expect(result.days[0].id).toBe("day-push");
    expect(result.days[0].exercises[0].id).toBe("ex-bench");
    expect(result.days[0].exercises[1].id).toBe("ex-ohp");
    expect(result.days[1].id).toBe("day-pull");
  });

  it("matches by normalized name (case + whitespace insensitive)", () => {
    const prev = previousRoutine();
    const result = assembleEditedRoutine(
      payload([
        {
          name: "  push  ",
          exercises: [
            { name: "BENCH PRESS", sets: [{ reps: 8, restSeconds: 120 }] },
          ],
        },
      ]),
      prev,
    );
    expect(result.days[0].id).toBe("day-push");
    expect(result.days[0].exercises[0].id).toBe("ex-bench");
  });

  it("mints a fresh id for a newly added day and its exercises", () => {
    const prev = previousRoutine();
    const result = assembleEditedRoutine(
      payload([
        ...stripToPayload(prev).days,
        {
          name: "Legs",
          exercises: [{ name: "Squat", sets: [{ reps: 5, restSeconds: 180 }] }],
        },
      ]),
      prev,
    );
    expect(result.days).toHaveLength(3);
    expect(result.days[2].id).not.toBe("day-push");
    expect(result.days[2].id).not.toBe("day-pull");
    expect(result.days[2].exercises[0].id).toMatch(/[0-9a-f-]{36}/);
  });

  it("mints a fresh id for a renamed day (its history anchor moves)", () => {
    const prev = previousRoutine();
    const result = assembleEditedRoutine(
      payload([
        {
          name: "Leg Day",
          exercises: [{ name: "Squat", sets: [{ reps: 5, restSeconds: 180 }] }],
        },
      ]),
      prev,
    );
    expect(result.days[0].id).not.toBe("day-push");
    expect(result.days[0].id).not.toBe("day-pull");
  });

  it("mints a fresh id for a swapped-in exercise inside a matched day", () => {
    const prev = previousRoutine();
    const result = assembleEditedRoutine(
      payload([
        {
          name: "Push",
          exercises: [
            { name: "Bench Press", sets: [{ reps: 8, restSeconds: 120 }] },
            { name: "Dips", sets: [{ reps: 12, restSeconds: 60 }] },
          ],
        },
      ]),
      prev,
    );
    expect(result.days[0].exercises[0].id).toBe("ex-bench");
    expect(result.days[0].exercises[1].id).not.toBe("ex-ohp");
    expect(result.days[0].exercises[1].name).toBe("Dips");
  });

  it("does not reuse one previous id twice for duplicate names (match-and-consume)", () => {
    const prev = previousRoutine();
    const result = assembleEditedRoutine(
      payload([
        {
          name: "Push",
          exercises: [
            { name: "Bench Press", sets: [{ reps: 8, restSeconds: 120 }] },
          ],
        },
        {
          name: "Push",
          exercises: [
            { name: "Bench Press", sets: [{ reps: 5, restSeconds: 150 }] },
          ],
        },
      ]),
      prev,
    );
    // First "Push" consumes day-push; the second gets a fresh id.
    expect(result.days[0].id).toBe("day-push");
    expect(result.days[1].id).not.toBe("day-push");
    expect(result.days[0].id).not.toBe(result.days[1].id);
  });

  it("does not reuse one exercise id twice for duplicate exercise names", () => {
    const prev = previousRoutine();
    const result = assembleEditedRoutine(
      payload([
        {
          name: "Push",
          exercises: [
            { name: "Bench Press", sets: [{ reps: 8, restSeconds: 120 }] },
            { name: "Bench Press", sets: [{ reps: 5, restSeconds: 150 }] },
          ],
        },
      ]),
      prev,
    );
    expect(result.days[0].exercises[0].id).toBe("ex-bench");
    expect(result.days[0].exercises[1].id).not.toBe("ex-bench");
    expect(result.days[0].exercises[0].id).not.toBe(
      result.days[0].exercises[1].id,
    );
  });
});
