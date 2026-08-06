# profile-page — Design

## Context

Today: profile editing is a drawer (`modules/profile-goals/ui/ProfileDrawer.tsx`)
opened from an icon in the home identity block; the theme toggle is hardcoded in
`AppShell`'s header; language is resolved once from `navigator.language`, memoised
for the page lifetime, and stored nowhere (`shared/i18n/translate.ts`).

This change moves "about me" onto two real routes, frees the header for a
navigation entry, and makes language a stored, runtime-switchable choice. Three
existing mechanisms carry most of the weight and do not change:

- `useProfile()` — reactive Dexie read of profile + goals.
- `useProfileEditor(profile, goals)` — the whole 8-field draft/validate/save seam.
- `FirstRunGate` — loading → `Splash`, no profile → `WelcomeFlow`, else the slot.

The only genuinely new machinery is a **language store** (the theme store's twin)
and the re-render path that makes a runtime language change visible everywhere.

## Goals / Non-Goals

**Goals:**
- Two routes (`/profile`, `/profile/edit`) reusing the existing profile form seam
  unchanged.
- A stored language choice that wins over browser detection and flips the whole
  UI without a reload, including the language sent to the AI proxy.
- Delete the drawer and its home trigger with no orphaned code or dead keys.
- Restyle the edit-routine button without changing its behaviour or its
  accessible name.

**Non-Goals:**
- No change to profile fields, validation, unit conversion, or persistence shape.
- No change to theme resolution/no-flash behaviour beyond where the toggle lives.
- No new primitive abstraction (no generic `SettingsRow`, no `IconButton`, no
  `Select` primitive) — one native `<select>` and one flex row are enough.
- No global navigation redesign; no back affordance invented (see Open Questions).

## Decisions

### D1 — Two thin App Router routes, gated by the existing `FirstRunGate`

```
src/app/profile/page.tsx          '/profile'
src/app/profile/edit/page.tsx     '/profile/edit'
```

Both are exact copies of `app/page.tsx`'s shape: a client wrapper that mounts
`FirstRunGate` through `next/dynamic` with `ssr:false` and `loading: <Splash/>`,
then renders the new screen from the gate's slot.

```
app/profile/page.tsx        -> FirstRunGate(home=(p,g) => <ProfileScreen displayName={p.displayName}/>)
app/profile/edit/page.tsx   -> FirstRunGate(home=(p,g) => <ProfileEditScreen profile={p} goals={g}/>)
```

Rationale: Dexie is browser-only, so every profile-dependent screen must be
client-rendered and must handle "profile not loaded yet" and "no profile at all".
`FirstRunGate` already does exactly that; reusing it means a deep-linked
`/profile` on a fresh device lands in onboarding for free.

*Alternative rejected:* a route group/shared layout owning the gate once. It
would be less duplication, but the gate must render `Splash` (not a layout
skeleton) and hand `profile`/`goals` **into** the page — a layout cannot pass
props to `children`. Two eight-line files beat a context to move two objects.

*Alternative rejected:* keeping the form in a modal and giving it a URL via
intercepting routes. More Next.js machinery than the proposal asks for, and the
proposal explicitly wants the drawer gone.

`FirstRunGate`'s slot prop stays named `home` — it now means "the
profile-required screen", not literally home. Renaming it churns three call sites
and its test for no behavioural gain.

### D2 — The edit page discards abandoned edits by unmounting, not by `reset()`

The drawer called `editor.reset()` on every closed→open transition because it
stayed mounted. A route unmounts on navigation, so `useProfileEditor`'s reducer
re-initialises from the freshly live-queried `profile`/`goals` on the next visit.
No new code satisfies "re-entering the edit page shows the saved values".

Consequence: `ProfileEditorApi.reset()` has no remaining caller. Keep it — it is
still covered by `useProfileEditor.test.tsx` and removing it is churn.

Save path: `const ok = await editor.save(); if (ok) router.push("/profile")`.
`push` (not `back`) so the destination is deterministic when the edit page is
deep-linked. On `false`, keep the drawer's error handling verbatim: wait a frame,
focus and `scrollIntoView` the first `[role="alert"]` field.

### D3 — Language becomes a Zustand store in `shared/i18n`, mirroring the theme store

New `src/shared/i18n/languageStore.ts` — the single source of truth for *which*
language:

```ts
export type Language = "en" | "es";
export const LANGUAGE_STORAGE_KEY = "wp.lang";

export function resolveLanguage(tag: string | undefined): Language; // moved from translate.ts

interface LanguageState {
  language: Language;
  /** persists to localStorage, sets <html lang>, then updates the store */
  setLanguage: (language: Language) => void;
}
export const useLanguageStore: UseBoundStore<StoreApi<LanguageState>>;

/** Non-React read for `t()` and for api/ai/client.ts. */
export function activeLanguage(): Language;          // useLanguageStore.getState().language

/** Test-only: force the value in memory (no persistence); `null` re-resolves. */
export function setActiveLanguage(language: Language | null): void;
```

Initial value: `typeof window === "undefined" ? "en" : (storedLanguage() ??
resolveLanguage(navigator.language))`. This is the same answer today's lazy
resolution gives (server → `en`, browser → real), so SSR behaviour is unchanged.

`translate.ts` keeps the dictionaries, `KEY_PARITY`, `interpolate`, and `t`, and
imports `activeLanguage` from `languageStore`. Direction is one-way
(`translate → languageStore`), so no cycle. The `@/shared/i18n` barrel keeps
exporting every name it exports today (`activeLanguage`, `resolveLanguage`,
`setActiveLanguage`, `Language`, `t`, `TranslationKey`, `useTranslation`) — the
~20 existing test call sites do not change.

*Alternative rejected:* React context provider. `api/ai/client.ts` and every pure
`model.ts` call `t()`/`activeLanguage()` outside React and could not read a
context — we would need a store anyway, and then two sources of truth.

*Alternative rejected:* `location.reload()` after a change. Correct by brute
force, but it discards in-flight state and reads as a bug on a PWA.

*Alternative rejected:* storing the choice in IndexedDB next to the profile.
The pre-hydration inline script must read it synchronously to set `<html lang>`;
IndexedDB is async. It is also a device preference, not user data — same class as
`wp.theme`, same storage.

### D4 — The re-render path: `useTranslation` subscribes; memoised strings need `language` in their deps

```ts
// shared/i18n/useTranslation.ts
export function useTranslation(): { t: typeof t; language: Language };   // now SUBSCRIBES to the store
export function useLanguage(): { language: Language; setLanguage: (l: Language) => void };
```

`useTranslation()` reads `useLanguageStore(s => s.language)`. Every component
that renders copy already calls it, so a `setLanguage` re-renders all of them.
`t` stays a module-level function and stays referentially stable — safe in
dependency arrays, as today.

**One audited hole:** a `useMemo` that *produces* translated strings will not
recompute, because `t`'s identity does not change. There is exactly one today —
`useCalendar`'s `views` memo (`monthName`, weekday labels) at
`src/modules/calendar/logic/useCalendar.ts:69`. It must add `language` (from
`useTranslation()`) to its dep array. This is a standing rule: **any memo whose
output contains a translated string takes `language` as a dependency.**

`setLanguage` has exactly three effects: write `wp.lang`, set
`document.documentElement.lang`, set store state. The AI needs no wiring —
`api/ai/client.ts` already sends `language: activeLanguage()` per request, so the
next generate/edit picks up the new value.

### D5 — The no-flash inline script also resolves the stored language

`app/layout.tsx`'s `NO_FLASH_THEME_SCRIPT` currently sets `<html lang>` from
`navigator.language` only. It gains the same precedence rule:
`localStorage.getItem('wp.lang')` if it is `en`/`es`, else the `es`-prefix test.
This adds a **third** hand-synced literal alongside `wp.theme` and the `es`-prefix
rule — the script cannot import TS. Accepted, and called out in the file's
existing "keep in sync by hand" comment.

### D6 — Header: one shared, feature-agnostic navigation control

> **Amended by D13 (border) and D14 (hidden on its own destination).**

`AppShell`'s header swaps `<ThemeToggle/>` for a new
`src/shared/ui/components/ProfileLink.tsx` (no props): a `next/link` to
`/profile` rendering a stroke user glyph, `aria-label={t("common.profile.open")}`,
at `--tap-target-min`. `AppShell`'s props are unchanged.

It lives in `shared/ui/components` beside `ThemeToggle` — feature-agnostic
chrome. It targets a **URL string**, never an import of `profile-goals`, so no
new import edge and no firewall implication.

### D7 — The settings row: a flex row, not a new primitive

> **Amended by D15:** the native `<select>` becomes a two-state toggle
> (`LanguageToggle`). The row itself and both `fullWidth` props are unchanged.

`ProfileScreen` renders `<div className="mt-auto flex gap-…">` with both children
`flex-1`. To let them actually fill 50%, both controls take a `fullWidth?:
boolean` prop (default `false`), exactly like `Button`:

- `ThemeToggle({ fullWidth }: { fullWidth?: boolean })` — behaviour untouched.
- new `shared/ui/components/LanguageSelect.tsx`, `{ fullWidth?: boolean }` — a
  native `<select>` at `--control-height-md` bound to `useLanguage()`, options
  `common.language.en` / `common.language.es`, `aria-label={t("common.language.label")}`.

*Alternative rejected:* `ChoiceGroup` segmented. It requires a visible `label`
(the 50% cell has no room), and `role="radiogroup"` reads as a form field rather
than a setting that applies on the spot. Native `<select>` gets keyboard, AT and
mobile pickers for free and is already anticipated by design-system.md §
"Component sizing" ("buttons, inputs, and selects").

*Alternative rejected:* a `SettingsRow` primitive. One row, one use.

### D8 — Edit-routine button: a plain muted icon button, no new `Button` variant

`RoutineSummary` replaces `<Button variant="secondary" size="sm">` with a plain
`<button ref={editButtonRef} aria-label={t("routine.summary.edit")}>` carrying the
same class recipe the deleted home edit-profile icon used
(`h/w --tap-target-min`, `text-text-muted hover:text-text`, `anim-press`, no
border). `RoutineSummaryProps` is **unchanged** — no new prop; the existing
dictionary key becomes the accessible name instead of the visible text, so
`getByRole("button", { name })` queries keep working.

*Alternative rejected:* adding a `ghost` variant to the `Button` primitive. After
this change there are exactly two borderless icon controls (`ProfileLink`, this
one); a third design-system variant for two uses is speculative structure. We
give up centralisation of a three-class recipe — if a third appears, the designer
extracts `IconButton` then.

### D9 — A back control leads the title row on both new pages

> **Amended by D13 (border).**

Both new pages lead their visible title row with a small back control:
`[←] Profile` on `/profile` (target `/`) and `[←] Edit profile` on
`/profile/edit` (target `/profile`). One shared component covers both:

```ts
// src/shared/ui/components/BackLink.tsx
export function BackLink({ href }: { href: string }): JSX.Element
```

A `next/link` with a stroke chevron-left, `aria-label={t("common.back")}`, built
from the same borderless icon recipe as the drawer's deleted close button
(`h/w --tap-target-min`, `text-text-muted hover:text-text`, `anim-press`, no
border). One generic "Back" label, not a per-destination one — the destination is
obvious from where you are, and it keeps this to a single dictionary key.

The edit page gets one too, rather than relying on Save alone: Save is the commit
path, and without a back control the only way out of a half-finished edit would be
the system gesture. Same pattern in both places is also one less thing to explain.

*Alternative rejected:* putting back in `AppShell`'s header-left, in place of the
`Logo`. It would need a new `AppShell` prop, and the header is deliberately
uniform across every screen (Logo left, profile entry right). Page-owned back
keeps the shell untouched.

This makes the borderless-icon recipe appear in three components (`ProfileLink`,
`BackLink`, `RoutineSummary`'s edit) — see D8: still not enough to justify an
`IconButton` primitive, but it is the designer's call to extract one if a fourth
appears.

### D10 — Deletions and dictionary keys

Deleted: `ProfileDrawer.tsx`, `ProfileDrawer.test.tsx`, `RoutineHomeScreen`'s
`onEditProfile` prop + local `EditProfileIcon`, and `app/page.tsx`'s `Home`
wrapper state (`editOpen`) — `Home` keeps only the `sessionSummary` wiring.

Dictionary (parity is compile-enforced by `KEY_PARITY`, so both files move
together): **add** `common.profile.open`, `common.back`, `common.language.label`,
`common.language.en`, `common.language.es`, `profile.title`, `profile.edit.cta`;
**remove** `home.editProfile`, `profile.edit.close` (the drawer's X). Keep
`profile.edit.title` / `.save` / `.saving` / `.error`.

---

## Decisions — design rework (amendment, post-build)

D11–D16 amend the shipped implementation per the proposal's "Design rework"
section. Everything below the settings row and everything in groups 1 (i18n
store), 4 (edit page logic), 6 (drawer removal) and 7 (edit-routine restyle) is
untouched — this is a `ProfileScreen`/nav-chrome pass, not a re-architecture.

### D11 — The name is hero content; the page title stays the heading

Order under the title row on `/profile`: **name** → **goal badge** → **edit card**.

- Title row: `<BackLink/>` + `<h2 className="text-micro text-text-muted">` —
  still the page's semantic heading, now visually an eyebrow. `AppShell`'s
  `sr-only <h1>` is unchanged.
- Name: a `<p className="text-display">` (48px Barlow 800), not a heading. It is
  the page's most prominent text but it is *content*, not structure — keeping
  "Profile" as the `<h2>` preserves a correct outline while satisfying the
  proposal's purely visual "the name dominates".
- `text-display`, not `text-display-brand`: the brand face is Anton with
  `text-transform: uppercase`, which would render "Jose" as "JOSE". A person's
  name keeps its own casing.
- `/profile/edit` gets the same title treatment (`<h2 className="text-micro …">`
  "Edit profile") for consistency; it has no hero text of its own. **Confirmed by
  the user** (was Open Question 3): demote it anyway — the two profile surfaces
  should read as one place, and the form is that page's content.

*Alternative rejected:* promoting the name to the `<h2>` and demoting "Profile" to
a `<p>`. Visually identical, but it makes the page's accessible heading the user's
name, which is worse for AT navigation and for a page that will grow a list of
sections.

### D12 — Goal badge: extract the home badge into `shared/ui/components/GoalBadge`

The proposal asks for "the same badge already shown on home". That badge is
inline JSX plus a local `GOAL_LABEL_KEYS` map in
`modules/routine-generation/ui/RoutineHomeScreen.tsx`. `profile-goals/ui` **cannot
import it** (firewall rule 1: no cross-feature UI imports), so the choice is
duplicate-or-extract.

Extract: `shared/ui/components/GoalBadge.tsx`, `{ focus: string }`, owning the
`home.goal.*` key map and the `accent-wash` chip styling. `RoutineHomeScreen`
adopts it (delete its local map + span, render `<GoalBadge focus={focus} />`);
`ProfileScreen` renders the same component.

Rationale: two real callers, and "same badge" is a *requirement* — duplication
would let them drift, which is precisely what the requirement forbids. The
adoption edit in `RoutineHomeScreen` is a six-line deletion.

**Prop shape for `ProfileScreen`:** it gains `focus?: string`, not the `Goals`
record. `app/profile/page.tsx` passes `focus={goals?.focus ?? "general"}` — the
same flattening and the same fallback `app/page.tsx` already uses for
`RoutineHomeScreen`. The screen needs one field; handing it a domain record it
otherwise ignores would be a wider seam for no gain.

```ts
export interface ProfileScreenProps {
  displayName?: string;
  focus?: string;         // NEW — resolved by the route wrapper, defaults to "general"
}
```

### D13 — Nav controls adopt the existing bordered-control recipe

`ProfileLink` and `BackLink` swap the borderless muted-icon recipe for the app's
already-established bordered-control vocabulary — the one `Button
variant="secondary"` uses: `border border-border bg-transparent text-text
hover:bg-surface`, zero radius, square at `--tap-target-min`. No new token, no
new width, nothing invented.

They cannot literally reuse `Button` (it renders a `<button>`; these are
navigations and must be `<a href>` for middle-click, PWA prefetch and AT link
semantics), so they reuse the *class recipe*. `RoutineSummary`'s edit control
stays borderless — the proposal changes navigation controls only.

### D14 — `ProfileLink` hides itself via `usePathname()`

`ProfileLink` returns `null` when `usePathname()` is `/profile` or starts with
`/profile/`. `AppShell` and every screen stay untouched.

*Alternative rejected:* an `AppShell` prop (`showProfileLink`). It pushes the rule
onto every caller — two screens must remember to pass `false` today, and any
future `/profile/*` page must remember too, with a silent wrong-looking header if
it forgets. We give up "the component is route-agnostic"; the trade is cheap,
since `ProfileLink` already hardcodes the very route it is testing against.

### D15 — `LanguageSelect` → `LanguageToggle` (two-state, ThemeToggle's twin)

Renamed alongside the contract change, so the file matches its sibling
`ThemeToggle` (the e2e file `e2e/language-select.spec.ts` renames with it). Same
`{ fullWidth?: boolean }` prop, same `--control-height-sm` bordered shell, same
`useLanguage()` binding; the `<select>` and its `<option>`s are gone.

```ts
// src/shared/ui/components/LanguageToggle.tsx   (was LanguageSelect.tsx)
export function LanguageToggle({ fullWidth }: { fullWidth?: boolean }): JSX.Element
```

Visible label = the **active** language (`common.language.en` / `.es`), exactly as
`ThemeToggle` shows the active theme. Activating it flips to the other language.

**Accessible name — a deliberate deviation from `ThemeToggle`.** `ThemeToggle`
uses `role="switch"` + `aria-checked`. "Which of two languages" is not an on/off
state, and neither `aria-checked` nor `aria-pressed` would announce truthfully
(checked = Spanish?). So: a plain `<button>` whose `aria-label` states the
*action* — `t("common.language.toSpanish")` / `t("common.language.toEnglish")` —
with the visible text stating the current language. Unambiguous to AT, visually
identical to its neighbour.

*Alternative rejected:* `ChoiceGroup` segmented — the proposal explicitly rules out
an options list. *Alternative rejected:* keeping `role="switch"` for symmetry with
`ThemeToggle` — symmetry of markup is not worth an announcement that misdescribes
the control.

Dictionary: **add** `common.language.toEnglish`, `common.language.toSpanish`;
**remove** `common.language.label` (the `<select>`'s aria-label). Keep
`common.language.en` / `.es` as the visible state labels.

### D16 — Edit-profile card: the day-row recipe, replicated locally

The routine-day cards are inline `<Link>` rows inside
`modules/routine-generation/ui/RoutineSummary.tsx` — not a component, and not
importable from `profile-goals/ui` (firewall rule 1). `ProfileScreen` replicates
the recipe as a local, non-exported `SectionCard`: bordered `<Link>` at
`min-h-[var(--control-height-lg)]`, `border border-border bg-surface`,
`hover:border-text hover:bg-elevated-surface`, label + trailing chevron. It drops
the day row's index numeral and caption line (there is no second line to show).

Replacing the current accent-filled `<Link>` also restores "one full-saturation
accent per screen" — the profile page currently spends its one accent on a
navigation link.

**The card ships inside a list wrapper** (user's call, was Open Question 4): a
plain `<ul className="flex flex-col gap-[var(--space-3)]">` with one `<li>`,
copied from `RoutineSummary`'s day list — the same markup, the same gap token, no
new component. A second editable section is then literally one more `<li>`, and
AT already announces "list, 1 item" rather than a lone orphan link.

*Alternative rejected:* extracting a shared `NavCard` now and refactoring
`RoutineSummary` onto it. The day row carries an index numeral and a two-line
stack this card does not want, so the shared component would immediately need
variants — a bigger change than the duplication it removes. Extract when the
second editable section ships; `SectionCard` is already the right seam to lift.

### D17 — Layout: top-aligned content, bottom row still pinned

`ProfileScreen`'s middle wrapper is `flex flex-1 flex-col justify-center`. **Drop
only `justify-center`.** The wrapper keeps `flex-1`, so it still absorbs the
leftover space and keeps the settings row flush to the bottom — the established
codebase pattern (`RoutineHomeScreen`, `SessionOverview`, and the reason task 3.3
chose it over `mt-auto`). Content then stacks from the top, which is the whole
ask. One word changes; no `mt-auto`, no `AppShell` change.

*Alternative rejected:* dropping the wrapper entirely and pinning the row with
`mt-auto`. Same pixels, but it swaps a pattern used on three screens for a
one-off.

### The logic↔UI interface (the contract the two builders meet at)

```
        app/profile/page.tsx                 app/profile/edit/page.tsx
                 │                                     │
        FirstRunGate (reused)                 FirstRunGate (reused)
                 │                                     │
ProfileScreen{displayName, focus}          ProfileEditScreen{profile, goals}
  │     │      │       │      │                    │              │
Back  Goal   Section  Theme  Language        BackLink("/profile")  useProfileEditor  ← unchanged
Link  Badge   Card    Toggle  Toggle                              │
("/")                   │        │                   saveProfileEdits → Dexie
                   useTheme   useLanguage
                                 │
                  shared/i18n/languageStore ──► t() / activeLanguage() ──► api/ai/client

ProfileLink lives in AppShell's header; it hides itself on /profile*.
```

| Surface | Built by | Contract |
| --- | --- | --- |
| `/profile` | designer | `ProfileScreen({ displayName?: string; focus?: string })`, `'use client'`. Title row = `<BackLink href="/" />` + eyebrow `<h2>`; then hero name, `<GoalBadge/>`, edit card; settings row `mt-auto`. |
| `/profile/edit` | designer | `ProfileEditScreen({ profile: Profile; goals: Goals \| null })`, title row led by `<BackLink href="/profile" />`. Consumes `useProfileEditor` **as-is**: `fields`, `setField`, `phase`, `saveError`, `save()`. Field→atom mapping is the drawer's `Field` switch, moved verbatim. |
| `/profile` route wrapper | engineer | `app/profile/page.tsx` passes `focus={goals?.focus ?? "general"}` from the gate slot (currently dropped). |
| back control | designer | `BackLink({ href: string })` — accessible name `t("common.back")`, bordered (D13). |
| goal badge | designer | `GoalBadge({ focus: string })` in `shared/ui/components`, adopted by `RoutineHomeScreen` too. |
| language store | engineer | `useLanguage(): { language, setLanguage }`; `useTranslation(): { t, language }` (now subscribing); `activeLanguage()`; `LANGUAGE_STORAGE_KEY = "wp.lang"`. |
| header button | designer | `ProfileLink()` — no props, links to `/profile`, accessible name `t("common.profile.open")`, bordered (D13), renders `null` on `/profile*` (D14). |
| settings row | designer | `ThemeToggle({ fullWidth? })`, `LanguageToggle({ fullWidth? })` (renamed from `LanguageSelect`, D15). |
| edit-routine button | designer | `RoutineSummaryProps` unchanged; accessible name = `aria-label={t("routine.summary.edit")}`. |
| calendar memo fix | engineer | `useCalendar`'s `views` memo adds `language` to its deps. |

**Barrel changes:** `modules/profile-goals/index.ts` is **unchanged** — `app/`
deep-imports feature `ui/` today (`FirstRunGate`, `Splash`, `ProfileDrawer`) and
dependency-cruiser rule 3 only constrains `from: ^src/modules/`, so the two new
screens need no export. `shared/i18n/index.ts` adds `useLanguage` (and keeps every
existing export name). No other barrel moves.

**Firewall check:** no new edge crosses a boundary. `profile-goals/ui` imports its
own `logic/` + `shared/ui` + `shared/i18n`; `shared/ui/components` imports
`shared/i18n` + `next/link` (+ `next/navigation` for D14) only; nothing new
touches `shared/db` or a `*Repo`. The rework's two "why not just import it"
questions — the home goal badge (D12) and the routine-day card (D16) — both hit
firewall rule 1: `profile-goals/ui` may not import `routine-generation/ui`. That
is what forces extract-to-`shared/ui` for the badge and replicate-locally for the
card.

## Risks / Trade-offs

- [Stale strings after a language switch — a memo or a value cached across
  renders keeps the old language] → `useTranslation` subscribes, so components
  re-render; the one memo that produces translated strings (`useCalendar.views`)
  gains a `language` dep. A test asserts the month name flips without a reload.
- [Three hand-synced literals now live in the inline `<head>` script (`wp.theme`,
  `wp.lang`, the `es`-prefix rule)] → same accepted trade as today; the script
  cannot import TS. Documented in `layout.tsx` and asserted by an e2e reload test
  (`<html lang>` after choosing Spanish in an English browser).
- [Losing the drawer's focus trap loses "focus returns to the trigger"] → route
  navigation resets focus to the document. Mitigated by each new page rendering a
  real visible heading as its first content, so AT users land on a named page.
  Weaker than a trap; acceptable for full-page navigation, which is the platform
  norm.
- [`/profile` deep-linked on a device with no profile shows onboarding] →
  intended, and free from `FirstRunGate`. Nothing else could sensibly render.
- [Icon-only edit-routine button is less discoverable] → product-owner's call
  (proposal explicitly asks for it); the accessible name is preserved, so AT
  users lose nothing.
- [~~`ChoiceGroup`-free native `<select>`~~] → **resolved by D15**: the `<select>`
  is gone; the language control is a bordered button like every other control.

Rework risks (D11–D17):

- [The day-card recipe now exists in two files (`RoutineSummary`, `ProfileScreen`'s
  `SectionCard`) and can drift] → accepted for one card; the firewall forbids
  sharing it by import, and extracting `NavCard` today would need variants for the
  day row's numeral + caption. Extract when the second editable section ships.
- [`ProfileLink` returning `null` on `/profile*` is invisible to any test that
  renders it in isolation without a router] → tests must mock `usePathname`; the
  header assertion moves to a route-level test. Called out in the tasks.
- [`LanguageToggle` drops `role="switch"` while its neighbour keeps it] → an
  intentional, documented asymmetry (D15). If a later pass unifies them, the fix
  is on `ThemeToggle`'s side, not by making the language control lie.
- [Existing e2e assert the OLD contracts] → `e2e/profile-page.spec.ts` (accent
  button, always-visible header link) and `e2e/language-select.spec.ts`
  (`<select>` with `en`/`es` option values) **will fail** after this rework and
  must be updated as part of the build — see tasks 9.x. Not rewritten here; that
  is the designer's job during apply.
- [`RoutineHomeScreen` is edited to adopt `GoalBadge`] → the only file outside the
  profile surfaces this rework touches. Its existing badge test asserts rendered
  text, which the extraction preserves.

## Migration Plan

No data migration: no Dexie schema change. The absence of `wp.lang` is exactly
today's behaviour (browser detection), so existing installs are unaffected until
the user picks a language.

Build order (each step leaves the app green):

1. **i18n store** (engineer) — `languageStore.ts`, `useTranslation` subscribes,
   `useLanguage`, `useCalendar` dep fix, inline-script update. Behaviour-neutral;
   all existing tests pass unchanged via the preserved `setActiveLanguage`.
2. **Routes + screens** (designer) — `ProfileScreen`, `ProfileEditScreen`,
   `LanguageSelect`, `ThemeToggle.fullWidth`, `ProfileLink`, `BackLink`, both
   `page.tsx`. The drawer still exists at this point; both paths work.
3. **Header swap** (designer) — `AppShell` renders `ProfileLink`.
4. **Delete** (either) — drawer + test, `onEditProfile`, home wiring, dead keys.
5. **Restyle** (designer) — `RoutineSummary`'s button. Independent of 1–4.

Rework order (groups 1–5 are already built and shipped; these amend them):

6. **Chrome** (designer) — `GoalBadge` extraction + `RoutineHomeScreen` adoption,
   `ProfileLink`/`BackLink` border, `ProfileLink`'s `usePathname` guard,
   `LanguageSelect` → `LanguageToggle`. Each is independently shippable.
7. **`focus` thread-through** (engineer) — `app/profile/page.tsx` stops dropping
   `goals`. Must land before or with the badge on `ProfileScreen`.
8. **`ProfileScreen` rework** (designer) — title/name hierarchy, badge, section
   card, top-aligned layout. Depends on 6 and 7.
9. **Tests** (designer) — update the two e2e specs and the `ProfileScreen` /
   `LanguageSelect` unit tests to the new contracts.

Spec-title renames applied at archive time (`profile-edit`): "Edit drawer opens
pre-filled from saved data" → "Edit page opens pre-filled from saved data";
"Save persists edits and closes the drawer" → "…and returns to the profile page";
"Four discard affordances close without saving" is **removed** outright.

Testing:

- **Unit/RTL** — `languageStore` (stored beats browser; `setLanguage` writes
  `wp.lang` + `<html lang>`); a component re-renders in the new language without
  a reload; `ProfileScreen` (title, name, edit link, back link to `/`, exactly two
  controls in the bottom row); `ProfileEditScreen` (pre-filled in the saved unit, invalid save
  persists nothing and stays put, valid save calls `saveProfileEdits` then
  navigates — `next/navigation` mocked); `useCalendar` month name follows a
  language change.
- **Delete** `ProfileDrawer.test.tsx`; retarget `e2e/edit-profile.spec.ts` from
  drawer open/close to header → `/profile` → `/profile/edit` → save → back on
  `/profile`, plus "leave without saving keeps saved values".
- **New e2e** (default `chromium` project, English browser): choose Spanish on
  `/profile` → copy is Spanish → reload → still Spanish. The existing
  `i18n-spanish` project (browser `es-ES`) is untouched and still proves
  detection-without-a-choice.
- **Firewall** — unchanged; `biome check` + `depcruise src` on pre-commit as usual.

Rework testing (amends the above):

- **`ProfileScreen`** — name rendered more prominently than the title (assert the
  hero class / heading structure, not pixels), goal badge shows the focus label,
  the edit entry is a link-card (not the accent button), settings row still holds
  exactly two controls.
- **`ProfileLink`** — renders on a normal screen, renders `null` on `/profile` and
  `/profile/edit` (`usePathname` mocked).
- **`LanguageToggle`** — shows the active language, one activation flips it and
  the accessible name states the action; the old `<select>`/option test is deleted.
- **`GoalBadge`** — one test on the component; `RoutineHomeScreen`'s existing badge
  assertion stays green unchanged.
- **e2e** — `e2e/profile-page.spec.ts` and `e2e/language-select.spec.ts` assert the
  pre-rework contracts (accent CTA, always-present header link, `<select>` with
  `en`/`es` values). Both must be updated during the build; the language spec
  renames with its component.

## Open Questions

1. ~~**No back affordance from `/profile` to home.**~~ **RESOLVED** — the user
   asked for a back control. See D9: a `BackLink` leads the title row on both new
   pages (`/profile` → `/`, `/profile/edit` → `/profile`).
2. **`/profile/edit` with an in-flight save + navigation.** `save()` resolves
   before `router.push`, so there is no window where a navigation cancels a write.
   Confirm no "unsaved changes" prompt is wanted on leave — the proposal's
   acceptance criteria say leaving simply discards.
3. ~~**`/profile/edit`'s hero slot (rework).**~~ **RESOLVED** — demote the edit
   page's title to the same eyebrow treatment as `/profile`, for visual
   consistency; no hero text is added there. See D11; already covered by task 10.6.
4. ~~**Where a second editable section would live (rework).**~~ **RESOLVED** —
   build the list wrapper now: a plain `<ul>` with one `<li>`, so a second section
   is an append rather than a retrofit. See D16; folded into task 10.4.
