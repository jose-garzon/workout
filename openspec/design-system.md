# workout-pal design system — DRAFT v0.3

**Status: draft.** Visual identity (accent, theme default, typography, shape,
sizing) is now **RESOLVED** per user direction — see §4 for exactly what
changed and why. **Density (§4.3) is still open.** Nothing here is
implemented — no framework or components exist yet. Values are expressed as
raw hex / rem / ms with semantic names so the software-architect can wire
them into whatever theming mechanism the chosen stack uses (CSS custom
properties, a JS theme object, Tailwind config, etc.) once the stack is
decided.

Owner: frontend-dev-designer. Source of truth for stack/product decisions:
`openspec/config.yaml` → `context:`.

**What changed in v0.2:** the calm/Linear-style proposal in v0.1 was replaced
with an energetic gym-brand identity — dark theme first (with light kept
first-class and a manual toggle), an electric-yellow accent, and an
Anton/Barlow display+body typography pairing.

**What changed in v0.3 (shape + sizing only — color, type, motion, a11y,
and the four states are all unchanged from v0.2):** the moderate/tight
radius call from v0.1 is **reversed** — the UI is now sharp rectangles
everywhere, no border radius, with the sole exception of things that are
genuinely circular (the rest-timer ring). Paired with that, every tappable
element gets bigger and the spacing around it gets more generous, formalized
as a new component-sizing subsection (§2) and token set (§3.4). Together
with the v0.2 electric-yellow + Anton-caps identity, the whole system now
reads as one consistent "bold graphic / athletic poster" language — sharp
blocks, big type, one loud color — while motion stays calm and color use
stays restrained (one accent per screen, unchanged).

---

## 0. The one thing to hold onto

workout-pal is used by a tired person, mid-workout, one thumb on the phone,
glancing at it for two seconds between sets — and, separately, by that same
person calmly planning at a desk. Every decision below optimizes for the first
case without insulting the second. When in doubt: fewer things on screen,
bigger numbers, calmer motion.

---

## 1. Design principles

1. **One primary action per screen, always in thumb reach.** If a screen has
   two things fighting to be "the" button, that's a design bug, not a layout
   problem to solve with more buttons. As of v0.3 that one action is also
   physically big — a large, sharp-edged, obviously-tappable block, not a
   modest rounded button competing for attention with subtlety.
2. **Numbers are the interface.** Weight, reps, and rest-seconds *are* the
   content of workout mode — not labels around content. They get the largest,
   highest-contrast treatment on screen, legible at arm's length on a bright
   or dim gym floor.
3. **The rest timer is the heartbeat.** It is always visible during workout
   mode, never obscured by a modal, and never smoothed or estimated —
   the number shown is always the real number, updated the instant it changes.
4. **Motion confirms, it doesn't decorate.** An animation exists to answer
   "did that work?" (set logged, rest started, routine saved). If removing an
   animation loses no information, remove it.
5. **Design for rep 8 of 8, not the demo screenshot.** Defaults, copy, and
   tap targets assume a fatigued, slightly imprecise thumb — not the crisp
   first tap of a product tour.
6. **Progress reads at a glance, not like homework.** The calendar and
   consistency views are a glance-and-done confirmation ("3 of 4 this week"),
   never a report the user has to study.
7. **Trust through restraint, because there's no cloud to reassure anyone.**
   All data lives on-device with no account/login theater to lean on for
   credibility — the UI itself has to feel sturdy and considered. No trend-
   chasing visual gimmicks that would undercut that. (This still holds with
   an energetic, blocky identity: loud color and sharp, oversized shapes are
   deliberate choices, not a license for clutter — one accent per screen and
   one primary action per screen, both still strict, see §2.)
8. **Silence is a valid state.** Nothing pulses, shimmers, or loops just to
   look alive. A screen that isn't waiting for anything or reporting anything
   should be still.

---

## 2. Guidelines

### Layout & spacing rhythm
- Base unit is still **4px** (unchanged scale, §3.3) — but as of v0.3 the
  system leans on its **larger** steps by default. Big, sharp blocks need
  real air around them or they read as cramped rather than bold.
- Group with proximity: **12–16px** inside a control cluster (was 8–12px),
  **24–32px** between distinct sections, **40–48px** between major screen
  regions.
- Single column, mobile-first. Content max-width **560px**, centered, even on
  tablet/desktop — workout mode never stretches into a wide dashboard.
- Screen padding: **20px** on phone, **32px** from the `sm` breakpoint up
  (was 16/24px) — bigger, squarer controls sit better with more edge margin.
- Primary CTA is bottom-anchored on mobile, full-width, inside the thumb
  zone, with safe-area inset padding on notched devices — see "Component
  sizing" below for its exact height.

### Component sizing (new in v0.3)
Sharp rectangles read as confident and bold only if they're also big enough
to be obviously, easily tappable — shape and size are one decision, not two.
Concrete sizing tokens (all built on the existing 4px scale, §3.3):

| Token | Value | Use |
|---|---|---|
| `tap-target-min` | 44px | the absolute WCAG floor — nothing in the app, however secondary, goes below this |
| `control-height-sm` | **48px** | secondary/inline controls: a list-row action, a stepper +/− button — still comfortably above the 44px floor |
| `control-height-md` | **56px** | the default height for buttons, inputs, and selects — the baseline "everything is easy to hit" size |
| `control-height-lg` | **64px** | the ONE primary CTA per screen, and any control used mid-set under fatigue: "Log set," rest-timer skip/restart |
| `control-padding-inline-md` | `space-6` (24px) | horizontal padding inside default buttons, inputs, tags |
| `control-padding-inline-lg` | `space-7` (32px) | horizontal padding inside the primary CTA |
| `control-gap-min` | `space-4` (16px) | minimum gap between two adjacent standalone tap targets — never let two controls sit closer than this, even in a dense row |

Applied:
- **Buttons** — rectangular (§3.4), `control-height-md` (56px) by default;
  the screen's one primary CTA is `control-height-lg` (64px), full-width on
  mobile. Both use `control-padding-inline-md`/`-lg` horizontally — never a
  button sized to its label with no breathing room.
- **Inputs** — same footprint as a default button (56px tall, rectangular,
  `control-padding-inline-md`). The weight/reps entry field specifically —
  the single most-used input in the app, hit mid-set, often imprecisely — is
  `control-height-lg` (64px), set in `body-strong` or larger so the value is
  legible before the user's thumb even leaves it.
- **Tags/badges** — now rectangular, not pills (§3.4): fixed height 32px,
  `space-3`–`space-4` (12–16px) inline padding, no radius.
- **Icon-only buttons** — minimum `tap-target-min` (44px) always; anywhere
  the icon button is a primary or mid-workout control (skip rest, restart
  rest) it uses `control-height-md` or `-lg` instead of the bare floor.

### Typography usage
- Use the scale sparingly: one `title-1` per screen. Everything else is
  `body`, `title-2/3`, or a numeric display. Reach for **weight**, not size,
  for in-paragraph hierarchy.
- Any standalone big number (rest countdown, current set's weight) is the
  single largest thing on its screen — never sized to compete with a title.
- Proportional figures for standalone *static* numbers; `tabular-nums` for
  anything that updates live (the timer, an in-session weight/reps field) or
  sits in a column that must align (set-log history rows). See §3.2 for why
  this now also decides which typeface a number gets.

### Color usage
- Neutral carries ~95% of every screen. The accent is now **loud on
  purpose** (electric yellow, §3.1) — which makes the "one accent per screen"
  rule *stricter*, not looser: exactly **one** element per view may use the
  full-saturation `accent` fill (the one primary action, or the one
  active/selected indicator). Everything else that wants a "selected" or
  "highlighted" treatment uses `accent-wash` (a low-alpha tint) or an outline
  in `accent-text` — never a second block of full yellow on the same screen.
  Bigger, sharper shapes (v0.3) make this rule *more* important, not less —
  a full-bleed rectangular yellow button is a bigger visual event than a
  small rounded one was, so a screen with two of them competes for attention
  even more obviously than before.
- **Addendum, added 2026-07-09 (brand-mark exception):** the app's own
  `Logo` mark is exempt from the one-accent-fill rule above. It's identity
  chrome — never tappable, never a "selected/active" state — so it isn't
  competing for the same attention budget the rule protects (a primary
  CTA or a selected control both invite a tap; the logo never does). It
  may therefore carry the full-saturation accent even on a screen that
  also has a primary CTA in accent (e.g. the welcome screen's header mark
  + hero mark + Start button). This is a narrow, named exception for the
  brand mark specifically — it does not license a second interactive or
  "selected" surface in accent; that half of the rule is unchanged.
- Status colors (success/warning/danger) are reserved for their meaning only
  and always ship with an icon + label, never color alone — same rule as the
  `dataviz` skill's status palette. `warning` and `accent` are both
  yellow-family but are kept perceptually and grammatically distinct — see
  the collision note in §3.1.
- Both themes are first-class. **Dark is the default/preferred theme** and
  the one new screens should be designed in first; light must look equally
  intentional, not like an inverted afterthought. See "Theming" below and
  §4.1 for the resolution algorithm and the manual toggle.

### Theming (new in v0.2)
- **Initial theme, on first load:** read `prefers-color-scheme`. If it
  explicitly reports `light`, start light. If it reports `dark`, reports no
  preference, or isn't available, start **dark**. Dark is the tie-breaking
  fallback — but a user who has explicitly told their OS they prefer light
  is never overridden on first visit.
- **Manual override:** a persistent in-app light/dark toggle lets the user
  pin either theme regardless of OS setting; the choice is remembered across
  sessions.
- **Boundary note:** the toggle is UI-only. Resolving the initial theme and
  persisting the override is the software-engineer's concern (their
  local-storage layer) — the UI needs a small hook/store, e.g.
  `{ theme: 'light' | 'dark', setTheme(theme) }`, that already encapsulates
  that logic. This is a request for `design.md`'s logic↔UI interface, not
  something the frontend implements itself.

### Motion
- Durations and curves are tokens (§3.6) — never a one-off `transition: all`.
- Examples of *where to animate*: a sheet/modal entering (`rise`), a set
  being marked logged (`success-pulse`, once, on the row only), a screen
  push when drilling into an exercise (`slide`), a toast appearing (`fade`).
- Examples of **where NOT to animate**: the rest-timer digits themselves
  (instant, exact — never fade/slide between values), any numeric input
  field while the user is typing, first paint of a list on initial load (no
  staggered fade-ins — content should just be there), anything ambient or
  looping (no pulsing dots, no infinite shimmer beyond a bounded skeleton).
- Respect `prefers-reduced-motion: reduce`: drop all transform-based motion
  (slide/scale/rise) to an instant state-change or, where an affordance is
  needed, a plain opacity fade capped at one step. The rest-timer ring's
  progress fill may still update (it's data, not decoration) but any
  overshoot/spring on the success-pulse must be removed.

### The four states
- **Loading** — skeletons that mirror the final layout's shape for anything
  visible >300ms; no spinners for local reads (IndexedDB is fast, so most
  "loading" is actually optimistic UI). The one honest exception is AI
  routine generation, which can take real seconds — show a specific,
  progressing message there, not an anonymous spinner.
- **Empty** — never a blank screen. One sentence explaining what's missing +
  one clear primary action (e.g., "No routine yet" → **Generate a routine**).
  No stock illustration; if any graphic is used it's simple line art in
  neutral/accent ink, not decorative.
- **Error** — specific and human, always paired with a next step (retry /
  edit / go back). AI-generation failures explain what to do next, never
  surface a raw technical message.
- **Success** — quiet and brief: an inline check or a toast that
  auto-dismisses. Never a modal that interrupts the set-logging flow.

### Accessibility (WCAG AA, non-negotiable)
- All body text pairs hit **≥4.5:1**; verified pairs are in §3.1.
- All interactive elements have a **≥44×44px** tap target, including
  icon-only buttons — pad the hit area beyond the visual glyph if needed.
- Every focusable element has a visible focus ring, and it's a **two-layer**
  ring, not a bare `accent` line — a plain yellow ring on a light surface
  measures **1.06:1** against `background`, nowhere near the 3:1 a focus
  indicator needs (SC 1.4.11). The compliant, theme-aware recipe:
  - Light: `box-shadow: 0 0 0 2px var(--on-accent), 0 0 0 4px var(--accent);`
    — the inner `on-accent` (`#0B0B0B`) ring does the contrast work
    (18.67:1 against `background`), the outer `accent` ring adds the brand
    color as a visible flourish once the indicator is already legible.
  - Dark: `box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--accent);`
    — `accent` alone already clears 17.40:1 against dark `background`, so no
    second color is needed; the inner ring is just an offset gap.
  Never suppressed with `outline: none` alone.
- Full keyboard operability everywhere, including the touch-primary flows —
  registration and routine planning are desk activities as often as not.
- Status/meaning is never color-only — pair with icon + text label.
- Rest-timer countdown is **not** announced to screen readers every second
  (that would spam `aria-live`) — only announce state transitions ("Rest
  started", "10 seconds left", "Rest complete").
- Text is `rem`-based and respects OS-level font scaling; nothing is
  pixel-locked.

### Density
- **Comfortable**, not compact, is the default (still open — see §4.3) — a
  tired user values legibility and tap-target size over information density.

### Iconography
- One icon set, stroke-based (not filled, not mixed), consistent ~1.75px
  stroke weight and corner radius — e.g. a Feather/Lucide-style set.
- No emoji as interface chrome (an AI-generated routine *name* may contain
  personality/emoji as content — the UI shell around it never does).
- Icons in primary navigation are always paired with a text label — no
  icon-only nav, ever. Sizes sit on the spacing grid: 16 / 20 / 24px.

---

## 3. Design tokens

All raw values below. Semantic names are what components should reference.

### 3.1 Color

The neutral scale, status colors, and ink roles remain **shared verbatim with
the `dataviz` skill's reference palette** (unchanged from v0.1). The accent
is new: **Electric Yellow `#E8FF3D`**, resolved in §4.1.

**Light theme**

| Semantic role | Hex | Notes |
|---|---|---|
| `background` | `#F9F9F7` | page plane |
| `surface` | `#FCFCFB` | cards, list rows |
| `elevated-surface` | `#FFFFFF` | modals, sheets, popovers |
| `text` | `#0B0B0B` | primary ink |
| `text-muted` | `#52514E` | secondary ink |
| `border` | `rgba(11,11,11,0.10)` | hairline |
| `accent` | `#E8FF3D` | primary action fills, active/selected state — used ONCE per screen |
| `accent-text` | `#667200` | accent used as bare text/icon/link — the raw hue fails on near-white (1.06:1), so this is a darkened same-hue variant |
| `accent-wash` | `rgba(232,255,61,0.14)` over `background`/`surface` | low-alpha tint for secondary "selected" states, never the primary CTA |
| `on-accent` | `#0B0B0B` | text/icon drawn on top of `accent` — **near-black, not white** (white fails at 1.12:1) |
| `success` | `#0CA30C` | icon/graphical use (≥3:1 rule); pair with label |
| `success-text` | `#0A6B0A` | success used as text |
| `warning` | `#FAB219` | icon/graphical use only — see contrast note below |
| `warning-text` | `#8A5A00` | warning used as text |
| `danger` | `#D03B3B` | icon/graphical use, and passes as text (see below) |
| `danger-text` | `#D03B3B` | danger used as text |

**Dark theme (default)**

| Semantic role | Hex | Notes |
|---|---|---|
| `background` | `#0D0D0D` | page plane |
| `surface` | `#1A1A19` | cards, list rows |
| `elevated-surface` | `#242422` | modals, sheets, popovers |
| `text` | `#FFFFFF` | primary ink |
| `text-muted` | `#C3C2B7` | secondary ink |
| `border` | `rgba(255,255,255,0.10)` | hairline |
| `accent` | `#E8FF3D` | same hex as light — see rationale below |
| `accent-text` | `#E8FF3D` | same hex works directly as text on dark (13.9–17.4:1) — no darkened variant needed here |
| `accent-wash` | `rgba(232,255,61,0.10)` over `background`/`surface` | slightly lower alpha than light (composited result stays legible — see contrast note) |
| `on-accent` | `#0B0B0B` | same as light — near-black text on the yellow fill, regardless of theme |
| `success` | `#0CA30C` | works as both icon and text on dark |
| `success-text` | `#0CA30C` | same value — no separate variant needed |
| `warning` | `#FAB219` | works as both icon and text on dark |
| `warning-text` | `#FAB219` | same value — no separate variant needed |
| `danger` | `#D03B3B` | icon/graphical use only on dark — see below |
| `danger-text` | `#E5605F` | lighter variant needed for text on dark |

**Why `accent` is the same hex in both themes (unlike v0.1's indigo):**
Electric Yellow is bright enough (L 62%, S 100%) that pairing it with
near-black `on-accent` text clears AA regardless of what theme the button
sits in — the fill+label pair is self-contained. v0.1's indigo needed a
theme-specific fill because it relied on *white* text, which only clears AA
within a narrow brightness range. One less thing to keep in sync now.

**Confirmed contrast pairs (WCAG AA, body text = 4.5:1, graphical/icon = 3:1)**

| Pair | Ratio | Verdict |
|---|---|---|
| `text` on `background` (light) | 18.67:1 | pass |
| `text` on `surface` (light) | 19.17:1 | pass |
| `text-muted` on `background` (light) | 7.53:1 | pass |
| `text` on `background` (dark) | 19.44:1 | pass |
| `text-muted` on `background` (dark) | 10.85:1 | pass |
| `text` on `elevated-surface` (dark) | 15.55:1 | pass |
| `on-accent` (`#0B0B0B`) on `accent` (`#E8FF3D`) | 17.62:1 | pass, huge margin |
| **white on `accent`** (`#E8FF3D`) | **1.12:1** | **fails hard** — this is *why* `on-accent` is near-black, not white, unlike every other filled-button pattern people default to |
| `accent-text` (`#667200`) on `background` (light) | 5.02:1 | pass |
| `accent-text` (`#667200`) on `surface` (light) | 5.15:1 | pass |
| `accent` (`#E8FF3D`) as text on `background` (dark) | 17.40:1 | pass |
| `accent` (`#E8FF3D`) as text on `surface` (dark) | 15.59:1 | pass |
| `accent` (`#E8FF3D`) as text on `background`/`surface` (light) | 1.06 / 1.09:1 | fails — never use the raw hex as text on light, always `accent-text` |
| `text` (white) on `accent-wash` composited over `surface` (dark, 10% alpha) | 13.31:1 | pass — confirms the wash doesn't erode legibility of content sitting on it |
| `text` (`#0B0B0B`) on `accent-wash` composited over `surface`/`background` (light, 14% alpha) | 18.77 / 18.44:1 | pass |
| `success-text` on `surface` (light) | 6.56:1 | pass |
| `warning-text` on `surface` (light) | 5.77:1 | pass |
| `danger-text` on `background`/`surface` (light) | 4.56–4.68:1 | pass |
| `danger-text` (`#E5605F`) on `background`/`surface` (dark) | 5.71 / 5.12:1 | pass |
| `success`/`warning` raw hue as **text** on dark | 5.19–10.59:1 | pass (no lighter variant needed) |
| `warning` (`#FAB219`) as text on **light** | 1.74:1 | fails — always icon+label, never bare text on light |
| `success` (`#0CA30C`) as text on **light** | 3.18:1 | fails 4.5:1 text bar — use `success-text` |

**Collision A — Electric Yellow accent vs. `warning` amber (resolved:
kept both hexes, proved distinct, didn't shift `warning`):**
`accent` (`#E8FF3D`) is HSL `hue 67°, sat 100%, light 62%` — a lime/chartreuse
yellow. `warning` (`#FAB219`) is HSL `hue 41°, sat 96%, light 54%` — an
amber/gold yellow. That's a **26° hue separation** (amber reads
orange-leaning, chartreuse reads green-leaning — most people will call these
"gold" and "lime" rather than both "yellow"), plus they never occupy the same
visual role: `accent` only ever appears as one large, flat, full-bleed fill on
an interactive control; `warning` never appears as a large fill in this
system (no `warning-surface`/fill token exists) — it is always a small
icon+text pairing per the status-color rule above. Different hue, different
size, different grammar, always co-occurring with different content (a button
label vs. a status message) — kept distinct without touching the value
`warning` shares with `dataviz`.

**Collision B — Electric Yellow vs. the `dataviz` chart palette on a dark
surface (re-checked, resolved: no collision):**
Dark-mode chart categorical hues are blue 213°, aqua 159°, yellow 40°, green
120°, violet 247°, red 0°, magenta 338°, orange 17°. `accent` at hue 67° sits
in the gap between the chart's yellow slot (Δ27°) and green slot (Δ53°) —
its nearest neighbor in the entire chart palette is the same 27° away as its
nearest neighbor in the status palette (`warning`). It is also far lighter
and more saturated (L62/S100) than any dark-mode chart mark is designed to
be — chart marks are thin lines/bars sized for the dark lightness band,
`accent` is a single large uppercase-labeled button fill. If a chart shares a
screen with the app's yellow CTA, nothing in the chart will read as "the same
color as that button."

**Consistency with the `dataviz` skill (updated for v0.2):**
- Neutral scale, ink roles, hairline/gridline colors, and the
  success/warning/danger hexes are unchanged from v0.1 and remain exact
  matches to `dataviz`'s reference palette — a chart dropped into a
  workout-pal screen still sits on the same surface, reads with the same
  ink, and its status dots still match the app's status badges.
- **`accent` is new territory relative to `dataviz`'s categorical/sequential
  hues** (which are all blue-anchored) — see Collision B above for why that's
  fine rather than a problem: the brand color and the chart's data hues don't
  share a lightness/saturation register, so there's no risk of a data point
  looking like "the brand," even though they're now in the same rough part
  of the hue wheel as the chart's warning/yellow status color.
- Typeface is **no longer** shared with `dataviz` — see §3.2. `dataviz`'s own
  guidance is to stay in "the system sans," which was true when workout-pal's
  UI was also system-ui. Chart chrome (axis labels, tooltips, legends) should
  keep using the plain system-sans per `dataviz`'s own rule, even on a
  workout-pal screen now set in Barlow/Anton — chart text is a `dataviz`
  concern and intentionally stays out of the product's display type system
  (numbers inside a chart are exactly the "columns that must align" case,
  which was already an exception to brand type in v0.1 too).

### 3.2 Typography

**Two self-hosted families, both shipped as `.woff2`, no CDN/network font
load** (local-first — this is a hosting/`@font-face` decision, and per the
brief the **software-architect owns the actual font-loading + fallback
strategy** once the stack is picked; this section defines what to load and
where each one is used):

- **Anton** (weight 400 only — it's a single-weight condensed display face)
  for `title-1` and static celebratory big numbers.
  Fallback stack: `"Anton", "Arial Narrow Bold", "Arial Narrow", sans-serif`
- **Barlow** (used across its weight range, 400–800) for everything else,
  including the live numeric `display` step — see the decision below.
  Fallback stack: `"Barlow", system-ui, -apple-system, "Segoe UI", sans-serif`

**Decision — what renders the big numbers, and why it's Barlow, not Anton:**
The rest-timer countdown and any live/in-session weight-or-reps number use
**Barlow at weight 800, with `font-variant-numeric: tabular-nums`** — not
Anton, even though Anton is the "display" face everywhere else. Reasoning:
Anton is a single-weight condensed face with no tabular/lining-figure
control, so a number that changes every second would visibly change *width*
tick to tick (its digits aren't monospaced) — that reads as jitter sitting
right next to Principle 3 ("never smoothed or estimated"): the layout should
be exactly as stable as the data is. Barlow's tabular figures guarantee the
countdown holds its box perfectly still while only the digits change.
Legibility-under-fatigue wins this one over brand consistency, per the brief.
Anton is reserved for **static** big numbers that are set once and read
once — a finished workout's total volume, a calendar streak count — where
maximum visual impact matters more than per-second stability. That case gets
its own scale step, `display-brand`, below.

| Step | Font / weight | Size / line-height | Case / tracking | Use |
|---|---|---|---|---|
| `display` | Barlow 800 (ExtraBold), `tabular-nums` | 48px / 1.05 (3rem) | — | rest-timer countdown, live weight/reps entry — legibility-critical, must not jitter |
| `display-brand` | Anton 400 | 44px / 1.05 (2.75rem) | uppercase | **new step** — static celebratory numbers: session total volume, streak count on the calendar |
| `title-1` | Anton 400 | 28px / 1.2 (1.75rem) | uppercase, +0.01em | screen title — one per screen |
| `title-2` | Barlow 700 (Bold) | 20px / 1.3 (1.25rem) | — | section header — kept in Barlow, not Anton, so repeated headers on one screen don't all shout at once |
| `title-3` | Barlow 600 (SemiBold) | 17px / 1.4 (1.0625rem) | — | card / list-item title |
| `body` | Barlow 400 | 16px / 1.5 (1rem) | — | default text — base size |
| `body-strong` | Barlow 600 (SemiBold) | 16px / 1.5 (1rem) | — | emphasized body, button labels |
| `caption` | Barlow 400 | 14px / 1.4 (0.875rem) | — | supporting/secondary text |
| `micro` | Barlow 600 (SemiBold) | 12px / 1.3 (0.75rem) | uppercase, +0.03em | tab labels, eyebrows, timestamps |

Numeric figures: `tabular-nums` on `display` (live) and any aligned column
(set-log history, past-session tables); proportional figures everywhere
else, including `display-brand`'s static numbers. Chart-internal numbers
stay in `dataviz`'s plain system-sans per that skill's own rule (see the
consistency callout above) — they are not set in Barlow/Anton.

### 3.3 Spacing scale (4px base) — unchanged

| Token | Value |
|---|---|
| `space-1` | 4px (0.25rem) |
| `space-2` | 8px (0.5rem) |
| `space-3` | 12px (0.75rem) |
| `space-4` | 16px (1rem) |
| `space-5` | 20px (1.25rem) |
| `space-6` | 24px (1.5rem) |
| `space-7` | 32px (2rem) |
| `space-8` | 40px (2.5rem) |
| `space-9` | 48px (3rem) |
| `space-10` | 64px (4rem) |
| `space-11` | 80px (5rem) |

### 3.4 Shape — square by default (revised in v0.3, reverses the v0.1 radius call)

The multi-step radius scale is gone. There is exactly one radius token, and
it's zero:

| Token | Value | Use |
|---|---|---|
| `radius` | **0** | every rectangular surface in the system — buttons, inputs, cards, list rows, sheets, modals, tags/badges |

**No border radius anywhere in the rectangular UI.** Sharp, square corners
on everything that is, geometrically, a rectangle. Former pill-shaped
tags/badges are now rectangular tags (fixed height, inline padding, `radius:
0` — see the sizing table in §2).

**The one exception: things that are genuinely circular.** "No radius" is a
rule about corners on rectangles — it says nothing about shapes that are
circles or arcs in their own right. The **rest-timer progress ring** is the
one shape in this system that's actually circular (drawn as an SVG
`<circle>`/arc `<path>`, or a `border-radius: 50%` container if implemented
that way) and it stays that way. It was never a "very round rectangle" — a
ring reads instantly as a countdown/progress shape precisely because it's a
circle, and squaring it off would cost that legibility for no shape-language
benefit. Any other genuinely circular element introduced later (e.g. a
circular avatar, if one is ever needed) falls under the same exception; a
*rectangle with rounded corners pretending to be soft* does not.

**Why this reverses the v0.1/v0.2 call:** v0.1 picked moderate/tight radii
deliberately so a *calm* system wouldn't also feel bubbly. That reasoning
doesn't hold once the identity itself is "bold graphic, athletic poster" —
sharp rectangles now do real work: paired with Anton's condensed all-caps
and the electric-yellow fill (§3.1–3.2), square corners read as
confident/blocky/scoreboard-like, which is exactly the personality being
asked for. Softness at the corners would undercut it.

### 3.5 Elevation / shadow (subtle only) — unchanged

**Light**

| Token | Value |
|---|---|
| `elevation-0` | none — `1px solid border` only |
| `elevation-1` (card) | `0 1px 2px rgba(11,11,11,0.04), 0 1px 1px rgba(11,11,11,0.02)` + hairline border |
| `elevation-2` (modal/sheet/popover) | `0 12px 32px rgba(11,11,11,0.14), 0 2px 8px rgba(11,11,11,0.08)` |

**Dark**

| Token | Value |
|---|---|
| `elevation-0` | none — hairline `border` only |
| `elevation-1` (card) | hairline `border` only, no shadow |
| `elevation-2` (modal/sheet/popover) | `0 16px 40px rgba(0,0,0,0.5)` |

### 3.6 Motion — unchanged

**Durations**

| Token | Value | Use |
|---|---|---|
| `duration-instant` | 80ms | tap/press feedback (button scale) |
| `duration-fast` | 150ms | hover, toggle, fade |
| `duration-base` | 200ms | default enter/exit (sheet, tab switch) |
| `duration-slow` | 320ms | screen push/pop, large sheet |

**Easing**

| Token | Curve | Use |
|---|---|---|
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | default for most transitions |
| `ease-out` | `cubic-bezier(0, 0, 0, 1)` | elements entering |
| `ease-in` | `cubic-bezier(0.3, 0, 1, 1)` | elements leaving |

**Presets**

| Preset | Spec |
|---|---|
| `fade` | opacity 0→1, `duration-fast` / `ease-standard` — toasts, content swap |
| `rise` | translateY(8px)+opacity 0 → translateY(0)+opacity 1, `duration-base` / `ease-out` — sheets, cards, new list items appearing after an action |
| `press` | scale 1→0.97, `duration-instant` / `ease-standard` — button/row tap feedback |
| `success-pulse` | scale 0.85→1 with a small overshoot to 1.03 then settle, 240ms — the one satisfying moment when a set is logged; used once, on that row only |
| `slide` | translateX(100%)→0, `duration-slow` / `ease-standard` — drilling into an exercise/detail screen |
| `timer-fill` | linear, duration = actual seconds remaining (driven by real timer data, never eased/smoothed) — the rest-timer ring |

`prefers-reduced-motion: reduce` → drop `rise`/`slide`/`press`/`success-pulse`
to an instant state change or a single `fade` step; `timer-fill` keeps
updating because it's data, not decoration, but any overshoot is removed.

### 3.7 Breakpoints (mobile-first) — unchanged

| Token | Min-width | Target |
|---|---|---|
| `base` | 0 | phone portrait — the primary target |
| `sm` | 480px | large phone / small tablet portrait |
| `md` | 768px | tablet |
| `lg` | 1024px | small laptop / tablet landscape |
| `xl` | 1280px | desktop |

Workout mode stays single-column and max-width 560px even above `md`.

### 3.8 Z-index layers — unchanged

| Token | Value | Use |
|---|---|---|
| `z-base` | 0 | default document flow |
| `z-sticky` | 10 | sticky headers, mini rest-timer bar |
| `z-dropdown` | 20 | dropdowns, popovers |
| `z-overlay` | 30 | scrim behind a sheet/modal |
| `z-modal` | 40 | modal / sheet |
| `z-toast` | 50 | toast / snackbar |
| `z-tooltip` | 60 | tooltip |

---

## 4. Forks — status after v0.3

### 4.1 Accent color + theme default — RESOLVED
**Decision:** dark theme is the default/preferred identity, light is kept
first-class, with a manual persisted toggle (see "Theming" in §2 for the
resolution algorithm: OS preference wins if it's explicitly `light`,
everything else — including no preference at all — falls back to dark).
Accent is **Electric Yellow `#E8FF3D`**.

Why this hex specifically: it's the brightest, purest "electric" yellow I
tested that still leaves room for a fully-compliant `on-accent` — near-black
text on it hits **17.62:1** (huge margin). White text on it, which is most
teams' default instinct for a colored button, **fails at 1.12:1** — that's
the single most important thing to carry into implementation: *this accent's
button text is dark, not white, in both themes.* As plain text/icon color it
only works on dark (13.9–17.4:1); on light surfaces it needs the darkened
`accent-text` (`#667200`, 5.0–5.2:1) instead of the raw hex.

Both collisions raised in the brief were checked quantitatively and
resolved without weakening the accent or breaking `dataviz` parity — see
§3.1 "Collision A" (vs. `warning`, 26° hue separation + different visual
grammar, `warning` hex unchanged) and "Collision B" (vs. the chart palette,
27° from the nearest chart hue, unchanged chart palette).

**New sub-decision made while resolving this:** added an `accent-wash` token
(a ~10–14%-alpha tint of the accent) so "selected but not primary" states
have somewhere to go other than a second full-saturation yellow block —
this directly supports the strengthened one-accent-per-screen rule now that
the accent is loud. Flag if you'd rather selected states use an outline only
and skip the wash token.

### 4.2 Shape (radius scale) — RESOLVED in v0.2, **REVERSED in v0.3**
v0.2 confirmed the v0.1 call: moderate/tight radii, 4–16px. **v0.3 overturns
this** — see §4.5 below for the current, live decision. Left here only so
the history of the call is traceable; §3.4 and §4.5 are authoritative.

### 4.3 Density — STILL OPEN
Carried over from v0.1, not addressed by the v0.2 direction change:
proposed **comfortable** as the default (bigger tap targets, looser rhythm)
over compact/information-dense, given the fatigued/one-handed usage pattern.
Confirm, or flag any screen (e.g. a history table) where you'd want a denser
exception.

### 4.4 Typography — RESOLVED
Confirmed: **Anton** (titles, static big numbers) + **Barlow** (everything
else, including the live numeric display), both self-hosted as `.woff2`,
zero CDN/network dependency. Full scale, weights, and fallback stacks in
§3.2. The software-architect owns the actual `@font-face`/loading strategy
(preload priority, `font-display`, subsetting) once the stack is picked —
this section only fixes *which* two families and *where* each is used.

**New sub-decision made while resolving this:** the live rest-timer/weight
numbers render in Barlow (tabular figures), not Anton — see the dedicated
callout in §3.2 for the legibility-over-brand reasoning, with a new
`display-brand` scale step added so Anton still gets to render the *static*
big numbers (workout totals, streaks) where brand impact can win instead.
Flag if this split feels wrong once it's on a real screen — it's the one
call in this revision I made unilaterally per the brief's instruction to
prioritize timer legibility.

### 4.5 Shape + sizing — RESOLVED in v0.3 (reverses §4.2)
**Decision:** no border radius anywhere in the rectangular UI — buttons,
inputs, cards, list rows, sheets, modals, and tags/badges are all sharp
rectangles (§3.4). The one exception is shapes that are actually circular,
i.e. the rest-timer progress ring, which was never part of the radius scale
to begin with. Paired with that: every tappable element gets bigger
(`control-height-md` 56px default, `control-height-lg` 64px for the primary
CTA and any mid-set control, both comfortably above the 44px a11y floor) and
the spacing rhythm shifted toward its larger steps (§2, "Component sizing"
and the revised "Layout & spacing rhythm" paddings).

This explicitly reverses §4.2/v0.1's "moderate/tight radii, considered over
bubbly" reasoning — that reasoning assumed a calm identity where geometry
needed to stay quiet. Once color and type went loud (v0.2), quiet geometry
started to read as three unrelated personality choices instead of one;
sharp rectangles pull shape into the same "bold graphic" register as the
electric-yellow fill and Anton's condensed caps, so the system now commits
to one identity instead of hedging on shape.

**What did NOT change:** color, type, motion, accessibility rules, and the
four states are all unchanged from v0.2 — this was scoped as a shape+sizing
revision only, and the brief was explicit that bigger/louder shapes must not
loosen the one-accent-per-screen or one-primary-action-per-screen rules
(both reaffirmed, more strictly if anything, in §1 and §2).
