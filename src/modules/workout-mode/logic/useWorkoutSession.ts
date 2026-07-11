"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type MeasurementUnit, useProfile } from "@/modules/profile-goals";
import { useActiveRoutine } from "@/modules/routine-generation";
import {
  clearInProgress,
  getInProgress,
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
    canStartSet,
    timer,
    completedSets,
    tap,
    nextExercise,
    submitRatings,
  };
}
