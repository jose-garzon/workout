---
name: project-edit-profile-drawer-ui
description: edit-profile change (2026-07-15) — ProfileDrawer built, ChoiceGroup gained a "grid" layout, e2e green
metadata:
  type: project
---

Built `src/modules/profile-goals/ui/ProfileDrawer.tsx` (edit-profile change,
tasks.md groups §4-§5) — a right-slide drawer (both viewports, no desktop
modal flip, unlike `ActivityDrawer`) holding all 8 onboarding fields at once
+ `Save`. Consumes `useProfileEditor` (engineer's hook, landed in parallel)
internally — not a pure-props renderer like `OnboardingForm`.

**2026-07-15 revision (tasks.md §7.3):** `ThemeToggle` was pulled from the
drawer post-review (scope cut, not a bug) — removed the import/render and
its `describe` block + the `switch` assertion from `ProfileDrawer.test.tsx`;
also dropped the now-unused `items-start` wrapper class the toggle needed
(`Button`'s own `fullWidth` already forces Save full-width regardless of
the container's `align-items`).

**Why this shape:** design.md D3 explicitly called for `daysPerWeek` to
render as a two-column grid of its 1-7 options instead of onboarding's
`CountStepper`. Added a third `ChoiceGroupLayout = "grid"` to the shared
`shared/ui/primitives/ChoiceGroup.tsx` primitive (bordered 2-col cells,
`ArrowRight`/`ArrowLeft` roving nav) rather than a one-off local control —
reusable by any future 5+ option field that doesn't fit "segmented" or
"stack". Also extended `FOCUSABLE_SELECTOR`-style patterns to always exclude
`tabindex="-1"` uniformly (roving-tabindex radios only expose their one
tabbable option to a real focus trap).

**Focus-return without a trigger ref:** design.md fixed `ProfileDrawer`'s
props to `{ open, onClose, profile, goals }` (no `editButtonRef` prop, unlike
`RoutineEditor`'s pattern). Solved by capturing `document.activeElement` the
moment the drawer mounts and restoring it on every discard path — works for
any trigger without threading a ref.

**How to apply:** when a field needs >4 options in a tight space, reach for
`ChoiceGroup layout="grid"` before inventing a new control. When a
drawer/dialog's props are fixed and can't carry a trigger ref, the
activeElement-capture-on-mount pattern is the reusable fix — see
`ProfileDrawer`'s `triggerRef`.

Status: e2e (`e2e/edit-profile.spec.ts`, 9/9) and unit (`ProfileDrawer.test.tsx`,
14/14) both green; `bun run check`/`depcruise`/`tsc` clean on my files.
