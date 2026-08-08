---
name: e2e-theme-color-scheme
description: Playwright defaults to colorScheme "light", so the app renders LIGHT — any e2e asserting the dark default must set test.use({ colorScheme: "dark" })
metadata:
  type: reference
---

Playwright's default context is `colorScheme: "light"`, and `playwright.config.ts`
does not override it. The app's theme resolution (design-system.md §2) is:
a persisted `wp.theme` wins; otherwise **explicit `light` → light**, and only
dark / no-preference / unavailable fall through to the dark default.

So in e2e the app legitimately boots **light**, not dark. Any spec that asserts
`html[data-theme="dark"]`, or that leans on `ThemeToggle`'s label
(`common.theme.dark` = "Dark"/"Oscuro") as a convenient translated string, must
first pin the preference at the top of the file:

```ts
test.use({ colorScheme: "dark" });
```

Applied 2026-08-05 to `e2e/profile-page.spec.ts` and `e2e/language-toggle.spec.ts`.
Without it the failure reads as a theme bug when the app is behaving correctly —
it is the *spec's* assumption that is wrong. See
[[integration-test-placement]] for the other gate gotcha in this repo.

**Known standing e2e reds (verified pre-existing at HEAD on 2026-08-05, in a
clean worktree — do not attribute them to your change):**
`e2e/workout-mode.spec.ts` "guide a full session" (the session screen's Reps
field added a step the recorded tap sequence doesn't account for) and
`e2e/offline.offline.spec.ts` (offline reload gets `net::ERR_FAILED`; the SW is
not serving the cached shell). Confirm with a `git worktree add <dir> HEAD`
before assuming a red is yours — it is cheap and decisive.

Re-confirmed 2026-08-08: "guide a full session" is still red (now failing at the
overtime `/Time.?s up/i` assertion). It navigates straight to `/workout/<dayId>`
and never touches home, so home-list changes cannot be the cause. The standing
**unit** red at that date was `profile-goals/ui/ProfileScreen.test.tsx`
("renders the name more prominently than the title" — expects `text-display`,
gets `text-title-1`); everything else in `bun run test` was green.
