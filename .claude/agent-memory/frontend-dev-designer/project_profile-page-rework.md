---
name: project-profile-page-rework
description: profile-page design REWORK (2026-08-05, D11-D17, tasks groups 9-10) — GoalBadge extraction, bordered nav controls, LanguageSelect->LanguageToggle, hero-name layout; usePathname test-mock ripple; stale-port dev-server gotcha
metadata:
  type: project
---

Second pass on `profile-page` (see [[project-profile-page-ui]] for the first
build) — a post-review rework of the same screens, done solo (engineer's
10.1/group 11 landed in parallel, zero conflicts, contracts matched exactly).

**GoalBadge extraction is the firewall's answer to "same component, two
features."** `profile-goals/ui` cannot import `routine-generation/ui`
(firewall rule 1), so "the profile page shows the same badge as home"
forced an extract-to-`shared/ui/components/GoalBadge.tsx` (`{ focus: string
}`, owns the `home.goal.*` key map + the `accent-wash` chip class).
`RoutineHomeScreen` adopted it (6-line deletion, its existing text-only
assertion stayed green). Contrast: the edit-profile **card** hit the same
firewall wall for "same as the day-row" but design.md deliberately chose
**duplicate-locally** instead (`ProfileScreen`'s non-exported `SectionCard`)
because the day row carries an index numeral + caption this card doesn't
want — extracting would need variants immediately. Rule of thumb going
forward: extract to `shared/ui` when the two callers are asking for the
literally same rendering; replicate locally when one is a strict subset.
`GoalBadge`'s `bg-accent-wash` chip is the app's now-two-caller "accent
status mark, not a CTA" exception — see [[project-accent-fill-discipline]].

**`usePathname()` returns `null` outside a router context — it does NOT
throw** (unlike `useRouter()`, which throws "invariant expected app router
to be mounted"). `ProfileLink`'s hide-on-`/profile*` guard is written
`pathname === "/profile" || pathname?.startsWith("/profile/")` specifically
so the `null` case (no router) degrades to "show the link" rather than
crashing — this is what keeps `AppShell.test.tsx` green with zero changes.

**But a test file that fully REPLACES `next/navigation` via `vi.mock` breaks
the instant `AppShell`→`ProfileLink` needs `usePathname`, even in files
totally unrelated to profile-page.** Any test mocking `next/navigation` with
only `{ useRouter: ... }` and rendering something inside `AppShell` now
throws `"No usePathname export is defined on the mock"` — hit this in
`ProfileEditScreen.test.tsx` (mine) AND `workout-mode/ui/workoutMode.test.tsx`
(not mine, but broken by my shared-component change) — both needed one added
line (`usePathname: () => "/some/route"`). **Any future change to a
component `AppShell` renders unconditionally (`Logo`, `ProfileLink`) is a
cross-feature ripple — grep every `vi.mock("next/navigation"` in the repo,
not just the files you're touching, before calling a shared-chrome change
done.**

**Switching the language store mid-test changes ALL `t()` output, including
a control's own accessible name.** `LanguageToggle`'s aria-label states the
target language via `t()` — after clicking "Switch to Spanish", the WHOLE
UI (including that same button's next aria-label) renders in Spanish
("Cambiar a inglés", not "Switch to English"). A test asserting post-switch
state must query by the localized string, not the English literal — easy to
get wrong once, obvious once you see the failure diff.

**`LanguageToggle` (renamed from `LanguageSelect`) deliberately does NOT
mirror `ThemeToggle`'s `role="switch"`** — "which of two languages" isn't a
boolean, so `aria-checked` can't announce it truthfully. It's a plain
`<button>` whose visible text is the ACTIVE language and whose `aria-label`
states the ACTION (`common.language.toEnglish`/`.toSpanish`). Confirmed
correct by the engineer's independently-written e2e spec matching this
contract exactly (`getByRole("button").filter({ hasText: /English|Español/
})`, never queried by role=switch).

**Dev-server port gotcha, sharper version of [[project-routine-home-polish]]'s
note:** a `bun run dev` that falls back to port 3001 (3000 already held by a
stale process) can itself serve STALE webpack chunks (404s on
`_next/static/chunks/app/page.js`) even on a fresh `next dev` start —
looked exactly like a broken app (blank unstyled "workout-pal" text, no
hydration) but was purely a stale-port artifact. Fix: always
`lsof -ti:3000 | xargs -r kill -9` before starting, don't let it silently
land on 3001.

**Visual self-review (390×844, dark) confirmed the rework hits every D11-D17
beat:** eyebrow `<h2 className="text-micro text-text-muted">` reads clearly
smaller/muted above a genuinely dominant `text-display` name; the
`accent-wash` badge sits directly under the name; the edit-profile
`SectionCard` visually echoes home's day-row card (bordered, chevron, no
accent fill); `ProfileLink` correctly vanishes from `/profile`'s header
(only `Logo` remains) while staying present on `/`; the settings row's two
bordered toggles are pixel-even. No changes needed after the screenshot
pass — first-try alignment against a well-specified design.md.
