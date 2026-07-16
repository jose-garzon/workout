# Proposal — edit-profile (edit saved profile & goals via a drawer)

## Why

Users enter their profile and goals once at onboarding, then can never change
them. `useProfile` is read-only; the only writer is the onboarding finish action.
Bodyweight, goal, training days, units — all of it is fixed after step one. This
change adds the missing capability: edit your saved data after onboarding.

## What Changes

- A **profile drawer** opens over the app on both desktop and mobile (drawer on
  both — no separate desktop layout).
- The drawer is **pre-filled with the current saved profile and goals**.
- All **8 existing fields** are editable, with the **same validation and
  unit-awareness as onboarding**: displayName, gender, age (13–120), unit,
  bodyweight (required), height (optional), focus, daysPerWeek (1–7).
- Drawer layout, top to bottom: "Edit your data" title → the inputs (two per row
  where they fit) → training days (`daysPerWeek`) laid out in a two-column row →
  Save button.
- Switching the **unit** field converts the shown bodyweight/height values (kg↔lb,
  cm↔in) so the number always matches its label — no silent reinterpretation.
- **Save** writes the edited profile and goals to IndexedDB, then closes the
  drawer; the app reflects the new values.
- **Swipe right closes** the drawer **without saving** — edits are discarded.
- **Invalid input blocks Save** (same rules as onboarding).

## Capabilities

### New

- `profile-edit` — the post-onboarding edit surface: a drawer (both viewports)
  pre-filled from saved data, editing all 8 profile/goals fields with onboarding's
  validation and unit-awareness (switching unit converts the shown values),
  Save-persists-and-closes, and swipe-right-discards-and-closes. Local-first: Save
  writes only to IndexedDB, no network.

### Modified

- `profile-persistence` — persistence now covers **updating existing** Profile and
  Goals records, not only the first onboarding write. Editing overwrites the saved
  records in IndexedDB with no network call.

## User stories & acceptance criteria

**Story 1 — open & see my data.** *As a user, I want to open the drawer and see my
saved data so I can change it.*

- **AC1.1** GIVEN saved profile and goals WHEN the user opens the profile drawer
  THEN every field is pre-filled with its current saved value.
- **AC1.2** GIVEN the drawer is open WHEN it is shown THEN `daysPerWeek` is
  presented as a two-column row and the theme toggle and Save button are present.

**Story 2 — edit & save.** *As a user, I want to change a field and save so the app
uses the new value.*

- **AC2.1** GIVEN the drawer is open WHEN the user edits any of the 8 fields THEN
  each field enforces the same validation and unit-awareness as onboarding.
- **AC2.2** GIVEN valid edits WHEN the user activates Save THEN the updated profile
  and goals are written to IndexedDB with no network call and the drawer closes.
- **AC2.3** GIVEN a save has completed WHEN the app re-reads the profile THEN the
  new values are reflected.
- **AC2.4** GIVEN a required field (bodyweight) or any field made empty/invalid
  WHEN the user activates Save THEN Save does not persist and the offending field
  is indicated.
- **AC2.5** GIVEN the drawer shows a value in one unit WHEN the user switches the
  unit field THEN the bodyweight and height values convert to the new unit (kg↔lb,
  cm↔in) so the shown number matches the new label, and Save persists the correct
  underlying value.

**Story 3 — discard.** *As a user, I want to back out without saving.*

- **AC3.1** GIVEN the drawer is open with unsaved edits WHEN the user swipes right
  THEN the drawer closes and the saved data is unchanged.
- **AC3.2** GIVEN the drawer is open with unsaved edits WHEN the user clicks the
  backdrop outside the drawer OR the header close (X) button THEN the drawer closes
  and the saved data is unchanged (same discard behavior as swipe).

## Impact

- **profile-goals module** — `useProfile` is read-only today; editing needs a
  save/update path for existing Profile and Goals records. *The seam/hook is the
  architect's `design.md`.*
- **shared/ui** — no Drawer primitive exists yet; one is needed. *Whether it lives
  in `shared/ui/primitives` is the architect's call.*
- **Reuse** — the drawer reuses the existing field model/validation
  (`modules/profile-goals/logic/model.ts`).
- **Testing** — Playwright over: open → fields pre-filled → edit → unit switch
  converts values → Save persists & reflects → invalid blocks Save → swipe-right
  discards.

## Non-goals

- **No new fields** — the same 8 fields as onboarding, nothing added.
- **No multi-profile / switching** — one profile, edited in place.
- **No cloud sync** — Save writes to IndexedDB only.
- **No change to the onboarding flow** — the setup form is untouched; this is a
  separate post-onboarding surface.
- **No undo / edit history** — Save overwrites; swipe-right discards.

## Priority

Smallest slice that delivers the request: drawer pre-filled from saved data →
edit the 8 fields with onboarding validation → Save persists to IndexedDB and
closes → swipe-right discards. **Not cuttable:** pre-fill + Save-to-IndexedDB +
swipe-to-close — that is the feature. The theme toggle is **out of scope** for
this drawer (theme is changed elsewhere).
