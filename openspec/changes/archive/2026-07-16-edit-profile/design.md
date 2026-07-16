# Design — edit-profile

## Context

- `useProfile` is read-only; the only writer is `useOnboarding.finish()`. After
  onboarding, saved profile/goals are frozen.
- This change adds a post-onboarding **edit drawer**, pre-filled from saved data,
  reusing onboarding's field model + validation verbatim (`logic/model.ts`).
- Onboarding canonicalizes to SI (lb→kg, in→cm) before write. Seeding an editable
  draft must run the **inverse** so the user sees their own display units.
- Precedent to mirror: `modules/calendar/ui/ActivityDrawer.tsx` (backdrop + panel,
  mount-lifecycle through the exit animation, reduced-motion short-circuit) and
  `RoutineEditor.tsx` (parent owns `open`, seam owns the write).

## Goals / Non-Goals

**Goals**
- One seam hook the drawer consumes, mirroring `useOnboarding` but single-panel.
- Pure inverse unit conversion in `model.ts`.
- An atomic update path in `profileRepo.ts`.
- A feature-local drawer with all 4 close-without-save affordances.

**Non-Goals**
- No new fields, no multi-profile, no cloud, no undo/history (per proposal).
- No generic reusable Drawer atom (see D3).
- No change to onboarding.

## Decisions

### D1 — Seam hook `useProfileEditor(profile, goals)` (engineer)

Single-panel editor mirroring `useOnboarding`'s shape. Renders **all 8** fields at
once (not stepped). Open/close is **NOT** in the hook — it's UI-local, owned by the
mount layer (same call as `RoutineEditor`/`ActivityDrawer`).

```ts
export interface ProfileEditorApi {
  /** All 8 descriptors, unit-aware + error-carrying, via describeField. */
  fields: OnboardingField[];
  setField: (name: FieldName, value: string) => void;
  /** Draft differs from the seeded (saved) values. */
  dirty: boolean;
  phase: "editing" | "saving" | "error";
  saveError: Error | null;
  /** All fields currently valid (convenience; save() re-guards). */
  canSave: boolean;
  /**
   * Validate all 8. If any error, surface it and resolve false (no write).
   * Otherwise persist via saveProfileEdits and resolve true.
   */
  save: () => Promise<boolean>;
  /** Re-seed the draft from the saved records — called on each open + after discard. */
  reset: () => void;
}

export function useProfileEditor(
  profile: Profile,
  goals: Goals | null,
): ProfileEditorApi;
```

- Internal `useReducer` seeded via `recordsToDraft(profile, goals)` (D4). Same
  reducer shape as onboarding: `setField` clears that field's surfaced error and
  leaves any `error` phase.
- `fields` = the 8 field names in onboarding order mapped through `describeField`.
- `save()` runs `validateAll(draft)`; on any non-null, `surfaceErrors` + resolve
  `false`; else `draftToRecords` → `saveProfileEdits` → resolve `true`. Mirrors
  `finish()` but returns success so the drawer closes without a status effect.
- `reset()` re-seeds from the (live-query-fresh) `profile`/`goals` props. The
  drawer calls it on the `false→true` open transition so a reopened drawer always
  shows current saved values and prior unsaved edits are gone.
- **Alternative rejected:** hook reads `useProfile()` itself. Rejected — passing
  the records in keeps the hook pure/testable and matches how the app already
  threads loaded profile/goals down (`FirstRunGate` home slot, `RoutineHomeScreen`).

### D2 — Persistence: `saveProfileEdits(profile, goals)` (engineer)

Add a **distinct** function to `profileRepo.ts`; extract the shared body:

```ts
async function putProfileAndGoals(profile, goals) { /* rw tx: two puts */ }
export async function saveOnboarding(...)   { return putProfileAndGoals(...); }
export async function saveProfileEdits(...) { return putProfileAndGoals(...); }
```

- `put` is already an upsert on the `"me"` singleton, so the transaction body is
  identical — but a distinct name documents update-intent at the call site and
  lets the two paths diverge later (e.g. onboarding `createdAt` vs. edit
  `updatedAt`) without entangling. One extracted helper = zero real duplication.
- **Alternative rejected:** call `saveOnboarding` for edits. Works today, but the
  name lies at the call site and couples the two flows. Cheap to avoid.

### D3 — Drawer lives in `modules/profile-goals/ui` as `ProfileDrawer` (designer)

A **feature composite**, not a `shared/ui/primitives` atom.

- Rationale: precedent (`calendar/ui/ActivityDrawer` is a feature composite), a
  single consumer, and YAGNI — a generic Drawer atom is speculative. There are now
  two drawers in the app but they differ (ActivityDrawer flips to a desktop modal
  at `sm+` and holds non-interactive content; ProfileDrawer is a drawer on both
  viewports holding a form with a focus trap). Extract a shared primitive on the
  *third*, not now. Noted as a future consolidation candidate.
- Firewall: `profile-goals/ui` → its own `logic/` + `shared/ui` only. `ProfileDrawer`
  consumes `useProfileEditor` (intra-feature) and `shared/ui` primitives — compliant.
- Props: `{ open: boolean; onClose: () => void; profile: Profile; goals: Goals | null }`.
  Owns the seam internally: `const editor = useProfileEditor(profile, goals)`.
- Behavior (all in this component):
  - **Layout** top→bottom: "Edit your data" `title-1` + X → the 8 inputs (reuse the
    `OnboardingForm` field→atom mapping: `Input`/`ChoiceGroup`/`CountStepper`),
    two-per-row where they fit → `daysPerWeek` as a **two-column row** (UI layout of
    the same `describeField("daysPerWeek")` 1–7 options — no model change) →
    `ThemeToggle` (reused as-is) → `Save` (`size="lg"`, full-width).
  - **Save**: `if (await editor.save()) onClose()`. On `false` the offending fields
    now carry errors and the drawer stays open (AC2.4).
  - **Discard paths** — all call `onClose()` and persist nothing: X button, backdrop
    click, **swipe-right** (touch), and **Esc** (keyboard-operability requirement;
    beyond the ACs but required by the design system / a11y).
  - **Swipe-right** (net-new — no existing gesture util): `onTouchStart`/`Move`/`End`
    on the panel; if net horizontal drag exceeds a threshold (e.g. ~80px) and is
    dominantly horizontal, `onClose()`. Below threshold snaps back.
  - **Modal semantics**: `role="dialog"` + `aria-modal="true"`, labelled by the
    title; a real **focus trap** cycling Tab within the panel (unlike RoutineEditor's
    non-modal case — this form has many focusables); focus moves in on mount, returns
    to the trigger on close; **body scroll-lock** while open.
  - **Motion**: slide-in-from-right on open, slide-out on close (`anim-slide` /
    `anim-slide-exit`), backdrop `fade`; mount-lifecycle + `prefersReducedMotion()`
    short-circuit copied from `ActivityDrawer` (stay mounted through exit; under
    reduced motion drop to an instant state change). Tokens: `z-overlay` backdrop /
    `z-modal` panel, `elevation-2`, `radius: 0`, `duration-slow`.

### D4 — Inverse conversion in `model.ts` (engineer, pure)

`draftToRecords` canonicalizes to SI; add its inverse so seeding shows display units.

```ts
export function kgToLb(kg: number): number;   // round to whole lb (imperial step is 1)
export function cmToIn(cm: number): number;   // round to whole in  (height step is 1)
export function recordsToDraft(profile: Profile, goals: Goals | null): OnboardingDraft;
export const ALL_FIELD_NAMES: readonly FieldName[];   // 8, onboarding order
export function validateAll(draft: OnboardingDraft): FieldErrors;
```

- `recordsToDraft`: `unit` straight through; metric → `bodyweightKg`/`heightCm`
  shown as-is (`round1`), imperial → `kgToLb`/`cmToIn`. Every possibly-undefined
  field (`displayName`, `heightCm`, and — for pre-2026-07-10 rows — `gender`/`age`;
  see Migration) seeds as `""`. Numbers stringified.
- Round-trip is **not** perfectly lossless (kg→lb→kg drifts ≤ the rounding step).
  Accepted — see Risks.

### D5 — Barrel unchanged

- Nothing new leaves `modules/profile-goals/index.ts`. The seam is **intra-feature**
  (`ProfileDrawer` in `ui/` consumes `useProfileEditor` in `logic/`), so it needs no
  barrel export. The new `model.ts` helpers are internal to `logic/`.
- The app layer deep-imports the drawer: `@/modules/profile-goals/ui/ProfileDrawer`
  — matching the established precedent (`page.tsx` already deep-imports
  `.../ui/FirstRunGate` and `.../ui/Splash`; app/ is exempt from the barrel rule).

### D6 — Mount / trigger (designer wiring at the app layer)

- **Home surface**: `RoutineHomeScreen` (rendered by `page.tsx`'s `home` slot). Its
  identity block ("Hey, {name}" + goal badge) is where saved profile data already
  shows — the natural edit trigger.
- **Trigger contract**: add an optional `onEditProfile?: () => void` prop to
  `RoutineHomeScreen`; when set, it renders an edit affordance in the identity block
  (same pattern as its existing `weekStrip` slot / `onEdit` for the routine editor).
- **State + mount**: a small **app-layer** client wrapper inside `page.tsx`'s home
  slot owns `const [editOpen, setEditOpen] = useState(false)`, renders
  `RoutineHomeScreen` (passing `onEditProfile`) and, as a **sibling**, `<ProfileDrawer
  open={editOpen} onClose={…} profile={profile} goals={goals} />` seeded from the
  `profile`/`goals` the home slot already receives. Sibling, not child — same reason
  `RoutineEditor` sits beside `AppShell`.

## Owners

- **Engineer**: `useProfileEditor` (D1); `saveProfileEdits` + `putProfileAndGoals`
  (D2); `recordsToDraft`/`kgToLb`/`cmToIn`/`ALL_FIELD_NAMES`/`validateAll` (D4).
- **Designer**: `ProfileDrawer` (D3); the two-column days layout; `onEditProfile`
  affordance + app-layer mount wiring (D6).

## Risks / Trade-offs

- **Lossy round-trip** (kg↔lb, cm↔in): opening and re-saving an imperial profile
  without touching those fields can shift the stored SI value by ≤ one rounding
  step. Accepted — imperceptible at whole-lb/in display and simpler than tracking a
  raw entered value. Metric is exact.
- **Two drawers, no shared primitive** (D3): mild duplication with `ActivityDrawer`.
  Accepted deliberately; consolidate on a third drawer.
- **New `onEditProfile` prop on `RoutineHomeScreen`** (another feature): it's a plain
  optional callback slot like `weekStrip`, wired at the app layer — no cross-feature
  import, firewall intact.

## Migration Plan

- No schema/store change; `saveProfileEdits` upserts the same `"me"` singleton rows.
- **Pre-2026-07-10 profiles may have `gender`/`age` undefined** (added after some
  devices onboarded). `recordsToDraft` seeds those as `""`; the drawer shows them as
  empty required fields, and `save()` blocks until filled. **The editor is the fix
  path** for those records — a user who opens it must complete `gender`/`age` to save,
  which backfills the missing data.

## Open Questions

- **Q1 — RESOLVED:** Save is always enabled, gated by `save()` on click (surfaces field errors, no persist on invalid); no disabled-until-valid variant.
