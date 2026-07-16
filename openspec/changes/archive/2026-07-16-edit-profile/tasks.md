# Tasks — edit-profile

## 1. Persistence update path (engineer)

- [x] 1.1 [engineer] Extract `putProfileAndGoals(profile, goals)` (the shared rw tx: two puts) in `profileRepo.ts`; make `saveOnboarding` delegate to it.
- [x] 1.2 [engineer] Add `saveProfileEdits(profile, goals)` delegating to `putProfileAndGoals`.
- [x] 1.3 [engineer] Unit test (fake-indexeddb): `saveProfileEdits` upserts the `"me"` singleton in place, no network.

## 2. Model — inverse conversion + helpers (engineer, pure)

- [x] 2.1 [engineer] Add `kgToLb` / `cmToIn` to `model.ts` (whole-unit rounding, matching imperial/height step of 1).
- [x] 2.2 [engineer] Add `recordsToDraft(profile, goals)`: inverse of `draftToRecords` — metric shown as-is, imperial via `kgToLb`/`cmToIn`; undefined fields (`displayName`, `heightCm`, pre-2026-07-10 `gender`/`age`) seed as `""`; numbers stringified.
- [x] 2.3 [engineer] Add `ALL_FIELD_NAMES` (8, onboarding order) and `validateAll(draft)`.
- [x] 2.4 [engineer] Unit tests: `recordsToDraft` (metric, imperial, undefined gender/age/name/height) and `validateAll`.

## 3. Seam hook `useProfileEditor` (engineer)

- [x] 3.1 [engineer] Implement `useProfileEditor(profile, goals)` per `ProfileEditorApi`: `useReducer` seeded via `recordsToDraft`; `fields` (8 via `describeField`), `setField` (clears that field's error, leaves `error` phase), `dirty`, `phase`, `saveError`, `canSave`, `reset` (re-seed from props), and `save()` — `validateAll` → surface errors + resolve `false`, else `draftToRecords` → `saveProfileEdits` → resolve `true`.
- [x] 3.2 [engineer] Unit tests: `save` blocks + surfaces errors on invalid (false), persists + resolves true on valid; `reset` re-seeds; `dirty` tracks draft-vs-saved.

## 4. `ProfileDrawer` shell + layout (designer)

- [x] 4.1 [designer] Create `modules/profile-goals/ui/ProfileDrawer` (props `{ open, onClose, profile, goals }`): backdrop + right-slide panel, mount-lifecycle through the exit animation + `prefersReducedMotion()` short-circuit (mirror `ActivityDrawer`); tokens `z-overlay`/`z-modal`, `elevation-2`, `radius: 0`, `duration-slow`.
- [x] 4.2 [designer] Layout top→bottom: "Edit your data" `title-1` + X; the 8 inputs via the `OnboardingForm` field→atom mapping, two-per-row where they fit; `daysPerWeek` as a two-column row; full-width `Save` (`size="lg"`) — **always enabled**, gated by `save()` on click. (No theme toggle — descoped 2026-07-15.)
- [x] 4.3 [designer] Modal semantics: `role="dialog"` + `aria-modal="true"` labelled by the title; focus trap cycling Tab within the panel, focus-in on mount, return-to-trigger on close; body scroll-lock while open.
- [x] 4.4 [designer] Four discard affordances (each calls `onClose`, persists nothing): X, backdrop click, Esc, swipe-right (touch: net horizontal drag > ~80px and dominantly horizontal closes, else snap back).

## 5. Wire seam + app mount (designer, waits on §3)

- [x] 5.1 [designer] Consume `useProfileEditor(profile, goals)` in `ProfileDrawer`: bind `fields`/`setField`; Save = `if (await editor.save()) onClose()`; call `reset()` on the `false→true` open transition.
- [x] 5.2 [designer] Add optional `onEditProfile?: () => void` prop to `RoutineHomeScreen`; when set, render an edit affordance in the identity block (same pattern as `weekStrip`/`onEdit`).
- [x] 5.3 [designer] App-layer client wrapper in `page.tsx` home slot: `useState(editOpen)`, render `RoutineHomeScreen` (passing `onEditProfile`) + sibling `<ProfileDrawer open onClose profile goals />` seeded from the home slot's `profile`/`goals`.

## 6. E2E Playwright specs (engineer — write RED first; nothing is built yet)

- [x] 6.1 [engineer] AC1.1 — opening the drawer pre-fills all 8 fields with saved values, bodyweight/height in the chosen unit.
- [x] 6.2 [engineer] AC1.2 — drawer chrome present: `daysPerWeek` two-column row, Save.
- [x] 6.3 [engineer] AC2.1 — editing a field enforces onboarding's rules and unit-aware label.
- [x] 6.4 [engineer] AC2.2 — valid Save writes Profile + Goals to IndexedDB, no network, drawer closes, re-read reflects new values.
- [x] 6.5 [engineer] AC2.5 — switching unit converts shown bodyweight/height (80 kg → ~176 lb); Save persists the correct SI value. (Replaced the descoped theme-toggle test 2026-07-15.)
- [x] 6.6 [engineer] AC2.4 — Save with a cleared required field persists nothing, indicates the field invalid, drawer stays open.
- [x] 6.7 [engineer] AC3.1 — swipe right closes the drawer, saved data unchanged.
- [x] 6.8 [engineer] AC3.2 — backdrop click / X / Escape each close the drawer, saved data unchanged.
- [x] 6.9 [engineer] AC3.3 (reopen-after-discard) — reopening after discard shows saved values, not the discarded edit.

## 7. Revision (2026-07-15 — post-review)

- [x] 7.1 [engineer] Add pure `convertDraftUnits(draft, nextUnit)` to `model.ts` (kg↔lb, cm↔in on bodyweight/height display strings; blanks stay blank) + unit test.
- [x] 7.2 [engineer] In `useProfileEditor` reducer `setField`, when `name === "unit"` and the value changes, run `convertDraftUnits` so shown values match the new label (fixes the code-review data-integrity finding).
- [x] 7.3 [designer] Remove `ThemeToggle` from `ProfileDrawer` (import + render) and any theme assertion in `ProfileDrawer.test.tsx`.

## 8. Verify

- [x] 8.1 [engineer] All E2E specs pass (green), incl. the new unit-conversion test.
- [x] 8.2 [engineer] Biome + dependency-cruiser firewall pass.
- [x] 8.3 [engineer] Unit tests pass.
