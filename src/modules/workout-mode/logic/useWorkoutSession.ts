"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type MeasurementUnit, useProfile } from "@/modules/profile-goals";
import { useActiveRoutine } from "@/modules/routine-generation";
import {
  clearInProgress,
  getExerciseHistory,
  getInProgress,
  saveCompleted,
  saveInProgress,
  updateRatings,
} from "../api/sessionRepo";
import type {
  CompletedSession,
  CurrentExerciseView,
  ExerciseHistory,
  OverviewExercise,
  PreviousSetView,
  SeriesView,
  SessionStatus,
  SetField,
  TimerView,
} from "../types";
import {
  advanceExercise,
  tap as applyTap,
  armedSetValues,
  defaultRestFor,
  deriveTimer,
  displayToKg,
  initialSession,
  kgToDisplay,
  toCurrentExerciseView,
  toOverviewExercises,
  toPreviousSetView,
  toSeriesView,
} from "./model";
import { useWorkoutStore } from "./store";
import { useTimerTick } from "./useTimerTick";

/* Re-export the seam view-models through this module so the barrel (§D9) picks
   them up here; they are DEFINED in `../types` to avoid a logic↔logic cycle. */
export type {
  CurrentExerciseView,
  OverviewExercise,
  PreviousSetView,
  SeriesView,
  SessionStatus,
  SetField,
  TimerPhase,
  TimerView,
} from "../types";

/**
 * The one logic↔UI seam (design.md "Logic↔UI seam contract"). Resolves the
 * active routine + the user's unit itself, owns the hot store + the display
 * tick, drives `sessionRepo`, and exposes weight in the user's DISPLAY unit
 * (canonical kg stays in the record, §D11). The screen consumes ONLY this.
 */
export interface WorkoutSessionApi {
  status: SessionStatus;
  dayName: string;

  // --- overview ---
  exercises: OverviewExercise[];
  defaultRestSeconds: number;
  setDefaultRestSeconds: (seconds: number) => void;
  start: () => Promise<void>;

  // --- in-progress ---
  currentExercise: CurrentExerciseView | null;
  unit: MeasurementUnit;
  weight: number | null;
  setWeight: (value: number | null) => void;
  /** The "Last time" reference in DISPLAY units, or null when the exercise has
   *  no history at all. Never blocks anything — read-only. */
  previousSet: PreviousSetView | null;
  /** Opaque. Changes ONLY when the seam commits new prefill values into the
   *  armed set (new exercise, or the async history seed landing). NEVER changes
   *  on a user edit. The UI uses it as the React `key` of any field that keeps
   *  local input state. */
  seedKey: string;
  /** Reps for the CURRENT set — seeded on set 1 from the last session's final set (or the plan's reps), carried from the previous set after that; editable for progressive overload. */
  reps: number | null;
  setReps: (value: number | null) => void;
  /**
   * Required fields of the ARMED set that are still empty, in focus order
   * (reps before weight). `[]` when the set can start, and ALWAYS `[]`
   * outside the `ready` phase — nothing is armed to block.
   */
  missingSetFields: SetField[];
  /** True when the armed set can be started — `ready` phase + reps and weight entered. */
  canStartSet: boolean;
  timer: TimerView;
  /** The CURRENT exercise's finished sets, in order, in DISPLAY units — for a per-set progress list (§D1 revised). */
  completedSets: SeriesView[];
  tap: () => Promise<void>;
  nextExercise: () => Promise<void>;

  // --- completion ---
  submitRatings: (r: {
    difficulty?: number;
    fatigue?: number;
  }) => Promise<void>;
}

const EMPTY_TIMER: TimerView = {
  phase: "work",
  displaySeconds: 0,
  restTotalSeconds: 0,
  overtimeSeconds: 0,
  currentSeries: 1,
  plannedSeries: 0,
};

export function useWorkoutSession(dayId: string): WorkoutSessionApi {
  const { routine, loading: routineLoading } = useActiveRoutine();
  const { profile } = useProfile();
  const unit: MeasurementUnit = profile?.unit ?? "metric";

  const status = useWorkoutStore((s) => s.status);
  const session = useWorkoutStore((s) => s.session);

  const day = useMemo(
    () => routine?.days.find((d) => d.id === dayId) ?? null,
    [routine, dayId],
  );

  /* History per exercise id (prefill-sets D8). KEY PRESENCE is the resolved
     signal and the value is the answer — `null` is a resolved "never logged",
     not a pending read. A single `history` slot could not tell those apart and
     would seed one exercise with the previous one's numbers. */
  const [historyCache, setHistoryCache] = useState<
    Record<string, ExerciseHistory | null>
  >({});
  const inFlightRef = useRef(new Set<string>());
  /* Bumped ONLY when the seed effect commits a new WEIGHT — never on a user
     edit. The UI keys its uncontrolled weight input off this (D5). */
  const [seedStamp, setSeedStamp] = useState(0);
  /** The `${exerciseId}:${setIndex}` this effect has already written to. */
  const filledSetRef = useRef<string | null>(null);

  /* --- Mount / resume (§D4/§D5). Re-runs if the routine identity or the day
     changes; guarded so the routine live-query re-emitting is a no-op. --- */
  const initKey = routineLoading ? null : `${routine?.id ?? "none"}:${dayId}`;
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (initKey === null) return;
    if (initializedRef.current === initKey) return;
    initializedRef.current = initKey;
    // A new session identity ⇒ drop the cache. Within one session the
    // `completedSessions` table it mirrors is immutable (the day's only write
    // happens on the last exercise's completion, after which nothing seeds
    // again), so there is nothing else to invalidate (D8).
    setHistoryCache({});
    inFlightRef.current.clear();

    const store = useWorkoutStore.getState();
    if (!routine || !day) {
      store.setSession(null);
      store.setCompletedId(null);
      store.setStatus("no-routine");
      return;
    }

    store.setStatus("loading");
    let cancelled = false;
    (async () => {
      const existing = await getInProgress(routine.id, dayId);
      if (cancelled) return;
      const next = useWorkoutStore.getState();
      next.setCompletedId(null);
      if (existing) {
        let resumed = existing;
        // §D4: a `work` anchor restored verbatim would bank a whole idle gap as
        // work on the next tap — restart the current series' stopwatch from 0.
        if (resumed.phase === "work") {
          resumed = { ...resumed, anchorTs: Date.now() };
          await saveInProgress(resumed);
          if (cancelled) return;
        }
        // A resumed set past set 1 that is ALREADY ARMED had its one write
        // before the reload, so re-applying the plan here would throw away what
        // the user typed (D9). Set 1 needs no stamp; its fill-if-null guard
        // already protects restored values.
        //
        // `phase === "ready"` is load-bearing: `tap` appends the finished set to
        // `currentSeries` on work → rest, so a session persisted MID-REST — the
        // most likely reload state — already counts a set that has never been
        // armed. Stamping that one would pre-block its only write, and an
        // unlogged exercise would arm set 2 holding set 1's carried reps
        // instead of the plan's.
        const setIndex = resumed.currentSeries.length;
        if (resumed.phase === "ready" && setIndex > 0) {
          const id = day.exercises[resumed.currentExerciseIndex]?.id ?? "";
          filledSetRef.current = `${id}:${setIndex}`;
        }
        next.setSession(resumed);
        next.setStatus("in-progress");
      } else {
        next.setSession(
          initialSession({
            routineId: routine.id,
            dayId,
            defaultRestSeconds: defaultRestFor(day),
            now: Date.now(),
          }),
        );
        next.setStatus("overview");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initKey, routine, day, dayId]);

  /* --- History lookup (D6/D8). `armedExerciseId` covers `overview` too, so
     set 1 is seeded BEFORE the exercise view first paints; `nextExerciseId` is
     prefetched from the moment the current exercise is armed, so advancing
     doesn't flash empty fields either. Prefetch is latency, never correctness:
     a cache miss just means the seed effect waits one more render. --- */
  const armedExerciseId =
    (status === "overview" || status === "in-progress") && day && session
      ? (day.exercises[session.currentExerciseIndex]?.id ?? null)
      : null;
  const nextExerciseId =
    day?.exercises[(session?.currentExerciseIndex ?? 0) + 1]?.id ?? null;

  useEffect(() => {
    for (const id of [armedExerciseId, nextExerciseId]) {
      // `inFlightRef` only stops this re-run (deps include `historyCache`) from
      // re-issuing a read that has not merged yet.
      if (!id || id in historyCache || inFlightRef.current.has(id)) continue;
      inFlightRef.current.add(id);
      getExerciseHistory(id)
        .catch(() => {
          // A rejected read (blocked upgrade, quota, private mode) must still
          // resolve the key: this effect owns the PLAN fallback too, so leaving
          // the id pending forever would arm the set with both fields empty and
          // nothing to explain why. `null` degrades it to the plan.
          return null;
        })
        .then((history) => {
          inFlightRef.current.delete(id);
          setHistoryCache((cache) => ({ ...cache, [id]: history }));
        });
    }
  }, [armedExerciseId, nextExerciseId, historyCache]);

  /* --- Apply the armed set's values (prefill-sets D2, amended by D9). Runs
     once per ARMED SET, not once per exercise: sets 2+ of an exercise with NO
     history have to be re-applied from the plan at that index, or a descending
     12/10/8 plan would carry set 1's 12 forward. `armedSetValues` returns null
     for the one case that must apply nothing (a logged exercise past set 1),
     and the effect just skips.

     Write semantics differ by index on purpose (D9). Set 1 fills only where the
     field is still null: the history read is a real async window and a user who
     typed ahead into it keeps what they typed (AC11). Sets 2+ overwrite: there
     is no async window — plan and history are both resolved the moment the set
     arms — and overwriting is exactly what turns the carried 12 into 10.

     `filledSetRef` remembers which (exercise, set index) it already wrote, and
     caps that at one write, so every edit the user makes afterwards survives.
     `enteredReps === null` can't be the trigger: a user clearing the field to
     retype ALSO makes it null, and the effect would stomp their edit. --- */
  useEffect(() => {
    if (!day || !session || !armedExerciseId) return;
    if (session.phase !== "ready") return;
    const setIndex = session.currentSeries.length;
    const key = `${armedExerciseId}:${setIndex}`;
    if (filledSetRef.current === key) return;
    // Not a key yet = still reading. `historyCache[id] === null` is a resolved
    // "no history" and must fall through to the plan.
    if (!(armedExerciseId in historyCache)) return;
    filledSetRef.current = key;

    const store = useWorkoutStore.getState();
    const fresh = store.session;
    if (fresh?.phase !== "ready") return;
    const exercise = day.exercises[session.currentExerciseIndex];
    const values = armedSetValues({
      history: historyCache[armedExerciseId] ?? null,
      planReps: exercise?.sets.map((set) => set.reps) ?? [],
      setIndex,
      carriedWeightKg: fresh.enteredWeightKg,
    });
    if (!values) return;

    const fillIfNull = setIndex === 0;
    const enteredReps = fillIfNull
      ? (fresh.enteredReps ?? values.reps)
      : // An armed set always has a plan entry, so the fallback only guards a
        // malformed plan — never blank a carried value.
        (values.reps ?? fresh.enteredReps);
    const enteredWeightKg = fillIfNull
      ? (fresh.enteredWeightKg ?? values.weightKg)
      : values.weightKg;
    // A write that would change nothing commits nothing — no store write, no
    // persist, so the UI never re-renders for no reason.
    if (
      enteredReps === fresh.enteredReps &&
      enteredWeightKg === fresh.enteredWeightKg
    ) {
      return;
    }
    const next = { ...fresh, enteredReps, enteredWeightKg };
    store.setSession(next);
    // Only a CHANGED weight needs the uncontrolled `WeightField` remounted (D5);
    // re-applying reps on sets 2+ leaves the weight exactly as it carried.
    if (enteredWeightKg !== fresh.enteredWeightKg) {
      setSeedStamp((stamp) => stamp + 1);
    }
    // Overview-time writes stay store-only; `start()` persists them.
    if (store.status === "in-progress") void saveInProgress(next);
  }, [day, session, armedExerciseId, historyCache]);

  /* --- Display re-render pump; idle unless a live phase is showing. --- */
  const tickPhase =
    status === "in-progress" &&
    (session?.phase === "work" || session?.phase === "rest")
      ? session.phase
      : undefined;
  useTimerTick(tickPhase);

  /* --- Actions. Read the freshest session from the store to dodge stale
     closures; persist on every transition (§D4). --- */
  const start = useCallback(async () => {
    const store = useWorkoutStore.getState();
    const s = store.session;
    if (!s) return;
    const now = Date.now();
    const started = { ...s, startedAt: now, anchorTs: now };
    // Commit BEFORE persisting, exactly as `tap` does: `armedExerciseId` covers
    // `overview` (§D6), so a seed can commit during the IDB write and this
    // stale snapshot would clobber it — leaving a stamped `filledSetRef` with
    // both fields empty and no re-seed.
    store.setSession(started);
    store.setStatus("in-progress");
    await saveInProgress(started);
  }, []);

  const tap = useCallback(async () => {
    const store = useWorkoutStore.getState();
    const s = store.session;
    if (!s || !day || s.phase === "exercise-complete") return;
    // Tap-to-start needs both reps and a weight for the set — no-op otherwise;
    // the UI surfaces which is missing via `missingSetFields`.
    if (
      s.phase === "ready" &&
      (s.enteredWeightKg === null || s.enteredReps === null)
    ) {
      return;
    }

    const now = Date.now();
    const next = applyTap(s, day, now);
    const finishedExercise =
      next.phase === "exercise-complete" &&
      s.currentExerciseIndex === day.exercises.length - 1;

    if (finishedExercise) {
      // §D5 finish sequence: durable completed record BEFORE clearing resume.
      const completed: CompletedSession = {
        id: crypto.randomUUID(),
        routineId: next.routineId,
        dayId: next.dayId,
        completedAt: now,
        exerciseLogs: next.exerciseLogs,
      };
      await saveCompleted(completed);
      await clearInProgress(next.routineId, next.dayId);
      store.setSession(next);
      store.setCompletedId(completed.id);
      store.setStatus("success");
      return;
    }

    // Commit BEFORE persisting: a second tap landing during the IDB write would
    // otherwise read the stale session off the store and be silently dropped.
    store.setSession(next);
    await saveInProgress(next);
  }, [day]);

  const nextExercise = useCallback(async () => {
    const store = useWorkoutStore.getState();
    const s = store.session;
    if (s?.phase !== "exercise-complete") return;
    const next = advanceExercise(s, Date.now());
    await saveInProgress(next);
    store.setSession(next);
  }, []);

  const setWeight = useCallback(
    (value: number | null) => {
      const store = useWorkoutStore.getState();
      const s = store.session;
      if (!s) return;
      const enteredWeightKg = value === null ? null : displayToKg(value, unit);
      const next = { ...s, enteredWeightKg };
      store.setSession(next);
      if (store.status === "in-progress") void saveInProgress(next);
    },
    [unit],
  );

  const setReps = useCallback((value: number | null) => {
    const store = useWorkoutStore.getState();
    const s = store.session;
    if (!s) return;
    const next = { ...s, enteredReps: value };
    store.setSession(next);
    if (store.status === "in-progress") void saveInProgress(next);
  }, []);

  const setDefaultRestSeconds = useCallback((seconds: number) => {
    const store = useWorkoutStore.getState();
    const s = store.session;
    if (!s) return;
    const next = { ...s, defaultRestSeconds: seconds };
    store.setSession(next);
    if (store.status === "in-progress") void saveInProgress(next);
  }, []);

  const submitRatings = useCallback(
    async (r: { difficulty?: number; fatigue?: number }) => {
      const id = useWorkoutStore.getState().completedId;
      if (!id) return;
      await updateRatings(id, r);
    },
    [],
  );

  /* --- Derived view. Timer is recomputed from Date.now() every render (the
     tick just triggers the render), so digits are always exact (§D3). --- */
  const exercises = day ? toOverviewExercises(day) : [];
  const currentExercise =
    status === "in-progress" && day && session
      ? toCurrentExerciseView(day, session.currentExerciseIndex)
      : null;
  const timer =
    status === "in-progress" && day && session
      ? deriveTimer(session, day, Date.now())
      : EMPTY_TIMER;

  const defaultRestSeconds =
    session?.defaultRestSeconds ?? (day ? defaultRestFor(day) : 90);
  const weight =
    session?.enteredWeightKg == null
      ? null
      : kgToDisplay(session.enteredWeightKg, unit);
  const previousSet = armedExerciseId
    ? toPreviousSetView(historyCache[armedExerciseId] ?? null, unit)
    : null;
  const seedKey = `${armedExerciseId ?? ""}:${seedStamp}`;
  const reps = session?.enteredReps ?? null;
  /* Only an ARMED set can be blocked, so this is empty outside `ready`. */
  const missingSetFields: SetField[] = [];
  if (status === "in-progress" && timer.phase === "ready") {
    if (reps === null) missingSetFields.push("reps");
    if (weight === null) missingSetFields.push("weight");
  }
  const canStartSet =
    status === "in-progress" &&
    timer.phase === "ready" &&
    missingSetFields.length === 0;
  /* The current exercise's finished sets in display units; resets automatically
     on `nextExercise` (advanceExercise clears `currentSeries`). */
  const completedSets: SeriesView[] =
    status === "in-progress" && session
      ? session.currentSeries.map((s) => toSeriesView(s, unit))
      : [];

  return {
    status,
    dayName: day?.name ?? "",
    exercises,
    defaultRestSeconds,
    setDefaultRestSeconds,
    start,
    currentExercise,
    unit,
    weight,
    setWeight,
    previousSet,
    seedKey,
    reps,
    setReps,
    missingSetFields,
    canStartSet,
    timer,
    completedSets,
    tap,
    nextExercise,
    submitRatings,
  };
}
