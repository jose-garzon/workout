"use client";

import { type Ref, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/shared/i18n";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import type {
  SeriesView,
  SetField,
  WorkoutSessionApi,
} from "../logic/useWorkoutSession";
import { formatClock, Stopwatch } from "./Stopwatch";

export interface ExerciseViewProps {
  session: WorkoutSessionApi;
}

/** Stable identity so `shownErrors === EMPTY_FIELDS` never forces a re-render
 * on its own — same reasoning as `EMPTY_TIMER` in the seam hook. */
const EMPTY_FIELDS: SetField[] = [];

function repsRangeLabel(repsPerSet: number[]): string {
  if (repsPerSet.length === 0) return "—";
  const min = Math.min(...repsPerSet);
  const max = Math.max(...repsPerSet);
  return min === max ? `${min}` : `${min}–${max}`;
}

/**
 * One exercise at a time (exercise-execution spec): the plan, the reps +
 * weight fields (set 1 seeded from the last session's final set, sets 2+
 * carried from the previous set — see design.md §D2/§D3) + a "Last time"
 * reference, the stopwatch, and — once
 * `timer.phase === 'exercise-complete'` — the Next exercise control. On the
 * day's last exercise `status` moves straight to `'success'` (design.md's
 * seam contract), so this component never renders a complete-screen for
 * that case; `WorkoutModeBody` has already swapped it out for `SuccessView`.
 *
 * `gap-6` (24px, not `gap-7`/32px) between the 5 sections below — still
 * inside design-system.md §2's own documented "24–32px between distinct
 * sections" range, just the tighter end of it — reclaimed to help this
 * screen fit a 667px-tall viewport with no page scroll (measured against
 * 375×667; see `SetsProgress`'s own comment for the rest of that budget).
 */
export function ExerciseView({ session }: ExerciseViewProps) {
  const { t } = useTranslation();
  const {
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
  } = session;

  const repsRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  /* Stamped with the set it belongs to (design.md §D6) — a new set or exercise
     changes `setKey`, so `shownErrors` reads back empty on the very next
     render with no `useEffect` reset (and no stale-frame flash of it).
     Folding in `seedKey` (design.md §Risks "stale field error") adds a third
     clearing event: a history seed committing into an already-blocked field
     must not leave it marked red once it's filled. */
  const setKey = `${seedKey}:${timer.currentSeries}`;
  const [errored, setErrored] = useState<{
    setKey: string;
    fields: SetField[];
  }>({ setKey: "", fields: EMPTY_FIELDS });
  const shownErrors = errored.setKey === setKey ? errored.fields : EMPTY_FIELDS;

  if (!currentExercise) return null;

  const unitLabel = unit === "imperial" ? "lb" : "kg";

  // Synchronous — see design.md §D3: focus must land in the same task as the
  // click for iOS Safari to open the soft keyboard.
  const handleTap = () => {
    if (missingSetFields.length > 0) {
      setErrored({ setKey, fields: missingSetFields });
      (missingSetFields[0] === "reps" ? repsRef : weightRef).current?.focus();
      return;
    }
    void tap();
  };

  // Any edit to a field clears ITS error, filled or not (design.md §D6) — only
  // a blocked tap can put an error back, so re-emptying a field doesn't re-error it.
  const clearFieldError = (field: SetField) => {
    if (shownErrors.length === 0) return;
    setErrored({ setKey, fields: shownErrors.filter((f) => f !== field) });
  };
  const errorMessage = t("workout.exercise.fieldRequired");

  return (
    <div className="flex flex-1 flex-col gap-[var(--space-6)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <p className="text-micro text-text-muted">
          {t("workout.exercise.counter", {
            current: currentExercise.index + 1,
            total: currentExercise.total,
          })}
        </p>
        <h2 className="text-title-1">{currentExercise.name}</h2>
        <p className="text-body text-text-muted">
          {t("workout.overview.seriesReps", {
            series: currentExercise.plannedSeries,
            reps: repsRangeLabel(currentExercise.repsPerSet),
          })}
        </p>
      </div>

      <div className="flex flex-col gap-[var(--space-2)]">
        {/* `control-gap-min` (design-system.md §2, 16px) — the floor for
            spacing between two adjacent standalone tap targets, which these
            two fields are now that they sit side by side. */}
        <div className="flex gap-[var(--space-4)]">
          {/* Reps is a plain controlled field — the seam writes its seeded
              value straight into session state (design.md §D2/§D3), so it
              needs no remount-to-reseed trick: the value just flows through
              the `value` prop. */}
          <div className="min-w-0 flex-1">
            <RepsField
              reps={reps}
              setReps={setReps}
              disabled={timer.phase !== "ready"}
              error={shownErrors.includes("reps") ? errorMessage : null}
              inputRef={repsRef}
              onEdit={() => clearFieldError("reps")}
            />
          </div>
          {/* `key` remounts the field fresh whenever the exercise changes OR
              a history seed commits a value into it (design.md §D5) — the
              same "remount to reseed uncontrolled state" pattern `Composer`'s
              prefill uses — so it never fights a controlled
              `value={String(weight)}` binding while the user is mid-decimal.
              `seedKey` only changes when the seam writes a new prefill, never
              on a keystroke, so this can't remount mid-edit. */}
          <div className="min-w-0 flex-1">
            <WeightField
              key={seedKey}
              unitLabel={unitLabel}
              weight={weight}
              setWeight={setWeight}
              // Locked while a set is running (§D12 "editable" only means
              // `ready`, between sets) — armed-but-idle is the one phase the
              // entered weight can still change; `work`/`rest`/`overtime`/
              // `exercise-complete` all lock it so a value can't shift under a
              // set that's already in flight.
              disabled={timer.phase !== "ready"}
              error={shownErrors.includes("weight") ? errorMessage : null}
              inputRef={weightRef}
              onEdit={() => clearFieldError("weight")}
            />
          </div>
        </div>
        {/* Kept to one line at the 375px floor (was a 2-line wrap) — same
            guidance, tighter copy, ~20px less height in the vertical-fit
            budget. Suppressed while a field error shows (design.md §Risks
            "vertical fit"): the error is the more urgent caption and reclaims
            the same line, for net ~zero added height. */}
        {shownErrors.length === 0 && (
          <p className="text-caption text-text-muted">
            {t("workout.exercise.equipmentHint")}
          </p>
        )}
        {/* Exhaustive per design.md §D4 — `weight == null` is the only branch
            this component makes; no unit math, no zero-checking, no history
            reasoning belongs here, that's all folded into `previousSet`. */}
        {previousSet != null && (
          <p className="text-caption text-text-muted">
            {previousSet.weight != null
              ? t("workout.exercise.lastTime", {
                  reps: previousSet.reps,
                  weight: previousSet.weight,
                  unit: unitLabel,
                })
              : t("workout.exercise.lastTimeReps", { reps: previousSet.reps })}
          </p>
        )}
      </div>

      {/* `key` resets the strip's scroll position + cell refs fresh on every
          exercise change — same remount-to-reseed pattern as `WeightField`. */}
      <SetsProgress
        key={currentExercise.id}
        completedSets={completedSets}
        currentSeries={timer.currentSeries}
        plannedSeries={timer.plannedSeries}
        unitLabel={unitLabel}
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-[var(--space-6)]">
        <Stopwatch timer={timer} tap={handleTap} canStartSet={canStartSet} />
      </div>

      {/* Fixed-height slot, ALWAYS rendered at the same size, whether or not
          "Next exercise" is showing — the same fixed-slot fix `Stopwatch`
          already uses for its message text. Without this, the button
          mounting/unmounting changes how much height the flex-1 stopwatch
          block above gets, so the (vertically-centered) circle jumps the
          instant `exercise-complete` is reached / left. Reserving the slot
          unconditionally means the circle's position never depends on
          whether the button is present. */}
      <div
        data-testid="next-exercise-slot"
        className="min-h-[var(--control-height-lg)]"
      >
        {timer.phase === "exercise-complete" && (
          <Button size="lg" fullWidth onClick={() => void nextExercise()}>
            {t("workout.exercise.nextButton")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Above this many planned sets the strip switches to fixed-width cells +
 * horizontal scroll instead of shrinking every cell to stay equal-width
 * (design ask §4: "keep a sensible min cell width so 4 fit on screen"). */
const MAX_VISIBLE_SET_CELLS = 4;

/**
 * "Set N of M" + a single full-width horizontal strip, one cell per planned
 * set (`timer.plannedSeries`), each either a muted "not done yet" placeholder
 * or — once that set appears in `completedSets` — filled `accent` with its
 * reps × weight / work time / volume (revised D1, design.md tasks §9.7, UI
 * does no math: `SeriesView` arrives display-unit-ready).
 *
 * **Fixed footprint, same reserved-slot discipline as the Next-exercise slot
 * below** — the strip's own box height never changes as sets complete — only
 * a cell's fill color/content changes — so the centered `Stopwatch` never
 * moves. At ≤4 planned sets the cells equally divide the full width
 * (`flex-1`, no scroll); above that they lock to a fixed `25%` basis (so
 * exactly 4 are visible at once) and the strip scrolls horizontally,
 * auto-scrolling to the newest completed cell as it's the one MOST worth
 * seeing — but never reordering cells, so "Set N" always reads left-to-right
 * in plan order and the counter above never disagrees with a cell's position.
 *
 * **Row height is `space-9` (48px), down from an earlier 108px** — measured
 * (not guessed) end-to-end via `playwright`/`chromium` against a real
 * 375×667 viewport running the actual app (seeded IndexedDB, real Start →
 * fill weight → work → rest taps), not estimated from CSS alone. Shrinking
 * this row plus the adjacent trims (outer section `gap-6` not `gap-7`,
 * one-line weight hint) cuts this screen's total overflow from ~284px to
 * ~156–164px — a real, verified improvement, but NOT zero: even fully
 * DELETING this whole component (measured by removing it outright) still
 * leaves ~60–68px of overflow on this viewport, from the `Stopwatch`
 * block's own ~266px (the app's "heartbeat," deliberately large per
 * design-system.md Principle 3 — not this component's to resize) plus the
 * `AppShell` header's ~96px — both outside `ExerciseView` entirely. See the
 * `frontend-dev-designer` memory / task report for the full measured
 * breakdown and the two out-of-scope options that WOULD close the rest.
 * Content per cell is intentionally minimal to fit the shorter row: reps×
 * weight and volume are the two visible lines when filled; the full detail
 * (including work time) is still in each cell's `aria-label`, just not
 * rendered visually at this height.
 */
function SetsProgress({
  completedSets,
  currentSeries,
  plannedSeries,
  unitLabel,
}: {
  completedSets: SeriesView[];
  currentSeries: number;
  plannedSeries: number;
  unitLabel: string;
}) {
  const { t } = useTranslation();
  const cellRefs = useRef<Array<HTMLLIElement | null>>([]);
  const isScrollable = plannedSeries > MAX_VISIBLE_SET_CELLS;

  useEffect(() => {
    if (!isScrollable || completedSets.length === 0) return;
    const cell = cellRefs.current[completedSets.length - 1];
    cell?.scrollIntoView?.({
      inline: "center",
      block: "nearest",
      behavior: "auto",
    });
  }, [completedSets.length, isScrollable]);

  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <p
        data-testid="sets-progress-counter"
        className="text-caption text-text-muted tabular-nums"
      >
        {t("workout.set.counter", {
          current: currentSeries,
          total: plannedSeries,
        })}
      </p>
      <ul
        aria-label={t("workout.exercise.setsProgressLabel")}
        data-testid="sets-progress-row"
        className={`anim-scroll-smooth flex h-[var(--space-9)] snap-x snap-mandatory gap-[var(--space-1)] ${
          isScrollable ? "overflow-x-auto" : "overflow-hidden"
        }`}
      >
        {Array.from({ length: plannedSeries }, (_, index) => {
          const set: SeriesView | undefined = completedSets[index];
          const setNumber = index + 1;
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: one cell per planned-set INDEX, a fixed plan-order position for the lifetime of this exercise — never reordered/removed.
              key={index}
              ref={(el) => {
                cellRefs.current[index] = el;
              }}
              aria-label={
                set
                  ? t("workout.exercise.setCell.completed", {
                      number: setNumber,
                      reps: set.reps,
                      weight: set.weight,
                      unit: unitLabel,
                      time: formatClock(set.workSeconds),
                      volume: set.volume,
                    })
                  : t("workout.exercise.setCell.pending", {
                      number: setNumber,
                    })
              }
              className={[
                "flex snap-start flex-col items-center justify-center gap-[var(--space-1)] border border-border px-[var(--space-1)]",
                isScrollable
                  ? "min-w-[4.5rem] flex-[0_0_25%]"
                  : "min-w-0 flex-1",
                set ? "bg-accent text-on-accent" : "bg-surface text-text-muted",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className="flex flex-col items-center gap-[var(--space-1)]"
              >
                {set ? (
                  <>
                    <span className="w-full truncate text-center text-micro tabular-nums">
                      {set.reps}×{set.weight}
                      {unitLabel}
                    </span>
                    <span className="w-full truncate text-center text-micro tabular-nums">
                      {set.volume}
                      {unitLabel}
                    </span>
                  </>
                ) : (
                  <span className="text-micro tabular-nums">
                    {String(setNumber).padStart(2, "0")}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Plain controlled reps input — see the render-site comment for why it skips WeightField's remount-to-reseed pattern. */
function RepsField({
  reps,
  setReps,
  disabled,
  error,
  inputRef,
  onEdit,
}: {
  reps: number | null;
  setReps: (value: number | null) => void;
  disabled: boolean;
  error: string | null;
  inputRef: Ref<HTMLInputElement>;
  /** Fired on every change event, empty or not (design.md §D6) — clears this
   * field's error so re-emptying it doesn't re-error it. */
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const commit = (value: string) => {
    onEdit();
    const trimmed = value.trim();
    if (trimmed === "") {
      setReps(null);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) setReps(parsed);
  };

  return (
    <Input
      ref={inputRef}
      label={t("workout.exercise.repsLabel")}
      type="number"
      size="lg"
      required
      value={reps != null ? String(reps) : ""}
      onChange={commit}
      disabled={disabled}
      error={error}
    />
  );
}

function WeightField({
  unitLabel,
  weight,
  setWeight,
  disabled,
  error,
  inputRef,
  onEdit,
}: {
  unitLabel: string;
  weight: number | null;
  setWeight: (value: number | null) => void;
  disabled: boolean;
  error: string | null;
  inputRef: Ref<HTMLInputElement>;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(weight != null ? String(weight) : "");

  const commit = (value: string) => {
    onEdit();
    setText(value);
    const trimmed = value.trim();
    if (trimmed === "") {
      setWeight(null);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) setWeight(parsed);
  };

  return (
    <Input
      ref={inputRef}
      label={t("workout.exercise.weightLabel")}
      type="number"
      size="lg"
      required
      value={text}
      onChange={commit}
      suffix={unitLabel}
      disabled={disabled}
      error={error}
    />
  );
}
