## Why

Everything "about me" is scattered: profile editing hides in a drawer launched
from a small icon in the home greeting, and the theme toggle sits permanently in
the app header where it competes with the workout content. There is no place to
change language at all. One profile page gives personal settings a home, frees
the header for a real navigation entry, and clears the home screen down to the
routine.

## What Changes

- **New profile page** showing: the page title, the user's display name, an
  "edit profile" button, and — pinned at the bottom — a single row with the
  theme toggle and a language select, each taking 50% of the row width.
- **New edit-profile page.** The "edit profile" button navigates to a dedicated
  page rendering the existing profile form (same 8 fields, same validation,
  same unit conversion). Saving returns the user to the profile page.
- **Header entry point.** The app header's theme toggle is replaced by a
  user-icon button that navigates to the profile page. The theme toggle now
  lives only on the profile page.
- **BREAKING — profile drawer removed.** The drawer and the home greeting's
  edit-profile icon are deleted. Editing profile data happens only through
  header → profile page → edit page.
- **BREAKING — language becomes user-selectable and persisted.** Today language
  is browser-detected and explicitly never stored. The select lets the user pick
  English or Spanish; the choice persists on-device and wins over browser
  detection. Browser detection remains the default until a choice is made.
- **Back control on both new pages** — the profile page goes back to home, the
  edit-profile page goes back to the profile page. Without it there is no way
  back to home in a standalone PWA window (no browser chrome).
- **Edit-routine button restyled** to match the edit-profile affordance:
  icon-only (no visible text), no border, muted color. Behavior unchanged.

**Design rework (added after first build, on review of the shipped UI):**

- **The name is the page's most important text.** The "Profile" / "Edit profile"
  titles drop to visually secondary; the display name dominates.
- **Goal badge under the name** on the profile page, showing the user's training
  focus — the same badge already shown on home. Data already on device
  (`goals.focus`); nothing new is collected.
- **"Edit profile" becomes a clickable card**, not a primary button — styled like
  home's routine-day list cards. It is the FIRST entry in what will later be a
  list of editable sections; only this one card ships now.
- **Bordered navigation controls.** The header profile link and both back
  controls gain a visible border (they shipped borderless and read as decoration).
- **Header profile link is hidden on the profile pages themselves** — no
  navigation to the page you are already on.
- **Language control becomes a two-state toggle**, visually matching the theme
  toggle, instead of a native dropdown.
- **Top-aligned content.** Name + goal badge + edit card sit directly under the
  title row, not vertically centered. The theme/language row stays pinned at
  the bottom.

## Acceptance Criteria

**Header navigation**
- GIVEN the user is on any screen using the app shell
- WHEN they look at the header
- THEN a user-icon button is shown where the theme toggle used to be, and no
  theme toggle is present in the header
- WHEN they activate the user-icon button
- THEN the app navigates to the profile page

**Profile page contents**
- GIVEN a saved profile with display name "Jose" and focus "hypertrophy"
- WHEN the profile page is shown
- THEN it displays, in order from the top: the "Profile" title row, "Jose", a
  goal badge reading the user's focus, and an edit-profile card
- AND "Jose" is rendered more prominently than the "Profile" title
- AND that content sits directly under the title row, not vertically centered in
  the remaining space
- AND a bottom row holds exactly two controls — the theme toggle and the
  language toggle — side by side, each occupying 50% of the row width

**Editing the profile**
- GIVEN the user is on the profile page
- WHEN they activate the edit-profile card
- THEN the app navigates to a separate edit page showing the same form fields,
  pre-filled with the saved values in the user's chosen unit
- WHEN they save valid values
- THEN the values are written to IndexedDB with no network call and the app
  returns to the profile page showing the updated name
- WHEN they leave the edit page without saving
- THEN the saved data is unchanged, and re-entering the edit page shows the
  saved values, not the abandoned edits

**Invalid input on the edit page**
- GIVEN the edit page with a required field cleared
- WHEN the user saves
- THEN nothing is persisted, the offending field is indicated as invalid, and
  the user stays on the edit page

**Going back**
- GIVEN the profile page
- WHEN the user activates its back control
- THEN the app navigates to home
- GIVEN the edit-profile page with unsaved edits
- WHEN the user activates its back control
- THEN the app navigates to the profile page and nothing is persisted
- AND both back controls expose an accessible name to assistive technology

**Navigation controls are visible affordances**
- WHEN the header profile link or either back control is shown
- THEN each renders with a visible border, matching the app's sharp-rectangle
  bordered controls — none of them reads as bare decoration

**Header profile link is hidden on its own destination**
- GIVEN the user is on the profile page or the edit-profile page
- WHEN the header is shown
- THEN no profile link is present in the header
- GIVEN any other screen using the app shell
- THEN the profile link is present

**Edit-profile card**
- GIVEN the profile page
- WHEN the edit-profile section is shown
- THEN it is a single full-width clickable card matching the visual pattern of
  home's routine-day list cards, not a filled primary button
- AND it is the only card in that section

**Drawer removal**
- GIVEN a saved profile and the home screen
- WHEN the home screen is shown
- THEN no profile drawer exists and no edit-profile control is present on home
- AND there is no way to open a profile drawer from anywhere in the app

**Theme toggle relocation**
- GIVEN the profile page
- WHEN the user toggles to the light theme and reloads the app
- THEN the app renders in light theme on first paint with no flash — theme
  behavior is unchanged, only its location moved

**Language selection**
- GIVEN a browser preferring English and no language chosen yet
- WHEN the profile page is shown
- THEN the language control is a two-state toggle — same visual treatment as the
  theme toggle, no dropdown and no options list to open — showing English as the
  active state
- WHEN the user activates it
- THEN the state flips to Spanish and the visible UI copy switches to Spanish
- AND after a reload the app is still in Spanish, regardless of the browser's
  preferred language
- AND a routine generated or edited after that point returns exercise names in
  Spanish

**Edit-routine button style**
- GIVEN home with an active routine
- WHEN the routine summary is shown
- THEN the edit-routine control is icon-only with no visible text, no border,
  and muted color — visually matching the edit-profile affordance
- AND it still exposes an accessible name to assistive technology
- AND activating it opens the routine editor exactly as before

## Non-goals

- No new or changed profile fields, validation rules, or unit handling — the
  form moves, it does not change.
- No change to theme behavior (dark default, persistence, no-flash) beyond
  where the toggle lives.
- No new languages beyond English and Spanish; no per-string retranslation of
  already-saved routine content when the language changes.
- Nothing else on the profile page: no avatar, no stats/streaks, no data
  export, no delete-my-data, no account/sync.
- The editable-sections list stays single-item: "Edit profile" is the only card
  in this pass. It is shaped to grow, but no second section ships now.
- The goal badge is display-only — the goal is still edited through the profile
  form, not from the badge.
- No global navigation redesign (no bottom tab bar); the header user icon is
  the only new entry point.
- No change to routine-editing behavior — the edit-routine change is purely
  visual.

## Capabilities

### New Capabilities
- `profile-page`: a dedicated profile surface reached from a header user-icon
  button — shows the user's name, an entry point to the profile edit form on
  its own page, and hosts the app's personal settings row (theme + language).

### Modified Capabilities
- `profile-edit`: editing moves from a home-launched drawer to a dedicated
  page; the drawer and its four drawer-specific discard affordances (swipe,
  backdrop, X, Escape) are removed and replaced by page navigation.
- `i18n`: language is no longer browser-detected-only and no longer unstored —
  a user-selected language is persisted on-device and takes precedence over
  browser detection.
- `routine-editing`: the edit affordance on home becomes icon-only with no
  visible text, so its accessible name comes from a label rather than from
  button text.

## Impact

- `src/modules/profile-goals/ui` — drawer removed; the existing form is reused
  by the new edit page.
- `src/shared/ui/layout` + `src/shared/ui/components` — header swaps the theme
  toggle for a navigation button; a language select control is needed.
- `src/shared/i18n` — language resolution gains a stored user choice; the
  active language must now be able to change at runtime.
- `src/app` — two new routes; home's client wrapper loses its drawer wiring.
- `src/modules/routine-generation/ui` — edit-button restyle.
- Existing tests covering the drawer and the home edit affordance are removed
  or retargeted at the new pages.
