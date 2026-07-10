import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/shared/db";
import { server } from "@/test/msw/server";
import { getActive, saveActive } from "./api/routineRepo";
import { useGenerationStore } from "./logic/generationStore";
import { useRoutineGeneration } from "./logic/useRoutineGeneration";
import type { Routine } from "./types";

/**
 * Real store + real client stream parsing + real Dexie (fake-indexeddb). The
 * proxy route is mocked as an SSE stream (design.md §D3) so `generate` exercises
 * the true reasoning→thinking / content→routine path end to end.
 */

const CTX = {
  focus: "hypertrophy" as const,
  daysPerWeek: 5,
  bodyweightKg: 80,
  unit: "metric" as const,
};

const PAYLOAD = {
  name: "PPL",
  subtitle: "Push, pull, legs — no excuses.",
  days: [
    {
      name: "Push",
      exercises: [
        { name: "Bench Press", sets: [{ reps: 8, restSeconds: 120 }] },
      ],
    },
  ],
};

/** Build an SSE ReadableStream from raw event payload strings. */
function sseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

/** A streaming proxy response: two reasoning deltas, then the JSON in two parts. */
function streamingHandler(payload: object = PAYLOAD) {
  const json = JSON.stringify(payload);
  const mid = Math.floor(json.length / 2);
  return http.post("/api/generate-routine", () => {
    const stream = sseStream([
      JSON.stringify({
        choices: [{ delta: { reasoning: "Picking a split" } }],
      }),
      JSON.stringify({ choices: [{ delta: { reasoning: " and volume." } }] }),
      JSON.stringify({ choices: [{ delta: { content: json.slice(0, mid) } }] }),
      JSON.stringify({ choices: [{ delta: { content: json.slice(mid) } }] }),
    ]);
    return new HttpResponse(stream, {
      headers: { "content-type": "text/event-stream" },
    });
  });
}

afterEach(cleanup);

beforeEach(async () => {
  useGenerationStore.getState().reset();
  await db.routines.clear();
});

describe("generate — streaming", () => {
  it("streams reasoning into progressMessage and validates the routine into result", async () => {
    server.use(streamingHandler());
    const { result } = renderHook(() => useRoutineGeneration());

    await act(async () => {
      await result.current.generate("push pull legs", CTX);
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.progressMessage).toBe("Picking a split and volume.");
    expect(result.current.result?.name).toBe("PPL");
    expect(result.current.result?.subtitle).toBe(
      "Push, pull, legs — no excuses.",
    );
    expect(
      result.current.result?.days[0].exercises[0].sets[0].restSeconds,
    ).toBe(120);
  });

  it("maps a malformed payload to a parse error and holds no result", async () => {
    server.use(streamingHandler({ name: "Broken" })); // missing days → invalid
    const { result } = renderHook(() => useRoutineGeneration());

    await act(async () => {
      await result.current.generate("x", CTX);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toEqual({ kind: "parse" });
    expect(result.current.result).toBeNull();
  });

  it("surfaces an HTTP error without touching persistence", async () => {
    server.use(
      http.post("/api/generate-routine", () =>
        HttpResponse.json({ error: { kind: "rate-limit" } }, { status: 429 }),
      ),
    );
    await saveActive(existing());
    const { result } = renderHook(() => useRoutineGeneration());

    await act(async () => {
      await result.current.generate("x", CTX);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toEqual({ kind: "rate-limit" });
    // The existing routine is untouched (spec: a failed generation preserves it).
    expect((await getActive())?.name).toBe("Existing");
  });
});

function existing(): Routine {
  return {
    id: crypto.randomUUID(),
    name: "Existing",
    createdAt: Date.now(),
    active: true,
    days: [
      {
        id: crypto.randomUUID(),
        name: "Full Body",
        exercises: [
          {
            id: crypto.randomUUID(),
            name: "Squat",
            sets: [{ reps: 5, restSeconds: 180 }],
          },
        ],
      },
    ],
  };
}

describe("confirmSave / reset — adopt vs decline (design.md §D5)", () => {
  it("confirmSave persists the held result as the active routine", async () => {
    server.use(streamingHandler());
    const { result } = renderHook(() => useRoutineGeneration());

    await act(async () => {
      await result.current.generate("ppl", CTX);
    });
    expect(result.current.status).toBe("ready");

    await act(async () => {
      await result.current.confirmSave();
    });

    expect((await getActive())?.name).toBe("PPL");
    // The held result is cleared once persisted.
    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeNull();
  });

  it("reset drops the held result without persisting (declined replacement)", async () => {
    await saveActive(existing());
    server.use(streamingHandler());
    const { result } = renderHook(() => useRoutineGeneration());

    await act(async () => {
      await result.current.generate("ppl", CTX);
    });
    expect(result.current.status).toBe("ready");

    act(() => {
      result.current.reset();
    });

    // The previous routine remains; the new one was never written.
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect((await getActive())?.name).toBe("Existing");
  });
});
