---
name: project-logo-component
description: shared/ui/components/Logo.tsx — "WP" straight-stroke monogram in accent yellow, in both header and hero; design-system.md §2 now has a named brand-mark exception to the one-accent-fill rule
metadata:
  type: project
---

Built 2026-07-09, revised twice the same day after direct user feedback
(relayed by the coordinator each time). `src/shared/ui/components/Logo.tsx`
was a `<>Logo</>` stub; now a real inline-SVG mark.

**Revision history (three rounds, so the "why" of the current shape isn't
lost — a future request to change this again should read this before
re-litigating settled ground):**
1. **Round 1** — flat horizontal neutral (`currentColor`) barbell in both
   `AppShell`'s header (small) and `WelcomeFlow`'s hero (large, icon-only).
   Accent appeared only as a transient glint (swept the bar on mount,
   faded to `opacity: 0`) — scoped that way because the mark was in the
   header on every screen, including ones with a primary CTA already
   claiming the one full-saturation-accent-fill budget (design-system.md
   §2, pre-addendum).
2. **Round 2** (user: too plain, wanted energy + accent baked into the
   mark) — tilted ~16°, accent-filled plates + trailing "speed line" rects,
   **removed from the header entirely** (reverted to plain `<h1>{title}</h1>`)
   so the persistent accent fill wouldn't collide with header-adjacent
   primary CTAs. Wordmark added to the hero.
3. **Round 3, current (user: scrap the dumbbell entirely)** — barbell
   imagery dropped completely. Mark is now a **"WP" monogram built from
   straight strokes only** (`stroke-linejoin="miter"`, `stroke-linecap=
   "butt"` — the stroke-based equivalent of zero border-radius), full
   `stroke-accent` yellow, **restored to the header** (the user explicitly
   wanted the brand mark back in header chrome). Hero dropped its
   wordmark text (`withWordmark` now unused at the only call site) since
   the header now visually carries the brand — hero is icon-only, kept
   large as the "poster" moment, headline/support copy unchanged.

**Current geometry:** viewBox `0 0 104 64`. W = one 5-point zig-zag path
(`M4,6 L16,58 L30,20 L44,58 L56,6`). P = stem + squared-off (not curved)
bowl as one path (`M70,58 L70,6 L98,6 L98,32 L70,32`). Both stroked at
`strokeWidth="9"`, `fill="none"`, inheriting `stroke-accent` from the
parent `<g>`.

**Motion (round 3):** a "draw-on" — each glyph has `pathLength="100"` (so
the dash math is unit-independent, no hand-measured path length needed)
and `stroke-dasharray: 100`. Resting CSS is fully drawn
(`.wp-logo-glyph { stroke-dashoffset: 0; }`); `.anim-logo-draw` animates
from `stroke-dashoffset: 100` (fully retracted) to that same resting `0`
once on mount, P starting `var(--dur-fast)` after W. Reduced motion just
sets `animation: none` on `.anim-logo-draw .wp-logo-glyph` — the base rule
already shows the correct fully-drawn static state, no fallback to keep in
sync. This "animate FROM an offset value INTO the element's own plain
resting CSS" pattern is now used twice (round 2's tilt, round 3's dash
offset) — reuse it for any future one-shot Logo motion instead of a
`fill-mode: forwards` animation.

**design-system.md §2 now has a standing addendum (added 2026-07-09,
authored by me since I own that doc):** the brand mark is a named,
narrow exception to "one full-saturation accent fill per screen" —
identity chrome isn't competing for the tap-attention the rule protects,
so `Logo` may carry accent even on a screen that also has a primary CTA
in accent (true again as of round 3, now that the mark is back in every
header). The exception does **not** extend to any other selected/highlight
UI — see [[project-accent-fill-discipline]], which still governs
everything else.

**API (unchanged shape across all 3 rounds):** `size?: "sm" | "md" | "lg"`
(24/32/80px mark height), `withWordmark?: boolean` (stacks the Anton
`display-brand` wordmark below the mark; currently unused — no call site
needs it after round 3, but kept since it's cheap to keep and may be
useful for a future splash/share-card context), `className?: string`.
Call sites: `AppShell` header (`size="sm"`), `WelcomeFlow`'s `IntroPanel`
hero (`size="lg"`).

**How to apply:** reuse `Logo` for any future brand-mark placement; extend
`MARK_HEIGHT_REM`/viewBox rather than hand-rolling a new SVG. All three
rounds were verified via a real dev-server screenshot (direct Playwright
script — no project "run" skill exists yet for this app, worth generating
via `/run-skill-generator` if this recurs) at 360/390px dark and 390px
light, across both the welcome hero and a second screen (onboarding form)
to check the header specifically; no clipping/overflow, no console errors,
44 tests + `tsc`/`biome`/`depcruise` green throughout.

**Round 4 (same day, 2026-07-09): header text removed, title made
`sr-only`.** User wanted the header to show ONLY `Logo` (left) +
`ThemeToggle` (right) — no visible `{title}` text at all.
`AppShell.tsx`'s `<h1>{title}</h1>` is now `className="sr-only"` (Tailwind
core utility — clips to a 1×1px absolutely-positioned box, confirmed via
`getBoundingClientRect`, NOT via Playwright's `isVisible()`, which reports
`true` for `sr-only` elements since they still have a non-zero box — don't
trust that check for this pattern). The `<h1>` stays in the DOM/AT tree as
the page's one accessible name; `Logo` remains `aria-hidden` so it still
can't carry that role.

**Fallout this forced:** `OnboardingForm.tsx` previously had NO visible
heading of its own — the step title ("About you" etc., `onboarding.
stepTitle`) only ever appeared via the header's (now-hidden) `<h1>`. Fixed
by adding a real visible `<h2 className="text-title-1">{stepTitle}</h2>`
directly above `Stepper` in the form body (destructure `stepTitle` from
the `onboarding` prop, not previously pulled in). Kept `Stepper` itself
plain ("Step N of M", no `label` prop) rather than passing `stepTitle`
into `Stepper`'s existing `label` slot too — that would have shown the
title twice back-to-back (once as the new h2, once as the stepper's small
"· About you" suffix). **Any future screen using `AppShell` whose `title`
carries meaningful on-page information (not just decorative branding)
needs this same pattern: don't rely on `AppShell`'s `<h1>` for a visible
heading anymore — render your own visible heading in the body.**
