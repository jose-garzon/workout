import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/shared/db";
import { server } from "@/test/msw/server";
import { getActive, saveActive } from "./api/routineRepo";
import { useEditStore } from "./logic/editStore";
import { useActiveRoutine } from "./logic/useActiveRoutine";
import { useRoutineEdit } from "./logic/useRoutineEdit";
import type { Routine } from "./types";

/**
 * Real store + real edit client + real Dexie (fake-indexeddb). The proxy is
 * mocked as an SSE stream branching on `mode: "edit"`. Verifies the direct-apply
 * seam: success persists + re-emits via `useActiveRoutine`; error/offline leave
 * the routine unchanged; an empty instruction is a no-op (design.md §D/§E).
 */

/** The active routine before any edit — a single Push day. */
function seed(): Routine {
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
            name: "Bench",
            sets: [{ reps: 8, restSeconds: 120 }],
          },
        ],
      },
    ],
  };
}

/** The model's edited payload: keeps Push, adds a Legs day. */
const EDITED = {
  name: "PPL",
  subtitle: "no excuses",
  days: [
    {
      name: "Push",
      exercises: [{ name: "Bench", sets: [{ reps: 8, restSeconds: 120 }] }],
    },
    {
      name: "Legs",
      exercises: [{ name: "Squat", sets: [{ reps: 5, restSeconds: 180 }] }],
    },
  ],
};

function sseStream(json: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ choices: [{ delta: { content: json } }] })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

/** Streaming edit handler; reports whether it was hit via `onHit`. */
function editHandler(onHit?: () => void) {
  return http.post("/api/generate-routine", () => {
    onHit?.();
    return new HttpResponse(sseStream(JSON.stringify(EDITED)), {
      headers: { "content-type": "text/event-stream" },
    });
  });
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    value: online,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  setOnline(true);
});

beforeEach(async () => {
  useEditStore.getState().reset();
  await db.routines.clear();
  await saveActive(seed());
});

describe("useRoutineEdit — direct-apply", () => {
  it("persists the edited routine and re-emits it via useActiveRoutine", async () => {
    server.use(editHandler());
    const { result } = renderHook(() => ({
      edit: useRoutineEdit(),
      active: useActiveRoutine(),
    }));
    await waitFor(() =>
      expect(result.current.active.routine?.name).toBe("PPL"),
    );

    await act(async () => {
      await result.current.edit.submit("add a legs day");
    });

    expect(result.current.edit.status).toBe("success");
    // Persisted directly, no confirm.
    const saved = await getActive();
    expect(saved?.days.map((d) => d.name)).toEqual(["Push", "Legs"]);
    // Unchanged Push day keeps its id (§C).
    expect(saved?.days[0].id).toBe("day-push");
    // The live query re-emits the update.
    await waitFor(() =>
      expect(result.current.active.routine?.days).toHaveLength(2),
    );
  });

  it("leaves the routine unchanged and surfaces a message on backend error", async () => {
    server.use(
      http.post("/api/generate-routine", () =>
        HttpResponse.json({ error: { kind: "provider" } }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useRoutineEdit());

    await act(async () => {
      await result.current.submit("add a legs day");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/couldn't apply|try again/i);
    expect((await getActive())?.days).toHaveLength(1);
  });

  it("makes no network call offline, keeps the routine, and reports a connection message", async () => {
    let hit = false;
    server.use(
      editHandler(() => {
        hit = true;
      }),
    );
    setOnline(false);
    const { result } = renderHook(() => useRoutineEdit());

    await act(async () => {
      await result.current.submit("add a legs day");
    });

    expect(hit).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/offline|connection/i);
    expect((await getActive())?.days).toHaveLength(1);
  });

  it("is a no-op for an empty / whitespace-only instruction", async () => {
    let hit = false;
    server.use(
      editHandler(() => {
        hit = true;
      }),
    );
    const { result } = renderHook(() => useRoutineEdit());

    await act(async () => {
      await result.current.submit("   ");
    });

    expect(hit).toBe(false);
    expect(result.current.status).toBe("idle");
    expect((await getActive())?.days).toHaveLength(1);
  });
});
