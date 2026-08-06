# profile-page — Tasks

Two parallel tracks off design.md's interface: the **engineer** starts at group 1
(language store), the **designer** starts at group 2 (dictionary + shared
controls). Group 2.1 and 1.1–1.2 are the only cross-track dependencies; groups 6
and 7 land last so the app is never broken mid-flight.

## 1. Language store + seam (i18n)

- [x] 1.1 Add `src/shared/i18n/languageStore.ts`: `LANGUAGE_STORAGE_KEY = "wp.lang"`, `resolveLanguage` (moved from `translate.ts`), the Zustand store with `language` + `setLanguage` (writes localStorage, sets `document.documentElement.lang`, sets state), `activeLanguage()`, and the test-only `setActiveLanguage(l | null)`. Initial value: `typeof window === "undefined" ? "en" : stored ?? resolveLanguage(navigator.language)` (engineer)
- [x] 1.2 Point `translate.ts` at the store (drop its `active` memo + `resolveLanguage`/`setActiveLanguage`), make `useTranslation()` subscribe to `useLanguageStore`, add `useLanguage(): { language, setLanguage }`, and re-export both plus every existing name from `shared/i18n/index.ts` (engineer)
- [x] 1.3 Unit-test the store: a stored choice beats the browser language; no stored choice falls back to `es-*`→es / everything else→en; `setLanguage` writes `wp.lang` and `<html lang>` (engineer)
- [x] 1.4 RTL test: a component rendering `t(...)` re-renders in the new language after `setLanguage`, with no reload (engineer)
- [x] 1.5 Add `language` (from `useTranslation()`) to the `views` memo deps in `src/modules/calendar/logic/useCalendar.ts` and test that the month name follows a language change (engineer)
- [x] 1.6 Extend the inline `NO_FLASH_THEME_SCRIPT` in `src/app/layout.tsx` to read `localStorage.getItem('wp.lang')` (`en`/`es`) before falling back to the `es`-prefix rule, and update its "keep in sync by hand" comment to name the third literal (engineer)
- [x] 1.7 Confirm the whole existing suite still passes unchanged — group 1 is behaviour-neutral (engineer)

## 2. Dictionary + shared controls

- [x] 2.1 Add to `en.json` + `es.json` (parity is compile-enforced): `common.profile.open`, `common.back`, `common.language.label`, `common.language.en`, `common.language.es`, `profile.title`, `profile.edit.cta` (designer)
- [x] 2.2 Add `src/shared/ui/components/BackLink.tsx` — `{ href: string }`, `next/link`, stroke chevron-left, `aria-label={t("common.back")}`, borderless muted icon recipe at `--tap-target-min` (designer)
- [x] 2.3 Add `src/shared/ui/components/ProfileLink.tsx` — no props, links to `/profile`, stroke user glyph, `aria-label={t("common.profile.open")}`, same icon recipe (designer)
- [x] 2.4 Add `fullWidth?: boolean` (default `false`) to `ThemeToggle`, mirroring `Button` (designer)
- [x] 2.5 Add `src/shared/ui/components/LanguageSelect.tsx` — `{ fullWidth?: boolean }`, native `<select>` at `--control-height-md`, zero radius, token border + focus ring, bound to `useLanguage()`, options from `common.language.*`, `aria-label={t("common.language.label")}` (designer, needs 1.2)
- [x] 2.6 RTL test `LanguageSelect`: shows the language in effect, and selecting the other one calls `setLanguage` and switches rendered copy (designer)

## 3. Profile page

- [x] 3.1 Add `src/app/profile/page.tsx` — client wrapper mounting `FirstRunGate` via `next/dynamic` (`ssr:false`, `loading: <Splash/>`), slot renders `<ProfileScreen displayName={profile.displayName} />` (engineer)
- [x] 3.2 Add `src/modules/profile-goals/ui/ProfileScreen.tsx` — inside `AppShell`: title row `<BackLink href="/" />` + visible page title, the display name, and the edit-profile control linking to `/profile/edit` (designer)
- [x] 3.3 Add the bottom settings row to `ProfileScreen`: flex row, `<ThemeToggle fullWidth />` + `<LanguageSelect fullWidth />`, each `flex-1` — pinned to the bottom via the established "flex-1 justify-center" middle-content pattern (`RoutineHomeScreen`/`SessionOverview`) instead of a literal `mt-auto`, same visual result, consistent with the rest of the codebase (designer)
- [x] 3.4 RTL test `ProfileScreen`: title, saved name, edit link to `/profile/edit`, back link to `/`, and exactly two controls in the bottom row (designer)

## 4. Edit-profile page

- [x] 4.1 Add `src/app/profile/edit/page.tsx` — same gate wrapper, slot renders `<ProfileEditScreen profile={profile} goals={goals} />` (engineer)
- [x] 4.2 Add `src/modules/profile-goals/ui/ProfileEditScreen.tsx` — title row `<BackLink href="/profile" />` + visible title; the drawer's `Field` switch and 8-field grid moved verbatim, driven by `useProfileEditor(profile, goals)` (designer)
- [x] 4.3 Wire Save: `await editor.save()` → on `true` `router.push("/profile")`; on `false` keep the drawer's error handling (next frame, focus + `scrollIntoView` the first `[role="alert"]` field). Surface the `phase === "error"` message and the saving label (designer)
- [x] 4.4 RTL test `ProfileEditScreen`: fields pre-filled in the saved unit; a cleared required field blocks Save (nothing persisted, field flagged, no navigation); a valid Save writes via `saveProfileEdits` then navigates to `/profile` (`next/navigation` mocked) (designer)
- [x] 4.5 RTL test: unmounting and re-mounting the screen re-seeds from the saved records, so abandoned edits are gone (designer)

## 5. Header swap

- [x] 5.1 Replace `<ThemeToggle/>` with `<ProfileLink/>` in `src/shared/ui/layout/AppShell.tsx` and update its doc comment; `AppShellProps` unchanged (designer)
- [x] 5.2 Test that the shell header renders the profile control and no theme toggle (designer)

## 6. Remove the drawer

- [x] 6.1 Delete `ProfileDrawer.tsx` and `ProfileDrawer.test.tsx` (designer)
- [x] 6.2 Remove `onEditProfile` and the local `EditProfileIcon` from `RoutineHomeScreen.tsx`, and drop the identity-block edit button (designer)
- [x] 6.3 Strip the drawer wiring from `src/app/page.tsx` — `Home` keeps only the `sessionSummary`/`weekStrip` props, no `editOpen` state (engineer)
- [x] 6.4 Remove the now-dead keys `home.editProfile` and `profile.edit.close` from both dictionaries (designer)
- [x] 6.5 Update any home test asserting the edit-profile icon or `onEditProfile` (designer)

## 7. Edit-routine button restyle

- [x] 7.1 In `RoutineSummary.tsx`, replace the secondary `Button` with a plain icon-only `<button ref={editButtonRef} aria-label={t("routine.summary.edit")}>` using the borderless muted recipe; `RoutineSummaryProps` unchanged (designer)
- [x] 7.2 Verify the existing edit-routine tests still pass by accessible name, and assert no visible text on the control (designer)

## 8. End-to-end + firewall

- [x] 8.1 Retarget `e2e/edit-profile.spec.ts`: header → `/profile` → `/profile/edit` → save → lands on `/profile` with the new name; plus back-without-saving leaves the saved values intact (engineer)
- [x] 8.2 New e2e in the default `chromium` project (English browser): choose Spanish on `/profile` → copy switches with no reload → reload → still Spanish and `<html lang="es">` (engineer)
- [x] 8.3 Run `biome check` + `depcruise src` + typecheck + the full unit and e2e suites green (engineer) — confirmed by designer: `biome check`/`depcruise src`/`tsc --noEmit` clean, 290/290 unit tests green, and `e2e/{profile-page,edit-profile,language-select,edit-routine}.spec.ts` all green in Playwright (`--project=chromium`). Two pre-existing, unrelated failures noted separately below.

**Engineer's full-gate run (all Playwright projects, `--workers=2`): 37 passed,
2 failed.** `biome check` (147 files), `depcruise src` (125 modules),
`tsc --noEmit` and `vitest run` (31 files / 290 tests) are all clean. Both
remaining e2e failures are PRE-EXISTING — each was reproduced in a clean
`git worktree` at HEAD, with none of this change's files present:

- `e2e/workout-mode.spec.ts` "guide a full session" — not flakiness: the session
  screen's new **Reps** field (commit `409fe2e`) added a step, so the recorded
  stopwatch tap sequence now ends mid–set 2 instead of at "Workout complete".
  Owner: workout-mode.
- `e2e/offline.offline.spec.ts` — the offline reload gets `net::ERR_FAILED`; the
  service worker is not serving the cached shell. Owner: PWA/offline.

Fixed in passing (engineer, one-word e2e fix): `e2e/routine-generation.spec.ts`'s
`completeOnboarding` matched `radio "Male"` non-exactly, which also hits
"Female" — a strict-mode violation. Every other spec's copy of that helper
already had `exact: true`; this one was missed. Now green.

Also pinned in this change's two new specs: `test.use({ colorScheme: "dark" })`.
Playwright defaults to `colorScheme: "light"`, which the app *correctly*
resolves to the light theme, so a theme/toggle assertion that assumes the dark
default must say so explicitly.

---

Groups 1–8 are built and shipped. Groups 9–11 are the **design rework** added to
the proposal after reviewing that UI (design.md D11–D17) — amendments, not new
surface. Every 9.x is independently shippable; 10.x depends on 9.1 and 9.5.

## 9. Rework — navigation chrome and shared controls

- [x] 9.1 Extract `src/shared/ui/components/GoalBadge.tsx` (`{ focus: string }`) owning the `home.goal.*` key map and the `accent-wash` chip styling, and adopt it in `RoutineHomeScreen` (delete its local `GOAL_LABEL_KEYS` + inline span). `RoutineHomeScreen`'s existing badge assertion must stay green untouched (designer)
- [x] 9.2 Give `ProfileLink` and `BackLink` the app's bordered-control recipe — `border border-border bg-transparent text-text hover:bg-surface`, zero radius, square at `--tap-target-min`. `RoutineSummary`'s edit button stays borderless (designer)
- [x] 9.3 Make `ProfileLink` render `null` when `usePathname()` is `/profile` or starts with `/profile/`; `AppShell` and every caller stay untouched (designer)
- [x] 9.4 Test `ProfileLink`: renders on a normal route, renders nothing on `/profile` and on `/profile/edit` (`usePathname` mocked) (designer)
- [x] 9.5 Rename `LanguageSelect.tsx` → `LanguageToggle.tsx` and replace the `<select>` with a two-state `<button>`: `ThemeToggle`'s shell and `fullWidth` prop, visible label = the active language, `aria-label` = the action (`common.language.toEnglish` / `.toSpanish`), no `role="switch"` (design.md D15). Update the `ProfileScreen` import (designer)
- [x] 9.6 Dictionary: add `common.language.toEnglish` + `common.language.toSpanish`, remove `common.language.label`, keep `common.language.en` / `.es` as the visible state labels (designer)
- [x] 9.7 Replace the `LanguageSelect` unit test with a `LanguageToggle` one: shows the active language, one activation flips it and switches rendered copy, accessible name states the target language (designer)

## 10. Rework — profile screen

- [x] 10.1 Stop dropping `goals` in `src/app/profile/page.tsx` — pass `focus={goals?.focus ?? "general"}`; `ProfileScreenProps` gains `focus?: string` (engineer)
- [x] 10.2 Demote the title and promote the name in `ProfileScreen`: title row keeps `<BackLink/>` + an `<h2 className="text-micro text-text-muted">` eyebrow; the name becomes a `<p className="text-display">` (designer)
- [x] 10.3 Render `<GoalBadge focus={focus} />` directly under the name (designer)
- [x] 10.4 Replace the accent-filled CTA with a local `SectionCard` `<Link>` using the routine-day-row recipe: `min-h-[var(--control-height-lg)]`, `border border-border bg-surface`, `hover:border-text hover:bg-elevated-surface`, label + trailing chevron, no index numeral or caption line. Wrap it in `RoutineSummary`'s list markup — `<ul className="flex flex-col gap-[var(--space-3)]">` with one `<li>` — so a second section is just an append (designer)
- [x] 10.5 Top-align the content: remove `justify-center` from the middle wrapper, keep its `flex-1` so the settings row stays flush to the bottom (designer)
- [x] 10.6 Give `/profile/edit`'s title the same eyebrow treatment, keeping it an `<h2>` (designer)
- [x] 10.7 Update `ProfileScreen`'s unit test: order (title row → name → badge → card), the name is more prominent than the title, the edit entry is a link-card not the accent button, the badge shows the focus label, and the settings row still holds exactly two controls (designer)

## 11. Rework — e2e and verification

- [x] 11.1 Update `e2e/profile-page.spec.ts` — it asserts the pre-rework contract: goal badge now present, edit entry is a card, header profile link absent on `/profile` and `/profile/edit` but present on home (engineer)
- [x] 11.2 Rename `e2e/language-select.spec.ts` → `e2e/language-toggle.spec.ts` and retarget it at the toggle (no `<select>`, no `en`/`es` option values); the switch → reload → still-Spanish assertions carry over unchanged (engineer)
- [x] 11.3 Re-run `biome check` + `depcruise src` + `tsc --noEmit` + the full unit and e2e suites green; the two pre-existing failures above stay out of scope (engineer)

**Rework full-gate run (engineer):** `biome check` (150 files), `depcruise src`
(128 modules), `tsc --noEmit` and `vitest run` (33 files / 297 tests) all clean.
Playwright, all projects, `--workers=2`: **39 passed, 2 failed** — the same two
PRE-EXISTING failures recorded after group 8 (`e2e/workout-mode.spec.ts`'s stale
stopwatch sequence, `e2e/offline.offline.spec.ts`'s service worker), untouched by
this rework. Every profile-page and language-toggle spec is green.

Gate-running note: `playwright.config.ts` has `reuseExistingServer: !CI`, so a
developer's `next dev` on :3000 gets reused — the suite then runs against DEV
(no service worker, slower compiles) and produces ~15 unrelated failures. Run
the gate on a free port with its own `bun run build && bun run start` when a dev
server is up.
