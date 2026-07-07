---
name: design-critique
description: Critique a UI (screenshot, component, or live screen) against visual and UX heuristics, and return prioritized, concrete fixes. Use when reviewing or refining any interface, or as a self-review before calling a screen done. Stack-agnostic.
metadata:
  author: workout-pal
  version: "1.0"
---

Critique a UI and return prioritized, actionable fixes. Not a rewrite — a ranked list of what's wrong and the concrete change to make.

**Input**: a screenshot, a component file, or a running screen (drive it if you can). If none is given, ask what to critique.

## Pass over these heuristics, in order

1. **Hierarchy** — does the eye land on the most important thing first? Is primary action obvious vs secondary? Fix with size, weight, color, position — not decoration.
2. **Spacing rhythm** — is spacing on a consistent scale (e.g. 4/8px steps)? Flag one-off arbitrary values. Related things close, unrelated things apart.
3. **Type scale** — a small set of sizes/weights used consistently? Flag random font sizes. Line length 45–75 chars for body.
4. **Color & contrast** — limited, intentional palette. **Check WCAG AA**: 4.5:1 body text, 3:1 large text and UI boundaries. Name any failing pair.
5. **Consistency** — same component/pattern for the same job everywhere. Flag divergent buttons, cards, inputs.
6. **States** — are loading, empty, error, and success all designed? Missing empty/error states are the most common gap — check explicitly.
7. **Responsive** — does it hold at narrow (mobile) and wide widths? Flag overflow, cramped tap targets (<44px), reflow breaks.
8. **Accessibility** — semantic elements, focus-visible states, labels/alt, keyboard reachable, not color-only signaling.
9. **Affordance & feedback** — do interactive things look interactive? Is there feedback on action (hover, active, disabled, loading)?

## Output

A ranked list, most impactful first. Each item:
- **What** — the specific problem, with location.
- **Why** — which heuristic it violates and the user impact.
- **Fix** — the concrete change (value, property, or pattern), not a vague direction.

Separate **must-fix** (broken, inaccessible, inconsistent) from **polish** (nice-to-have refinement). Be honest — if it's good, say so and don't manufacture problems.
