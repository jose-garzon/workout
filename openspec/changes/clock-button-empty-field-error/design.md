# Design — Clock button: show why a set can't start

## Context

Today `canStartSet = phase 'ready' && weight !== null`. The `Stopwatch` maps it to a
native `disabled`, so a blocked tap is swallowed with zero feedback. Reps are not in
the gate at all: `model.ts:202` logs `enteredReps ?? plan ?? 0`, so an empty reps field
starts the set and records a number the user never confirmed.

Nothing here touches storage shape or the network. The error state is transient screen
state — it is never persisted (it must not leak into `saveInProgress`).

## Goals / Non-Goals

**Goals**

- Reps + weight both gate the start.
- A blocked tap names every empty field (red border + red label + message) and focuses
  the first one (reps before weight).
- The blocked stopwatch accepts taps, stays keyboard-reachable, still reads as waiting.
- A completed set records the reps the user confirmed.

**Non-Goals**

- Validation beyond non-empty. No reps-prefill change. No change to the `work`/`rest`
  field lock, timer cycle, record shape, or persistence. No error styling elsewhere.

## Decisions

### D1 — The rule lives in `logic/`, the "which fields are red right now" lives in `ExerciseView`

The gate is domain: it decides whether a set may start, and the reducer must refuse
regardless of what UI is attached. It stays in `logic/`.

Which fields are *painted* red is presentation: it never persists, never reaches the
record, and has no meaning off-screen. Putting it in the Zustand session store would
either widen the persisted `WorkoutSession` shape or need a parallel non-persisted
slice — machinery for three lines of `useState`.

- *Alternative rejected:* seam owns `fieldErrors` + `clearFieldError`. Bigger API, and
  the seam would need its own set-transition reset logic that the reducer already
  expresses through phase + set index. Every seam consumer/test grows for nothing.
- *Alternative rejected:* native `<form>` + `reportValidity()`. Free focus + message,
  but the bubble is unstylable browser chrome that contradicts the design system, and
  these fields are not in a form.
- Firewall: `ui` imports only its own `logic/` (for `tap`, `missingSetFields`,
  `SetField`) + `shared/ui` + `shared/i18n`. Unchanged direction.

### D2 — Logic↔UI seam contract

`SetField` is defined in `types.ts` (leaf) and re-exported from
`logic/useWorkoutSession.ts` alongside the other view-models — same pattern as
`SeriesView`. It **is** added to the feature barrel: `WorkoutSessionApi` is already
barrel-exported (`index.ts`), so `missingSetFields: SetField[]` would otherwise put an
unexported type in a public interface.

```ts
// modules/workout-mode/types.ts
/** A per-set entry field that gates starting the set. Order is focus order. */
export type SetField = "reps" | "weight";

// modules/workout-mode/logic/useWorkoutSession.ts — WorkoutSessionApi
export interface WorkoutSessionApi {
  // ...unchanged members...

  /**
   * Required fields of the ARMED set that are still empty, in focus order
   * (reps before weight). `[]` when the set can start, and ALWAYS `[]`
   * outside the `ready` phase — nothing is armed to block.
   */
  missingSetFields: SetField[];

  /**
   * True when the armed set can be started.
   * === status === 'in-progress' && timer.phase === 'ready'
   *     && missingSetFields.length === 0
   */
  canStartSet: boolean;

  /** UNCHANGED signature. Still a no-op when a required field is empty. */
  tap: () => Promise<void>;
}
```

`canStartSet` stays a boolean **and** the list is added — they answer different
questions. The boolean drives the waiting visual + `aria-label` (and is false during
`work`/`rest`, where the list is empty, so the list cannot replace it). The list
answers "which field do I redden and focus".

The UI learns which field to focus from `missingSetFields[0]`. On a blocked tap the UI
calls **nothing** on the seam — it reads the list synchronously and handles the
presentation itself (see D3 for why synchronously). `tap()` keeps its own guard as
defense; the rule is derived once, in `logic/`.

UI side, the shape the designer implements in `ExerciseView` (state stamped with the
set it belongs to, so a new set resets it with no effect and no stale frame):

```ts
const setKey = `${currentExercise.id}:${timer.currentSeries}`;
const [errored, setErrored] = useState<{ setKey: string; fields: SetField[] }>({
  setKey: "",
  fields: [],
});
const shownErrors = errored.setKey === setKey ? errored.fields : EMPTY;

const handleTap = () => {                       // sync — see D3
  if (missingSetFields.length > 0) {
    setErrored({ setKey, fields: missingSetFields });
    (missingSetFields[0] === "reps" ? repsRef : weightRef).current?.focus();
    return;
  }
  void tap();
};
```

`StopwatchProps.tap` narrows from `() => Promise<void>` to `() => void`; `Stopwatch`
calls `tap()` instead of `void tap()`. The stopwatch stays dumb — all error
orchestration sits in `ExerciseView`, the one component that owns both fields and the
clock.

### D3 — Focus moves via a `ref` prop on `Input`

`Input` gets `ref?: Ref<HTMLInputElement>` (React 19: `ref` is a plain prop on function
components — no `forwardRef`), spread onto the inner `<input>`. `ExerciseView` holds
`repsRef` / `weightRef`.

- *Alternative rejected:* `document.getElementById(...)`. `Input` derives `inputId` from
  `id ?? label`, and the label is **translated** — the weight field's id is
  `weight-for-this-set` in English and `peso-de-esta-serie` in Spanish. Passing explicit
  `id`s would fix that for these two call sites while leaving a document-global lookup
  and a locale-dependent id scheme for everyone else. The label-derived id is fragile;
  this change does not fix it, but do not build on it.
- Focus is called **synchronously inside the click handler**, before any `await`. iOS
  Safari only opens the soft keyboard for a programmatic `focus()` in the same task as
  the user gesture; resolving a promise first would redden the field but leave the
  keyboard shut — the opposite of the point. This is why `handleTap` reads
  `missingSetFields` instead of awaiting a return value from `tap()`.
- **Owner: frontend-dev-designer.** `shared/ui/primitives/Input.tsx` is a design-system
  file. The engineer does not touch it.

### D4 — The red label lands in the `Input` primitive

When `error` is set, the `<label>` takes `text-danger-text` (`#D03B3B` light /
`#E5605F` dark — the token already used for the message; contrast documented in
design-system.md §"Contrast"). Not `--color-danger`, which is graphical-use-only on dark.

It goes in the primitive, not the call site: the primitive already owns the red border
and the message, and splitting the third signal out lets the three drift.

"Never color alone" holds by construction: `error` is `string | null` and every branch
is `error ? ...`, so an empty message renders *no* error state at all — red without
text is not expressible. The field also carries `aria-invalid` + `role="alert"`.

### D5 — `disabled` → `aria-disabled` on the stopwatch

`Stopwatch` drops the native `disabled` attribute and sets
`aria-disabled={startDisabled || undefined}`.

- Keyboard: removing `disabled` returns the button to the tab order and re-enables
  Enter/Space, which is what "reachable and tappable" requires. `aria-disabled` is
  advisory only — it does not block activation.
- `aria-label` keeps its two variants; `workout.stopwatch.label.readyBlocked`'s *copy* is
  reworded to name both fields (key kept — it is still "the blocked label").
- Visual: `phaseClasses('ready', canStartSet)` is unchanged and stays keyed off
  `canStartSet`; the muted `bg-surface / text-text-muted / border-border` treatment is
  what makes the control read as waiting. Nothing in the class list keys off `:disabled`,
  so removing the attribute changes no pixels. **Do not** add `opacity-40` or
  `pointer-events-none` here (the `Input`/`Button` disabled recipe) — either would
  re-swallow the tap.

### D6 — Error lifecycle

- **Set on:** a blocked tap only — `setErrored({ setKey, fields: missingSetFields })`.
- **Clear per field on:** any change event for that field —
  `setErrored({ setKey, fields: shownErrors.filter((f) => f !== field) })`, wired in
  `ExerciseView`'s `RepsField`/`WeightField` change handlers. Clearing on *any* edit
  (not only on a non-empty value) is what makes "re-emptying does not re-error" fall out
  for free: the entry already removed it, and only a blocked tap can put it back.
- **Reset across sets/exercises:** nothing resets it. `shownErrors` is gated on
  `errored.setKey === setKey`, and `setKey` = `${exercise id}:${timer.currentSeries}`
  changes on both a new set and a new exercise, so the errors evaporate on the same
  render as the transition.
- *Alternative rejected:* `useEffect(() => setErrored([]), [setKey])`. Paints one frame
  of the previous set's errors on the new set before the effect runs — the same
  stale-deps class of bug as serving a previous query result. Stamping the state with
  its owner is one line and cannot be stale.

### D7 — Drop the `?? plan` fallback in `model.ts`

The reducer's `ready` guard becomes:

```ts
if (session.enteredWeightKg === null || session.enteredReps === null) return session;
```

and the `work` branch becomes `const reps = session.enteredReps ?? 0;`.

`?? plan` is not inert defense — if it ever fires it produces a *plausible-looking wrong
answer*: a set recorded with the plan's reps, silently, which is exactly the bug this
change fixes. `?? 0` is only there to satisfy `number`; if it ever fires it produces a
visibly wrong record (0 volume) that a test or the sets strip catches immediately.
Prefer the loud wrong answer over the quiet one.

- *Alternative rejected:* keep `?? plan`. Restates the contract the spec just removed and
  gives a future refactor a soft place to land.
- *Alternative rejected:* throw. A reducer that throws mid-set can wedge the session and
  its persistence, and local-first means nobody sees the error report.
- Stale doc comments on `SeriesLog.reps` ("or the plan's reps … as fallback") and
  `SeriesView.reps` ("The plan's reps for this set index") are corrected in the same pass.

## File ownership

| File | Owner | Change |
| --- | --- | --- |
| `logic/useWorkoutSession.ts` | engineer | `missingSetFields`, widened `canStartSet` |
| `logic/model.ts` | engineer | reps in the `ready` guard, drop `?? plan` |
| `types.ts` | engineer | `SetField`, doc-comment fixes |
| `ui/ExerciseView.tsx` | designer | error state, refs, `handleTap`, error props |
| `ui/Stopwatch.tsx` | designer | `aria-disabled`, `tap: () => void` |
| `shared/ui/primitives/Input.tsx` | designer | `ref` prop, red label |
| `shared/i18n/{en,es}.json` | designer | new error key, reworded hint + blocked label |

New/changed i18n keys (copy is the designer's; both locales in the same commit):
`workout.exercise.fieldRequired` (new, shared by both fields),
`workout.stopwatch.message.enterWeight` → `workout.stopwatch.message.enterRepsWeight`
(renamed — the old name is now false), `workout.stopwatch.label.readyBlocked` (copy only).

## Testing strategy

- **`model.test.ts`** — `ready` tap with `enteredReps === null` returns the session
  unchanged; a `work` tap logs the entered reps. Delete/replace any assertion that a set
  logs planned reps.
- **`useWorkoutSession.test.tsx`** — `missingSetFields` ordering (`["reps","weight"]`
  when both empty), `[]` outside `ready`, `canStartSet` agreement.
- **`workoutMode.test.tsx` (RTL)** — blocked tap reddens the right field(s) and moves
  `document.activeElement`; entry clears one field and not the other; re-emptying does
  not re-error; a new set clears errors; the filled path still starts the set.
- **e2e** — `e2e/workout-mode.spec.ts` should keep passing untouched: reps are
  auto-prefilled at every armed set, so the happy path never hits the gate. Verify
  rather than assume; if it fails it means the prefill did not land, which is a real bug.

## Risks / Trade-offs

- **[Risk] iOS keyboard does not open on the focused field** if any implementation
  slips an `await` in front of `focus()`. → D3's synchronous handler; call it out in the
  task so a later "make it async" refactor does not silently regress it.
- **[Risk] A session already in `work` phase with `enteredReps === null`** (started
  before this ships) logs 0 reps instead of the plan's. → Exposure is one set of one
  in-flight session: the armed-state auto-fill populates reps before `work` is reachable,
  so this only occurs if the user cleared reps under a pre-change build. Accepted.
- **[Risk] The error message eats vertical budget on a screen that already overflows.**
  `ExerciseView`'s measured 375×667 budget (see its `SetsProgress` comment) is ~156–164px
  of overflow *after* the last trim pass, and `Input` renders its message as an extra
  `<p>` below the control — so a blocked tap grows the fields row by one caption line
  (~28px with its gap) and can push the stopwatch further out of view exactly when the
  user is being told to look at it. Both fields erroring costs one line, not two: the
  fields sit side by side, so the messages share the same band. → **Mitigation, decided
  here:** keep `Input`'s standard message placement (no special-casing the primitive) and
  suppress the `workout.exercise.equipmentHint` caption directly below the row while any
  field error is shown — the error is the more urgent caption and it reclaims the same
  line, for net ~zero height. Task 4.6 verifies at 375×667; if it still pushes the
  stopwatch, that is a pre-existing overflow to raise, not to fix here.
- **[Trade-off] Error state is not persisted**, so a mid-error refresh comes back clean.
  Correct: the errors are an answer to a tap, not session data.
- **[Trade-off] Two messages can show at once** — the muted hint under the clock and the
  per-field errors. Kept: the hint explains before the tap, the errors after, and
  suppressing one adds a conditional for no user gain.

## Migration Plan

None. No schema, no stored data, no network. Behavioral only: an empty reps field now
blocks the start, and one i18n key is renamed.

## Open Questions

1. Error copy for `workout.exercise.fieldRequired` and the reworded hint — designer's
   call, not a blocker.
2. Pre-existing drift, **out of scope, flagged not fixed**: `workout-timer`'s "Control
   starts in the work state for a series" scenario predates tap-to-start (the control
   starts in `ready`). Worth its own tiny change; not touched here.
