---
name: project-routine-home-polish
description: routine-generation home screen polish + edit-routine verification (2026-07-09/12) — layout fixes, stale-port/chromium-cli gotchas, a text-content regression only live verification caught, AppShell `inert` pattern for background-blocking overlays
metadata:
  type: project
---

Polished `src/modules/routine-generation/ui/{RoutineHomeScreen,Composer,
RoutineSummary}.tsx` in response to direct user feedback (name not visible,
double focus ring, empty state lacking an example, general "doesn't enjoy
it" polish). All 4 problems fixed; 66/66 tests green (no test assertions
needed weakening — only the AppShell `title` had to change, see below),
`tsc`/biome/depcruise clean except one **pre-existing, unrelated** biome
format failure in `api/ai/openrouter.ts` that I never touched (untracked
file, presumably mid-flight from the software-engineer's parallel work —
not mine to fix, flagged rather than silently left).

**1. Visible greeting — the `AppShell` sr-only-title trap, again.**
Same root cause as [[project-logo-component]]'s round 4 fallout on
`OnboardingForm`: `AppShell`'s `<h1>{title}</h1>` is `sr-only`, so passing
`title={`Hey, ${name}`}` only ever reached screen readers. Fix: pass a
short generic noun to `AppShell` instead (`title="Home"`, matching
`CalendarScreen`'s `"Calendar"` / `WorkoutModeScreen`'s `"Workout"`
convention), and render the REAL greeting as a visible `<h2
className="text-title-1">Hey, {name}</h2>` in the body, first thing in the
identity block. **Important gotcha this time that didn't bite on
OnboardingForm:** if you reuse the exact same text for both the sr-only h1
and the visible heading (as `OnboardingForm`/`WelcomeFlow` do with
`stepTitle`), `getByRole("heading", { name: /same text/ })` finds TWO
matches and throws — `OnboardingForm`'s own tests never render it inside
`AppShell` so this never surfaced there. Any screen whose test asserts a
heading by name must give the sr-only `AppShell` title DIFFERENT text from
the visible in-body heading, not just "put a heading in the body."

**2. Composer double focus ring — same recipe as `Input.tsx`, but two
focusable children, not one.** `Input` only has one inner focusable element
so its "null the child's ring, draw one ring on the wrapper via
`focus-within` + `--focus-ring`" recipe was a direct copy. `Composer` has
TWO focusable children (textarea + send `Button`), and `Button`'s own
`:focus-visible` ring is inherited from the global rule, drawn on the
`<button>` itself — nulling only the textarea isn't enough, tabbing to the
button still double-rings. Fix: null `box-shadow` inline on BOTH — the
textarea directly, and the `Button` via its `style` prop (works because
`ButtonProps` omits `className` from its `ButtonHTMLAttributes` passthrough
but does NOT omit `style`, so `style={{ boxShadow: "none" }}` spreads
through `{...rest}` onto the real `<button>` and wins on specificity over
the global `:focus-visible` rule). Verified with a real Playwright render,
not just visual inspection: `getComputedStyle` on the focused button
resolved `box-shadow: none` while the wrapper resolved the real two-layer
ring — confirms exactly one ring renders regardless of which child has
focus. **Reusable rule:** any future composite control with more than one
inner focusable element needs this same per-child treatment, not just the
one closest to the visual "input" part.

**3. Example prompt — controlled-vs-uncontrolled solved with a remount, not
a controlled prop.** `Composer` stayed uncontrolled (its own
`useState(initialValue)`) to avoid the classic React
uncontrolled-to-controlled-switch warning that a `value`/`onChange` prop
pair would risk the moment the parent's prefill state changes from `""` to
the example text. Instead: `Composer` gained `initialValue` (read once,
into `useState`'s initializer) + `focusOnMount` (fires once via a callback
`ref`, not `useEffect`, so there's no dependency array to keep honest).
`RoutineHomeScreen` forces a fresh read by bumping a `composerKey` state
value used as React `key` on `<Composer>` — a full remount, not a prop
update on a stable instance. This is the "remount to reset/reseed
uncontrolled state" pattern; reuse it for any future one-shot external
prefill into an otherwise-freely-typed field, same shape as
[[project-logo-component]]'s "animate FROM an offset value INTO the
element's own resting CSS" one-shot pattern, just for React state instead
of CSS.

**4. The `mt-auto`-pinned-composer dead-gap — same bug as
[[project-welcome-view-status]]'s OnboardingForm fix, same fix.** That
memory literally called out routine-generation as "the next likely
candidate" for this pattern and it was right: top-anchored identity block +
`mt-auto`-pushed composer left a large empty band on the (short) empty
state, screenshot-confirmed via a real Playwright run through onboarding
into home. Fix: wrap the variable-length middle content (`RoutineSummary` /
empty-state invite / `null`) in one `flex flex-1 flex-col justify-center`
region between the fixed identity block and the composer dock, and drop the
composer dock's own `mt-auto` — the `flex-1` sibling absorbs the leftover
space and centers the content in it, while the composer dock's bottom
position is unchanged (still flush to the viewport bottom, still
thumb-reachable per design-system.md §2's bottom-anchored-CTA rule — this
fix is purely about how the empty space above it is distributed, not about
un-pinning it). **This is now the established pattern for any screen with a
fixed header region + variable-length middle content + a bottom-pinned
primary action** — check for it whenever building a new screen with that
shape.

**Other polish landed same pass, lower-stakes:**
- Goal badge height was `--space-8` (40px); design-system.md §2's sizing
  table says tags/badges are fixed at 32px (`--space-7`) — fixed a token
  mismatch, not a new decision.
- `RoutineSummary` gained a visible `<h3>{routine.name}</h3>` heading (the
  AI-generated routine name was previously shown nowhere in the UI at all —
  only day names and the subtitle motivational line were visible).
- All verified with real Playwright screenshots (dark + light, 390×844 and
  375×667) through a real onboarding flow into home, not just RTL/jsdom —
  worth doing whenever a task is explicitly about visual/spacing polish
  rather than just behavior, per [[project-logo-component]]'s established
  verification bar for this project. Dev server run on port 3000/3001
  (whichever was free); Playwright script must be copied INTO the repo
  directory before `node script.mjs` (ESM bare-specifier resolution walks
  up from the importing file's own path, not `cwd`) then deleted after.

**Round 2 (same day, 2026-07-09) — 5 more tweaks from the coordinator, same
3 files:**
1. **Thinking-log auto-scroll.** The `role="log"` div (bound to
   `progressMessage`) got a `ref` + `useEffect(() => { el.scrollTop =
   el.scrollHeight }, [progressMessage])`. Needed a `biome-ignore
   lint/correctness/useExhaustiveDependencies` — the effect body never
   reads `progressMessage` directly (only `.current`/`scrollHeight`), so
   Biome's exhaustive-deps rule wants it removed, but it's the intentional
   re-run trigger. **Gotcha: the biome-ignore comment must be a SINGLE
   line directly above the flagged statement** — a multi-line explanation
   (continuation comment lines between the `biome-ignore` line and the
   code) makes Biome report "Suppression comment has no effect" and still
   flag the rule. Keep the reason terse and on one line, put the long
   explanation in a separate comment ABOVE the biome-ignore line instead.
2. **`BuildingIndicator` rotating verb**, `setInterval` every 5s cycling
   `VERBS` (Building/Programming/Forging/Racking/Loading/Calibrating/
   Periodizing/"Dialing in"/"Warming up"/"Repping out"), cleared on
   unmount. `VERBS[0] = "Building"` on purpose — first paint still reads
   "Building your routine…" so the existing test/e2e literal-text
   assertions needed NO changes at all. Worth checking whether a "breaking
   copy change" can be made non-breaking just by choosing which value
   starts first, before reflexively rewriting assertions.
3. **Composer CTA** went `fullWidth size="lg"` (64px primary-CTA height)
   with copy "Build my routine" (was "Build routine") — also dropped the
   now-redundant `aria-label` (visible text alone is the accessible name;
   having both risks a "label in name" mismatch the moment the two drift).
   3 call sites needed the matcher text updated: the component test (2
   assertions) and `e2e/routine-generation.spec.ts` (1) — grep the whole
   repo (`src` + `e2e` + `test`) for the OLD accessible name before
   editing, not just the obvious integration test file.
4. **`RoutineSummary` day rows** gained a leading Anton `text-title-1`
   index number ("01", "02"...) and a trailing hand-rolled stroke chevron
   SVG (`strokeLinecap="butt" strokeLinejoin="miter"`, matching `Logo`'s
   sharp-cornered stroke language rather than a soft rounded-cap arrow) —
   both `aria-hidden`, decorative only, the row's own text still carries
   the accessible name. No shared icon system exists yet; this one-off
   local `ChevronIcon` function is the precedent to reuse/extract if a
   second consumer shows up.

**Big time-sink worth flagging for next time: stale dev/prod server
processes on port 3000.** `pkill -f "next dev"` / `pkill -f "next start"`
do NOT reliably kill the actual `next-server (v15...)` worker process —
it's forked separately and its process name doesn't contain "next dev"/
"next start" at all, so it survives and keeps holding port 3000, silently
serving a STALE build (or a half-built one, `ENOENT
required-server-files.json`, if `next build` got interrupted) to every
later Playwright script that thinks it's hitting fresh code. Symptom looks
like a product bug (buttons/selectors never found, 30s timeouts) but is
purely test-harness staleness. **Fix:** `pgrep -af "next-server\|next
dev\|next start"` and `kill -9` by PID (not `pkill -f` on the launcher
command name) before trusting any manual verification server, and
`ss -ltnp | grep 3000` to confirm the port is actually free before
starting a new one. For e2e-shaped verification, prefer `bunx playwright
test e2e/<spec>.ts` (its own `webServer` config builds+starts+tears down
cleanly) over a hand-rolled `bun run dev`/`start` + custom script, and
only fall back to the manual script for things the existing e2e spec
doesn't assert on (e.g. this round's thinking-log scroll position, which
needed a custom single-event-no-content SSE mock — see the script's own
comment for why: sending only a `reasoning` delta with no `content`/
`[DONE]` deliberately drives the generation to the `error` state instead
of `ready`, so the auto-adopt effect never fires and never resets
`progressMessage` mid-inspection — a real routine racing straight into
auto-save makes the log disappear before Playwright can even poll for
it).

**Addendum (2026-07-12, edit-routine verification):** confirmed again — a
fresh `bun run dev` on a machine with stale `next-server` processes already
holding 3000/3001 does NOT error, it silently falls back to the next free
port (3002, etc.) and prints `⚠ Port 3000 is in use by an unknown process,
using available port XXXX instead.` in its own stdout log. Don't assume/curl
port 3000 — read the dev server's own log output for the port it actually
bound. Also: `chromium-cli` is NOT installed in this environment — the `run`
skill's primary path doesn't apply here; fall back to its own suggested
adaptation (`import { chromium } from "@playwright/test"` — the bare
`"playwright"` package specifier 404s, `@playwright/test` is the one
present — `chromium.launch({ args: ["--no-sandbox"] })`, script copied into
the repo root per the ESM-resolves-from-cwd note above).

**Addendum 2 (2026-07-12, edit-routine background-block feature) — caught a
real accessible-name regression only because of live re-verification, not
static review.** When I swapped a hand-rolled `<button>Edit routine</button>`
to the shared `Button` primitive (`<Button>...Edit routine</Button>`) earlier
in the same session, the button's visible/accessible text silently became
just `"Edit"` on disk — `git diff` confirmed it, Biome/tsc were both silent
(neither typechecks JSX text content), and it wasn't caught until a later
live Playwright run failed to find `getByRole("button", {name: "Edit
routine"})`. **Lesson: after any edit that touches literal button/label copy
that an e2e/AC depends on, re-run a live check (or at minimum `grep` the
exact string back out of the file) — don't trust "the Edit tool said
success" as proof the text landed correctly, especially right after a
same-session refactor of the surrounding JSX.** Also confirms the value of
this project's established "verify via a real Playwright render" bar
([[project-logo-component]]) over trusting code review alone.

**Addendum 3 — native `inert` for "block background while a floating
non-modal overlay is busy."** Added an `inert?: boolean` prop to `AppShell`
(applied to the shell's root div) so a screen can block pointer/keyboard/AT
reach into everything BEHIND a floating overlay (edit-routine's
`RoutineEditor`, mid-submit) without the heavier modal+scrim treatment. Key
constraint: **the overlay itself must be a true DOM sibling of `AppShell`,
never a child** — `inert` applies to the whole subtree, so if the overlay
were nested inside the inert-able container it would disable itself too;
`RoutineHomeScreen` now returns `<><AppShell inert={editBusy}>...</AppShell>
<RoutineEditor .../></>`, a Fragment with the editor lifted OUT. Verified
live (not just code review) with real Playwright pointer clicks (a
non-forced `.click()` on the theme toggle / a day link, short timeout, mid a
long artificial delay) — confirmed genuinely blocked while `status ===
"editing"` and restored on BOTH success and error. **Gotcha for future
verification of `inert`:** don't test "is it blocked" with a *long*
Playwright click timeout — `.click()` polls/retries until actionable, so if
the async operation resolves before the timeout elapses, the click
"succeeds" (misleadingly) once `inert` lifts naturally, telling you nothing
about whether it was blocked while inert. Use a short click timeout well
inside a deliberately-long mock delay, or check `document.querySelector(
"[inert]")` between the two. Also: `getComputedStyle(el).pointerEvents`
stays `"auto"` even when genuinely inert (the browser's block is internal
hit-testing, not a visible CSS value) — don't use computed style to verify
it; use an actual (non-forced) click attempt or a real accessibility-tree
query instead. Playwright's `getByRole` reliably excludes an inert `<button>`
from its role query (count 0) but was inconsistent on an inert `<a>` in one
run (still counted 1) even though a real click on that same link WAS
blocked — trust the real-click test over the role-count test when the two
disagree.
