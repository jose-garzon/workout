---
name: feedback-radius-full-zeroed-and-errorboundary-hooks
description: two easy-to-miss gotchas hit building workout-mode's Stopwatch — Tailwind's rounded-full is neutered to 0 in this app, and ErrorBoundary's fallback prop can't call hooks directly
metadata:
  type: feedback
---

**1. `rounded-full` renders a SQUARE in this codebase, not a circle.**
`app/globals.css`'s `@theme inline` maps `--radius-full` onto the same
zeroed `--radius` token as every other radius step (design-system.md §3.4's
"zero everywhere" is applied uniformly, including the `full` step Tailwind
normally reserves for pills/circles). The one genuinely circular element the
design system allows (the rest-timer ring, §3.4's named exception) has to be
drawn with `borderRadius: "50%"` set **inline**, never via a Tailwind radius
utility. Landed in `modules/workout-mode/ui/Stopwatch.tsx`.

**Why this matters:** this is exactly the kind of thing that looks correct
in code review (`rounded-full` reads as "obviously a circle") but silently
renders wrong — worth grep-checking for `rounded-full`/`rounded-` anywhere a
truly circular shape is needed before trusting the utility class.

**How to apply:** any future circular UI (an avatar, per §3.4's own
example) needs the same inline `borderRadius: "50%"` treatment, not
`rounded-full`.

**2. `ErrorBoundary`'s `fallback` prop can't call hooks directly — it must
return an element, not execute a hook inline.** `ErrorBoundary`
(`shared/ui/components/ErrorBoundary.tsx`) is a class component that calls
`this.props.fallback(this.state.error)` directly inside its own `render()`.
If `fallback` is `() => { const router = useRouter(); ... }`, that hook call
happens with no function-component render context active (a class
component's `render()` isn't a hooks dispatcher context) and breaks the
rules of hooks. Fix: `fallback={() => <SomeComponent />}` — return an
*element description*, and put the hook inside `SomeComponent` itself,
which React then mounts and renders normally with its own proper context.
Hit this building `workout-mode`'s error state (needed `useRouter` for a
"back to home" button in the `ErrorBoundary` fallback) — see
`modules/workout-mode/ui/WorkoutModeBody.tsx`'s `MessagePanel`/`ErrorState`.

**How to apply:** any future `ErrorBoundary` fallback that needs a hook
(router, theme, any shared/ui hook) must be factored into its own named
component and referenced via JSX in the `fallback` callback, never called
as a bare inline function that runs a hook itself.
