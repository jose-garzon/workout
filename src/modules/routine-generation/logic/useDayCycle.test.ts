import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/shared/db";
import { getCompletedDayIdsSince } from "../api/cycleRepo";
import { useDayCycle } from "./useDayCycle";

/** Seam-level behaviour against real Dexie + fake-indexeddb. The repo is wrapped
 *  in a spy so the failed-read path can be exercised without breaking Dexie;
 *  every other test restores the real read. */
vi.mock("../api/cycleRepo", () => ({ getCompletedDayIdsSince: vi.fn() }));
const realRead = (
  await vi.importActual<typeof import("../api/cycleRepo")>("../api/cycleRepo")
).getCompletedDayIdsSince;

const ROUTINE_CREATED_AT = 1_000_000;

async function seedRoutine(createdAt = ROUTINE_CREATED_AT) {
  await db.routines.put({
    id: "active",
    name: "PPL",
    createdAt,
    active: true,
    days: [
      { id: "push", name: "Push", exercises: [] },
      { id: "pull", name: "Pull", exercises: [] },
      { id: "legs", name: "Legs", exercises: [] },
    ],
  });
}

async function seedSession(id: string, dayId: string, completedAt: number) {
  await db.completedSessions.put({
    id,
    routineId: "active",
    dayId,
    completedAt,
    exerciseLogs: [],
  });
}

beforeEach(async () => {
  vi.mocked(getCompletedDayIdsSince).mockImplementation(realRead);
  await Promise.all([db.routines.clear(), db.completedSessions.clear()]);
});

describe("useDayCycle", () => {
  it("has no days and is not loading when there is no active routine", async () => {
    const { result } = renderHook(() => useDayCycle());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.days).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("puts day 1 first as next when the routine has no sessions yet", async () => {
    await seedRoutine();

    const { result } = renderHook(() => useDayCycle());
    await waitFor(() => expect(result.current.days).toHaveLength(3));

    expect(result.current.days.map((d) => [d.id, d.state])).toEqual([
      ["push", "next"],
      ["pull", "idle"],
      ["legs", "idle"],
    ]);
    expect(result.current.loading).toBe(false);
  });

  it("ignores sessions completed before the routine was created", async () => {
    // A regenerated routine: its createdAt is newer than the old sessions, and
    // routineId ("active") can't discriminate them (design.md §D2).
    await seedRoutine();
    await seedSession("old", "push", ROUTINE_CREATED_AT - 1);
    await seedSession("older", "pull", ROUTINE_CREATED_AT - 2);

    const { result } = renderHook(() => useDayCycle());
    await waitFor(() => expect(result.current.days).toHaveLength(3));

    expect(result.current.days.map((d) => [d.id, d.state])).toEqual([
      ["push", "next"],
      ["pull", "idle"],
      ["legs", "idle"],
    ]);
  });

  it("degrades to every day, routine order, all idle when the session read throws", async () => {
    await seedRoutine();
    const boom = new Error("dexie exploded");
    vi.mocked(getCompletedDayIdsSince).mockRejectedValue(boom);

    const { result } = renderHook(() => useDayCycle());
    await waitFor(() => expect(result.current.error).toBe(boom));

    expect(result.current.days.map((d) => [d.id, d.state, d.position])).toEqual(
      [
        ["push", "idle", 1],
        ["pull", "idle", 2],
        ["legs", "idle", 3],
      ],
    );
    expect(result.current.loading).toBe(false);
  });

  it("shows all-idle, still loading, while the session read has not emitted for this routine", async () => {
    // The stale window on a cold load: `useLiveQuery` keeps returning the
    // no-routine result (`dayIds: []`) after `createdAt` resolves, so an
    // unguarded fold would paint day 1 as `next` over a mid-cycle routine —
    // one full paint plus an IndexedDB round trip, not a sub-frame flash.
    await seedRoutine();
    await seedSession("s1", "push", ROUTINE_CREATED_AT + 1);
    let release!: (dayIds: string[]) => void;
    vi.mocked(getCompletedDayIdsSince).mockImplementation(
      () =>
        new Promise<string[]>((resolve) => {
          release = resolve;
        }),
    );

    const { result } = renderHook(() => useDayCycle());
    await waitFor(() => expect(result.current.days).toHaveLength(3));

    expect(result.current.days.map((d) => [d.id, d.state])).toEqual([
      ["push", "idle"],
      ["pull", "idle"],
      ["legs", "idle"],
    ]);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      release(["push"]);
    });

    await waitFor(() => expect(result.current.days[0]?.id).toBe("pull"));
    expect(result.current.days.map((d) => [d.id, d.state])).toEqual([
      ["pull", "next"],
      ["push", "finished"],
      ["legs", "idle"],
    ]);
    expect(result.current.loading).toBe(false);
  });

  it("re-emits with the advanced cycle when a session is completed while mounted", async () => {
    await seedRoutine();

    const { result } = renderHook(() => useDayCycle());
    await waitFor(() => expect(result.current.days[0]?.id).toBe("push"));

    await seedSession("s1", "push", ROUTINE_CREATED_AT + 1);

    await waitFor(() => expect(result.current.days[0]?.id).toBe("pull"));
    expect(result.current.days.map((d) => [d.id, d.state])).toEqual([
      ["pull", "next"],
      ["push", "finished"],
      ["legs", "idle"],
    ]);
  });
});
