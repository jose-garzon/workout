---
name: project-profile-page-ui
description: profile-page change (2026-08-05) — ProfileScreen/ProfileEditScreen, header swap (ThemeToggle -> ProfileLink), BackLink/LanguageSelect, drawer removal; sr-only/visible heading exception; environment gotchas
metadata:
  type: project
---

Built the designer's half of the `profile-page` OpenSpec change (groups 2,
3.2–3.4, 4.2–4.5, 5, 6.1/6.2/6.4/6.5, 7) alongside the software-engineer
building group 1 (language store) + route wrappers in parallel. All landed
cleanly — no merge conflicts, the documented `useLanguage()`/`useTranslation()`
interface in design.md matched the engineer's actual `shared/i18n/languageStore.ts`
exactly when it landed mid-session, so `LanguageSelect.tsx` (built against the
interface before it existed) needed zero changes once real.

**Header changed for good: `AppShell` is now Logo + `ProfileLink` only.**
[[project-logo-component]]'s "header is Logo+ThemeToggle" note is now stale —
`ThemeToggle` moved off the header entirely and lives ONLY on `/profile`
(`fullWidth` variant, `control-height-md`, in a 50/50 row with the new
`LanguageSelect`). Any future memory/doc referencing "header shows Logo +
ThemeToggle" should be read as historical, not current.

**SUPERSEDED by [[project-profile-page-rework]] (2026-08-05 D11-D17):**
`ProfileLink`/`BackLink` are now BORDERED (`border-border`/`bg-transparent`/
`hover:bg-surface`), not the borderless-muted-icon recipe below — only
`RoutineSummary`'s edit button kept it, so the "4 uses, extract next" count
below no longer holds. `LanguageSelect` was renamed `LanguageToggle` and
lost its `<select>`. The "vertically centered in a large empty band" layout
note below was also reworked to top-aligned. Kept for the extraction/testing
lessons, which still apply.

**New shared components, all reusing the same borderless-muted-icon recipe**
(`h/w tap-target-min, text-text-muted hover:text-text, anim-press, no
border`) that the deleted `ProfileDrawer`'s close button originated:
`BackLink` (chevron-left, `next/link`, generic "Back" label not
per-destination), `ProfileLink` (user glyph — the one place a genuinely
circular SVG shape is fine even under the "zero radius" rule, since that
rule is about rectangle corners, not icon glyph content), and
`RoutineSummary`'s restyled edit button (3rd use of the recipe as a plain
`<button>`, not a `Link`). Now FOUR uses of this exact class string — still
below the designer's own "extract `IconButton` at 4+" threshold noted in
[[project-routine-home-polish]]'s edit-routine addendum, but getting close;
next one to add this pattern should probably extract it.

**Deliberate SAME-text sr-only-h1/visible-h2 exception, contrary to my usual
rule.** [[project-routine-home-polish]] established "give the sr-only
`AppShell` title DIFFERENT text from the visible body heading, or
`getByRole('heading', {name})` finds two matches and throws." This time the
task brief explicitly wanted the OPPOSITE — `ProfileScreen`'s visible `<h2>`
and `AppShell`'s sr-only `<h1>` BOTH say "Profile" (Playwright asserts via
`.first()`). Honored it since e2e specs pinned it as a hard contract, and it
worked fine — just remember `.first()`/`getAllByRole` is required wherever a
same-text screen is queried by role+name, in both RTL and Playwright. Only
`title-1` used once (the shared "Profile" text) keeps the "one title-1 per
screen" design-system rule intact — the person's NAME below it is
deliberately `title-2`, one step down, not competing for the same slot.

**Layout: `ProfileScreen`'s middle content (name + accent "Edit profile" CTA)
sits vertically centered in a large empty band**, via the SAME
"flex-1 justify-center middle content, plain (non-`mt-auto`) bottom dock"
pattern [[project-routine-home-polish]] established for `RoutineHomeScreen`/
`SessionOverview`. Looks airier here than on Home because Profile's top
region (just a back+title row) is much shorter than Home's (greeting + goal
badge + motivation + week strip) — screenshot-verified this is fine/on-brand,
not a bug; kept the established pattern over inventing a top-aligned
alternative for consistency. design.md literally specced `mt-auto` for the
bottom settings row; deviated to the established flex-1 pattern instead
(same visual result — row pinned to the bottom) and documented the deviation
in tasks.md rather than silently diverging.

**`ui/` test firewall bit again** — see [[feedback-ui-tests-cannot-import-shared-db]].
Wrote `ProfileEditScreen.test.tsx` first with a `db.profile.clear()`
`beforeEach` + `db.profile.get("me")` assertions (mirroring
`useProfileEditor.test.tsx`, a `logic/` file that CAN touch db) — Biome
rejected it immediately. Fix: drop the db import/assertions entirely, assert
only `pushMock` calls; "did the byte land" stays `useProfileEditor.test.tsx`'s
job. Should have remembered this from memory before writing the first draft,
not after `bun run check` caught it — grep the memory file BEFORE writing a
`ui/`-directory integration test next time, not after.

**Environment gotchas hit again this session (both already in
[[project-routine-home-polish]], recurring):**
- Stale `next-server` process holding port 3000 from a previous session
  caused 3/9 `--project=chromium` e2e tests to fail with confusing
  behavioral mismatches (old build, no drawer removal, wrong theme
  default) — `pgrep -af "next-server\|next dev\|next start"` + `kill -9`
  by PID before trusting ANY e2e run, every time, not just when something
  looks wrong.
- Default Playwright `workers: 6` crashed the `next start` server mid-run in
  this sandbox (connection-refused cascades on later tests) — `--workers=2`
  fixed it. Not a product bug; a resource-contention ceiling of this
  particular sandbox.
- A `next build` can fail with `ENOENT .../500.html` if a previous build was
  interrupted mid-flight — `rm -rf .next` before rebuilding clears it.

**New: [[feedback-verify-pre-existing-failure-claims]] applied for real.**
Two e2e failures survived a `--workers=2` clean run
(`routine-generation.spec.ts`'s un-`exact`-ed "Male" radio query colliding
with "Female"; `workout-mode.spec.ts`'s overtime-timer assertion, timing-
flaky under this sandbox's contention). Did the full `git stash -u` +
rebuild + rerun against clean `main` before writing them off — both
reproduced identically with zero profile-page code present, confirming
neither is mine. Documented the evidence (not just the claim) directly in
`tasks.md` group 8 rather than silently skipping them.
