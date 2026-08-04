"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type MeasurementUnit, useProfile } from "@/modules/profile-goals";
import { useActiveRoutine } from "@/modules/routine-generation";
import {
  clearInProgress,
  getInProgress,
  getPreviousReps,
  getPreviousWeight,
  saveCompleted,
  saveInProgress,
  updateRatings,
} from "../api/sessionRepo";
import type {
  CompletedSession,
  CurrentExerciseView,
  OverviewExercise,
  SeriesView,
  SessionStatus,
  TimerView,
} from "../types";
import {
  advanceExercise,
  tap as applyTap,
  defaultRestFor,
  deriveTimer,
  displayToKg,
  initialSession,
  kgToDisplay,
  toCurrentExerciseView,
  toOverviewExercises,
  toSeriesView,
} from "./model";
import { useWorkoutStore } from "./store";
import { useTimerTick } from "./useTimerTick";

/* Re-export the seam view-models through this module so the barrel (§D9) picks
   them up here; they are DEFINED in `../types` to avoid a logic↔logic cycle. */
export type {
  CurrentExerciseView,
  OverviewExercise,
  SeriesView,
  SessionStatus,
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
  previousWeight: number | null;
  /** Reps for the CURRENT set — auto-defaulted to the previous session's reps at this set index (or the plan's), editable for progressive overload. */
  reps: number | null;
  setReps: (value: number | null) => void;
  /** True when the armed set can be started — `ready` phase + a weight entered (§D12). */
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

  const [previousWeightKg, setPreviousWeightKg] = useState<number | null>(null);
  /* Per-set reps `[set0, set1, ...]` from the last completed session that logged
     the current exercise, keyed to the exercise id it was fetched for — see the
     auto-fill effect below for why the id needs to travel with the data. */
  const [previousReps, setPreviousReps] = useState<{
    exerciseId: string;
    reps: number[] | null;
  } | null>(null);

  /* --- Mount / resume (§D4/§D5). Re-runs if the routine identity or the day
     changes; guarded so the routine live-query re-emitting is a no-op. --- */
  const initKey = routineLoading ? null : `${routine?.id ?? "none"}:${dayId}`;
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (initKey === null) return;
    if (initializedRef.current === initKey) return;
    initializedRef.current = initKey;

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

  /* --- Previous-weight lookup (§D6): re-run when the exercise changes. --- */
  const currentExerciseId =
    status === "in-progress" && day && session
      ? (day.exercises[session.currentExerciseIndex]?.id ?? null)
      : null;

  useEffect(() => {
    if (!currentExerciseId) {
      setPreviousWeightKg(null);
      return;
    }
    let cancelled = false;
    getPreviousWeight(currentExerciseId).then((kg) => {
      if (!cancelled) setPreviousWeightKg(kg);
    });
    return () => {
      cancelled = true;
    };
  }, [currentExerciseId]);

  useEffect(() => {
    if (!currentExerciseId) {
      setPreviousReps(null);
      return;
    }
    let cancelled = false;
    getPreviousReps(currentExerciseId).then((reps) => {
      if (!cancelled) setPreviousReps({ exerciseId: currentExerciseId, reps });
    });
    return () => {
      cancelled = true;
    };
  }, [currentExerciseId]);

  /* --- Reps auto-default (mirrors §D6's previous-weight lookup, but COMMITS
     the value into the session instead of just showing a hint): every time a
     NEW set is armed (`enteredReps` reset to null by the `tap`/`advanceExercise`
     reducers), fill it ONCE with that set index's reps from the last session
     that logged this exercise, or the plan's reps for that index. Waits for
     `previousReps` to resolve for THIS exercise first, so it never fills with
     the plan fallback and then jarringly overwrites it once the fetch lands.
     `filledSetRef` remembers which (exercise, set index) it already filled —
     `enteredReps === null` alone can't be the trigger, since the user
     clearing the field to retype ALSO makes it null; without this ref the
     effect would re-stomp their edit back to the default on every keystroke
     that passed through an empty field. */
  const filledSetRef = useRef<string | null>(null);
  useEffect(() => {
    if (status !== "in-progress" || !day || !session || !currentExerciseId) {
      return;
    }
    if (session.phase !== "ready") return;
    if (!previousReps || previousReps.exerciseId !== currentExerciseId) return;

    const index = session.currentSeries.length;
    const key = `${currentExerciseId}:${index}`;
    if (filledSetRef.current === key) return;
    filledSetRef.current = key;
    if (session.enteredReps !== null) return;

    const exercise = day.exercises[session.currentExerciseIndex];
    const defaultReps =
      previousReps.reps?.[index] ?? exercise?.sets[index]?.reps ?? null;
    if (defaultReps === null) return;

    const store = useWorkoutStore.getState();
    const fresh = store.session;
    if (fresh?.phase !== "ready" || fresh.enteredReps !== null) return;
    const next = { ...fresh, enteredReps: defaultReps };
    store.setSession(next);
    if (store.status === "in-progress") void saveInProgress(next);
  }, [status, day, session, currentExerciseId, previousReps]);

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
    await saveInProgress(started);
    store.setSession(started);
    store.setStatus("in-progress");
  }, []);

  const tap = useCallback(async () => {
    const store = useWorkoutStore.getState();
    const s = store.session;
    if (!s || !day || s.phase === "exercise-complete") return;
    // Tap-to-start needs a weight for the set (§D12) — no-op otherwise; the UI
    // surfaces the requirement via `canStartSet`.
    if (s.phase === "ready" && s.enteredWeightKg === null) return;

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

    await saveInProgress(next);
    store.setSession(next);
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
  const previousWeight =
    previousWeightKg == null ? null : kgToDisplay(previousWeightKg, unit);
  const reps = session?.enteredReps ?? null;
  const canStartSet =
    status === "in-progress" && timer.phase === "ready" && weight !== null;
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
    previousWeight,
    reps,
    setReps,
    canStartSet,
    timer,
    completedSets,
    tap,
    nextExercise,
    submitRatings,
  };
}
