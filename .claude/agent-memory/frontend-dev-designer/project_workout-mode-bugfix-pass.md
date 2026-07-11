---
name: project-workout-mode-bugfix-pass
description: workout-mode (Feature D) post-apply bugfix + redesign pass @2026-07-11 — timer anchoring fix, Input gained disabled, per-set data flagged then built once D1 reopened, then relayout to a horizontal Set-N cell strip
metadata:
  type: project
---

A follow-up bugfix task (not a fresh `/opsx:apply`) asked for four things in
`modules/workout-mode`; only the first two were legitimately UI:

**1. Timer reflow when "Next exercise" appears — fixed with a reserved slot,
not a restructure.** `ExerciseView`'s stopwatch sits in a `flex-1
justify-center` block; the "Next exercise" `Button` was a sibling rendered
only in `exercise-complete`, so its mount/unmount changed how much height
that flex-1 block got, and the (vertically centered) circle visibly jumped.
Fix: wrap the button in an **always-rendered** `min-h-[var(--control-height-lg)]`
slot (`data-testid="next-exercise-slot"`) so the box is the same size whether
or not the button is inside it — the exact same fixed-slot trick `Stopwatch`
already used for its phase message text. **General pattern worth reusing
anywhere a conditionally-shown control sits below/above a
vertically-centered focal element**: reserve the slot's height
unconditionally rather than conditionally rendering the whole box.

**2. `Input` primitive gained a `disabled?: boolean` prop** (previously had
none) — `pointer-events-none opacity-40` on the wrapper (matching `Button`'s
existing disabled treatment exactly, same token/opacity) + native `disabled`
on the `<input>`. Wired into workout-mode's weight field: locked whenever
`timer.phase !== "ready"` (work/rest/overtime/exercise-complete), editable
only when a set is armed-but-idle, matching design.md §D12's "weight carries
over within an exercise, editable" framing — `ready` is the one phase that
counts as "not running." Zero default-behavior change for the other two
`Input` consumers (`SessionOverview`, `OnboardingForm`) since `disabled`
defaults to `false`.

**3&4 — flagged, NOT implemented: "record per-set time+weight" and "total
weight = weight×reps volume per set."** design.md's D1 is an explicit,
PO-driven **locked decision** that reverses the old per-set model: workout
mode stores a **per-exercise aggregate** (`ExerciseLog`: one `weightKg`, one
`workSeconds`/`restSeconds` total, no per-series breakdown) specifically
because per-series logging was cut as a non-goal. The bugfix ask's items 3/4
read as wanting the per-series log back (weight *and* time captured at the
moment "the user starts the next set," plus a per-set volume figure) — that
directly contradicts D1, not a UI gap. Per the UI/logic boundary, this is a
data-model + persistence decision, not something to silently reshape from
`ui/`. Flagged back rather than built; two concrete asks if the product
actually wants this reversed:
  - If the ask is really just an **aggregate** volume (not per-set): add a
    derived `volumeKg` field to `ExerciseLog` (`= weightKg * reps * series`,
    computed in `logic/model.ts`'s `tap` reducer alongside the existing log
    append) — additive, doesn't reopen D1.
  - If the ask is genuinely **per-set** granularity (time + weight captured
    at each "start next set" tap): this reopens D1 and needs a
    software-architect decision, not a quiet reshape — `ExerciseLog` would
    need a per-series array again, which is exactly what D1 removed and
    exactly the trade-off design.md documents as deliberate ("we can no
    longer reconstruct individual sets... this is the trade the PO chose").

See [[project-workout-mode-ui]] for the original build's Stopwatch/Input/
ChoiceGroup decisions this pass built on top of.

**Follow-up same day: D1 got reopened by the architect/PO (2026-07-11),
per-series logging shipped in `logic/`, task §9.7 asked for the UI.** Built
`SetsProgress` in `ExerciseView.tsx` — a "Set N of M" counter (from
`timer.currentSeries`/`plannedSeries`) + a per-set list from the seam's new
`completedSets: SeriesView[]` (reps/weight/workSeconds/volume, all already
display-unit-converted — UI does zero math). **Reused the exact
reserved-slot anti-reflow pattern from earlier the same day**, but this time
for a list that *grows* (one row per completed set) rather than a
button that toggles on/off: a fixed-height (`h-[calc(var(--space-9)*4)]`,
192px), `overflow-y-auto` scrollable box, same box/class regardless of 0 vs N
rows, so it never pushes the centered `Stopwatch` as sets complete.

**Self-critique (design-critique skill) caught a real bug before it shipped:
the first height I picked (144px, `space-9*3`) was too short to show even 2
full rows without clipping** — did the actual row-height arithmetic (two
stacked text lines + padding ≈ 71.6px/row + 8px gap ⇒ 2 rows ≈ 151px) and the
144px box was already 7px short, so the *second* set — the single most
common case mid-exercise — would render partially cut off with no visual
hint it was scrollable. Fixed to 192px, sized to show 2 full rows plus a
deliberate ~40px peek of a 3rd (a partial row as an intentional scroll
affordance, not an accidental clip). **Takeaway: when picking a fixed/
reserved-height value for a growing list, do the actual row-height
arithmetic — don't eyeball a token multiple.** Also confirmed: two-line
stacked row content (not one packed line) is deliberately the safer call for
this app's 360px narrow-width floor — a single-line "Set · reps × weight ·
time · volume" string doesn't fit without wrapping at that width, stacked
text does.

**Same-day redesign #2: coordinator asked for a full relayout — vertical
list → single full-width horizontal strip, one cell per PLANNED set
(`timer.plannedSeries`, not just completed ones), placeholder-until-done,
`bg-accent`+`text-on-accent` once filled, `overflow-x-auto` + fixed 25%-basis
cells above 4 planned sets, auto-scroll to the newest completed cell.** Kept
cells in strict ascending left-to-right plan order even when scrollable
(rejected reversing newest-to-first — the coordinator's own message flagged
that risks confusing the "Set N of M" mapping); only the SCROLL POSITION
chases progress, via `scrollIntoView` on the ref of the newest completed
`<li>`.

**Three reusable gotchas hit building this:**
1. **Combining a custom unlayered `text-*` scale class with a Tailwind
   weight utility (`text-caption font-semibold`) is unreliable** — this
   codebase's `.text-caption`/`.text-body-strong`/etc (`tokens/globals.css`)
   are defined OUTSIDE any `@layer`, and Tailwind v4's own utilities live
   inside `@layer utilities`; per the CSS cascade-layers spec, *unlayered
   rules always beat layered ones regardless of source order* — so
   `font-semibold` can silently lose to `.text-caption`'s own weight. Fix:
   pick the scale step whose OWN weight is already right, don't try to
   override one with a bare Tailwind utility. Any future "match X except
   bolder" instinct on top of a `text-*` class should reach for a different
   scale step first, not a weight utility.
2. **`Element.prototype.scrollIntoView` is `undefined` in jsdom** (this
   repo's Vitest environment) — not a no-op stub, genuinely missing — so any
   auto-scroll effect needs `el?.scrollIntoView?.(...)`, optional-chained on
   the METHOD too, not just the element, or component tests throw.
   `RoutineHomeScreen`'s earlier auto-scroll (the log panel) sidesteps this
   entirely by assigning `el.scrollTop = el.scrollHeight` instead — prefer
   that plain-property approach over `scrollIntoView` when the scroll target
   is simple (e.g. "always scroll to the end"); reach for `scrollIntoView`
   only when the target is an arbitrary/moving element (like a specific
   cell here), and guard it.
3. **`prefers-reduced-motion` for a JS-triggered scroll**: call
   `scrollIntoView({..., behavior: "auto"})` (not `"smooth"`) and let a
   dedicated CSS class own `scroll-behavior: smooth`, overridden to `auto`
   inside the existing `@media (prefers-reduced-motion: reduce)` block
   (`tokens/globals.css`, new `.anim-scroll-smooth` class) — passing
   `behavior: "smooth"` directly to the DOM call would bypass that CSS
   media-query override entirely.

Also confirmed (didn't need to invent): Tailwind arbitrary values must be
static literals visible to its build-time scanner — a dynamically
`${computed}`-interpolated class string silently never gets generated. Where
per-count math was genuinely needed (equal-division vs. fixed-25%-scrollable)
both branches are static string literals picked via a ternary
(`isScrollable ? "min-w-[4.5rem] flex-[0_0_25%]" : "min-w-0 flex-1"`), never
a runtime-computed percentage string.

**Same-day round 3: coordinator reported the strip caused a page scroll on
the whole workout screen, asked me to shrink it and MEASURE, not guess.**
Bootstrapped a throwaway `playwright`/`chromium` script (seeded IndexedDB the
same way `e2e/workout-mode.spec.ts` does, ran against the already-live `next
dev` on :3000) to read `document.documentElement.scrollHeight` vs
`window.innerHeight` at 375×667 — real numbers, not CSS arithmetic. Found
284px of overflow. Shrunk the row `108px → 48px` (`space-9`, single token,
2-line micro-text cells), tightened the `ExerciseView` column's uniform
section gap `gap-7 → gap-6` (still inside design-system.md's own documented
"24–32px between sections" range, not a violation), and cut a 2-line weight
hint to one line. Result: **156px residual overflow, not zero** — and
proved this mathematically/empirically important limit **before** claiming
success: removing the WHOLE `SetsProgress` component (measured by literally
`.remove()`-ing it from the live DOM and re-reading `scrollHeight`) still
leaves ~60–68px of overflow on this exact viewport, from the `Stopwatch`
block (~266px, unresized — it's the "heartbeat," design-system Principle 3)
+ `AppShell`'s header (~96px) — both outside this component and outside
this task's stated scope. **Lesson: when a coordinator asks to "verify, not
guess" a layout budget, measure the FLOOR too** (what if the thing you're
asked to shrink were removed entirely?) **— it's the only way to know
whether the ask is even achievable by touching just that one piece**, and
reporting "I shrank X but here's the proven remaining gap and exactly where
it lives" is more useful than either quietly declaring victory or
overreaching into a protected/shared component (Stopwatch, AppShell) without
being asked. Confirmed the fix DOES fit with zero scroll on a taller
viewport (390×844); the residual only shows on the very smallest phones
(SE/8-class, 667px tall) with a 2+-series exercise.
