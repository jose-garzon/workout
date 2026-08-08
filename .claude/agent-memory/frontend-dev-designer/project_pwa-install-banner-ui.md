---
name: project-pwa-install-banner-ui
description: pwa-install-banner UI build (2026-08-06/07, design.md §D6-D9, tasks 2.1-2.7+4.3) — border-strong token (3rd shared/ui token added by designer), Button has no className passthrough, temp preview-route technique for design-critique before a real screen exists
metadata:
  type: project
---

Built the install banner (`src/shared/ui/components/InstallBanner.tsx`) in
parallel with the software-engineer's `useInstallPrompt.ts` (group 1) and
`e2e/install-banner.spec.ts` (group 3) — zero conflicts, contract matched
exactly on both sides when merged. Full flow: 5 i18n keys (`install.*`) in
en/es, the component (`aria-labelledby` not `aria-label` — one accessible
name for the `region` role instead of announcing the title string twice),
mount as `AppShell`'s first child on `RoutineHomeScreen`, `InstallBanner.test.tsx`
(`vi.mock` the hook, one case per status). All 8 Playwright cases + the
Spanish e2e assertion went green against the real (non-stubbed) hook.

**`--color-border-strong` token added (design.md §D9) — the 3rd time this
project's `border` hairline (`rgba(*,0.10)`, ~1.1:1) has needed a real-token
fix rather than a one-off override**, because `Button.tsx`'s `secondary`
variant used it as a control's ONLY visual boundary (SC 1.4.11 needs 3:1).
Value reuses the already-measured `text-muted` hex (`#C3C2B7` dark /
`#52514E` light) — a new *token*, not a new *color*. This one-line variant
swap silently restyles every existing `secondary` button app-wide
(OnboardingForm's Back, RoutineHomeScreen's error dismiss) — confirmed via
screenshot both were a visible improvement (crisp outline vs. near-invisible
hairline), not a regression, in both themes.

**`Button.tsx`'s `ButtonProps` explicitly `Omit`s `className`** — it is not
a className-passthrough primitive by design (keeps every button on-system).
A layout need like `shrink-0` on a `<Button>` inside a flex row has to be
solved by wrapping it in a plain `<div className="shrink-0">`, not by trying
to pass a class into the component. Hit this once in `InstallBanner`, fixed
by wrapping — don't try `className` on `Button` again, it's a compile error.

**Technique for design-critique when the real screen can't show all states
yet:** the consumed hook (`useInstallPrompt`) was still stubbed to always
return `"hidden"` while I built (per the parallel-work instruction not to
touch it), so the live app couldn't show `native`/`ios`/`manual` for a real
screenshot pass. Built a throwaway Next.js route
(`src/app/preview-install-banner-tmp/page.tsx` — **no leading underscore**,
that makes Next treat the folder as private/unrouted) that replicates the
component's exact JSX/classNames for all three states side by side, wrapped
in `AppShell`'s real padding classes (not a guessed approximation — get the
effective content width exactly right or a 320px wrap check is meaningless).
Screenshotted via a throwaway Playwright script (`node` script run from repo
root so it resolves `node_modules`, not from the scratchpad dir) at 320/400px
× light/dark, using `page.addInitScript` to set `localStorage["wp.theme"]`
before navigating. Deleted the route + script before reporting done — never
committed, never left in `git status`.

**Design-critique output on this one:** no must-fix (matched the given
visual contract exactly — spacing, contrast, responsive wrap all correct out
of the box, first try). Two polish items flagged but deliberately NOT
implemented, both because they weren't in design.md's contract/non-goals and
would add logic beyond it: (1) the Install button unmounting after a
declined native prompt can drop keyboard focus to `<body>` with no focus
management; (2) the banner disappears with no exit transition (arguably
correct per "silence is a valid state," not clearly a gap). Reported both to
the user rather than silently adding scope.

See also [[project_accent-fill-discipline]] (this banner is a 3rd
`accent-wash`-as-tint, not-a-CTA usage) and [[project_ui-tests-cannot-import-shared-db]]
(irrelevant here — no persistence touched, correctly).
