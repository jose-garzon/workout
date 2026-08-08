# Tasks — PWA install banner

Task 1.1 is the gate: it lands the `useInstallPrompt` types and signature
(design §D2). The designer starts group 2 the moment it exists and never reads a
browser API. No manifest, service-worker, Dexie, or network change anywhere.

## 1. Install detection (engineer)

- [x] 1.1 [engineer] Create `src/shared/ui/install/useInstallPrompt.ts` with the
      exact seam from design §D2: `InstallStatus =
      "hidden" | "native" | "ios" | "manual"`, `InstallPromptApi { status;
      promptInstall: () => Promise<void> }`, plus the local
      `BeforeInstallPromptEvent` type and the
      `declare global { interface Window { __wpInstallPrompt?: ... } }`.
      Land this first — it unblocks group 2.
- [x] 1.2 [engineer] Add the early-capture inline `<script>` to
      `src/app/layout.tsx` `<head>`, beside the no-flash script (design §D3):
      `preventDefault()` + stash on `window.__wpInstallPrompt`. Document that the
      global name is duplicated in `useInstallPrompt.ts`, the same way
      `themeStore.ts` documents `wp.theme`.
- [x] 1.3 [engineer] Implement detection in a **mount effect only** so SSR and
      the first client render are both `hidden` (design §D3): standalone check →
      `hidden`; existing stash → `native`; else iOS → `ios`, otherwise `manual`.
- [x] 1.4 [engineer] Implement the iOS test from design §D4 — `iphone|ipad|ipod`
      OR (`maxTouchPoints > 1` AND `macintosh`). Platform, not browser.
- [x] 1.5 [engineer] Add the `beforeinstallprompt` listener (preventDefault,
      stash, → `native`) and the `appinstalled` listener (clear stash, →
      `hidden`); remove both on unmount.
- [x] 1.6 [engineer] Implement `promptInstall` (stable via `useCallback`):
      no stash → resolve; else clear the stash, `prompt()`, `await userChoice`,
      and set `manual` **only** on `dismissed` — `accepted` is left for
      `appinstalled` so there is no flicker (design §D3).
- [x] 1.7 [engineer] `src/shared/ui/install/useInstallPrompt.test.tsx`
      (`renderHook`) covering design §D8: standalone → `hidden`; pre-stashed
      event → `native`; iPhone UA → `ios`; bare jsdom → `manual`; post-mount
      `beforeinstallprompt` → `native` + `preventDefault` called; `appinstalled`
      → `hidden`; `promptInstall()` calls `prompt()`; `dismissed` → `manual`.

## 2. Banner UI (designer)

- [x] 2.1 [designer] Add the five keys from design §D6 to
      `src/shared/i18n/en.json` and `src/shared/i18n/es.json`:
      `install.title`, `install.description.native`, `install.description.ios`,
      `install.description.manual`, `install.cta`. Identical key sets in both
      files. The iOS string must name the Share menu and "Add to Home Screen";
      the manual string is one generic sentence.
- [x] 2.2 [designer] Create `src/shared/ui/components/InstallBanner.tsx`
      (`"use client"`). It consumes `useInstallPrompt()` and `useTranslation()`
      and **nothing else** — no `navigator`, no `matchMedia`, no event
      listeners. `status === "hidden"` renders `null`.
- [x] 2.3 [designer] Apply the visual contract in design §D7: `bg-accent-wash`,
      `border border-accent-text`, `px-[var(--space-4)] py-[var(--space-3)]`,
      `<section aria-label={t("install.title")}>` with the title as a
      `<p className="text-body-strong text-accent-text">` — **not an `<h2>`**;
      the greeting stays home's first and only visible heading (design §D7).
      Description in `text-caption text-text-muted`, text column `min-w-0
      flex-1`. Zero radius, no outer margin.
- [x] 2.3b [designer] **Before 2.4** — fix `secondary`'s border (design §D9):
      add `--color-border-strong` to both theme blocks in
      `src/shared/ui/tokens/tokens.css` (`#C3C2B7` dark / `#52514E` light), map
      it in `src/app/globals.css`'s `@theme inline`, switch
      `VARIANT_CLASSES.secondary` in `src/shared/ui/primitives/Button.tsx` to
      `border-border-strong`, and record the token in design-system.md §3.1.
      `border-border` is ~1.1:1 — below the 3:1 SC 1.4.11 needs for a control's
      only boundary. This intentionally restyles the two existing `secondary`
      sites (`OnboardingForm.tsx`, `RoutineHomeScreen.tsx`'s error dismiss).
- [x] 2.4 [designer] Render the install button only when `status === "native"`:
      `<Button size="sm" variant="secondary">` calling `promptInstall`,
      `shrink-0`. Secondary is required — the composer's submit is already home's
      one full-saturation accent fill.
- [x] 2.5 [designer] Mount `<InstallBanner />` as the FIRST child inside
      `AppShell` in `src/modules/routine-generation/ui/RoutineHomeScreen.tsx`,
      above the greeting block. Nothing else on home changes; no other screen
      mounts it.
- [x] 2.6 [designer] Verify 320px: one row, button never shrinks or truncates,
      description wraps.
- [x] 2.7 [designer] `src/shared/ui/components/InstallBanner.test.tsx` —
      `vi.mock` the hook and assert one case per status: `hidden` renders
      nothing; `native` renders title + native description + button; `ios` and
      `manual` each render their own description and NO button.

## 3. End-to-end (engineer)

Written RED before group 2 exists. The specs read the `install.*` strings out of
`en.json`/`es.json` (imported with `with { type: "json" }`) instead of repeating
them as literals, so they cannot drift from task 2.1's copy; a key that is still
missing falls back to its own name and simply matches nothing.

- [x] 3.0 [engineer] Create `e2e/install-banner.spec.ts` with a `seed(page)`
      helper copied verbatim from `e2e/workout-mode.spec.ts` — `goto("/")`, wait
      for the `Start` button (this is what lets Dexie create the object stores
      before the raw open races it), `indexedDB.open("workout-pal")`, `put`
      profile + goals + routine, reload. **3.1–3.6 each call it first.** Without
      it `FirstRunGate` renders `WelcomeFlow`, not home, and the four
      absence-asserting cases pass vacuously. The helper also exposes the seeded
      routine's `dayId` for 3.6.
- [x] 3.1 [engineer] Default Chromium (never fires `beforeinstallprompt`) is the
      generic `manual` case: banner visible, no install button. Add a file-level
      comment naming that Chromium assumption as a fixture, so a future browser
      change fails loudly rather than confusingly (design §D8).
- [x] 3.2 [engineer] iOS case via `test.use({ userAgent: "<iPhone Safari UA>" })`
      — banner visible, no button, description mentions Share / Add to Home
      Screen.
- [x] 3.3 [engineer] Native case: `page.evaluate` dispatches the synthetic
      `beforeinstallprompt` from design §D8 (with `prompt` setting
      `window.__promptCalled` and a resolved `userChoice`); assert the button
      appears, click it, assert `__promptCalled`.
- [x] 3.4 [engineer] Install-completes case: dispatch the synthetic
      `beforeinstallprompt`, then `new Event("appinstalled")`; assert the banner
      disappears with no reload.
- [x] 3.5 [engineer] Standalone case, with a **positive control**: assert the
      banner IS visible without the stub, then `page.addInitScript` wrapping
      `matchMedia` so `(display-mode: standalone)` matches while **every other
      query delegates to the real implementation** (the no-flash script queries
      `prefers-color-scheme` in the same document), and assert absence. The
      control is required: `hidden` also means "not yet detected" (design §D2),
      so bare absence would also pass if the hook threw or the seed failed.
- [x] 3.6 [engineer] Home-only case: visit `/workout/<dayId>` (id from 3.0's
      seed) and `/profile`; assert the banner is absent on both.
- [x] 3.7 [engineer] Spanish coverage for the "Localized banner strings"
      requirement: extend `e2e/i18n-spanish.spec.ts` (already runs in the
      `spanish` project, `locale: "es-ES"`) with an assertion that the banner's
      title and description render the `es.json` strings.
- [x] 3.8 [engineer] Declined-prompt case (proposal "Native prompt available",
      third criterion — no coverage otherwise, since 3.3's synthetic
      `userChoice` resolves `accepted`): dispatch a synthetic
      `beforeinstallprompt` whose `userChoice` resolves
      `{ outcome: "dismissed" }`, click the button, then assert the banner is
      still visible, the button is gone, and the manual description is showing.
- [x] 3.9 [engineer] Empty-home case (proposal "No routine yet"): seed profile +
      goals but NO routine; assert the banner renders exactly as it does with
      one. Every other case seeds a routine, so this path is otherwise untested.

## 4. Verify

- [x] 4.1 [engineer] `bun run check` + `bun run typecheck` + `bun run depcruise`
      pass — no firewall violation (design §D1: `modules/*/ui` imports
      `shared/ui` only). There is no `lint` script; the Biome script is `check`.
- [x] 4.2 [engineer] Full Vitest + Playwright suites green, except three
      failures that reproduce identically on a clean `HEAD` (verified by
      stashing this change): `ProfileScreen.test.tsx` "renders the name more
      prominently" (expects `text-display`, gets `text-title-1`),
      `workout-mode.spec.ts` overtime prompt, and `offline.offline.spec.ts`
      reload. All three pre-date this change and are tracked separately.
- [x] 4.3 [designer] Run `design-critique` on home with the banner in all three
      visible states, light and dark.
