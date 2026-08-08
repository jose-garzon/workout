# Design — PWA install banner

## Context

- The app is already installable (`app/manifest.ts` + Serwist `sw.ts`). Nothing
  invites the user to install. **This change touches neither file.**
- The banner is not a product domain: no entity, no persistence, no repo. It is
  app-level chrome derived entirely from browser APIs — the same shape as
  `shared/ui/theme` (`useTheme` + store), which is the precedent this design
  follows.
- Firewall rule 1 constrains where it can live: `modules/*/ui` may import only
  its own `logic/`, `shared/ui`, and `shared/i18n`.
- Home is `RoutineHomeScreen` (rendered only in `FirstRunGate`'s `home` slot),
  so "home only" is satisfied by *where the component is mounted*, not by a
  route check.

## Goals / Non-Goals

**Goals:**

- One place that answers "can we install, and how" — a single hook.
- Zero hydration risk, zero flash: nothing renders until the client has decided.
- Testable in Playwright without a real `beforeinstallprompt` (which cannot be
  produced naturally in a test browser).

**Non-Goals:**

- No persistence of any kind (no dismiss ⇒ nothing to store).
- No per-browser copy beyond the two tiers in the proposal.
- No new module, no barrel, no store.

## Decisions

### D1 — The code lives in `shared/ui`, not in a new module

```
src/shared/ui/install/useInstallPrompt.ts   [engineer]  detection + native prompt
src/shared/ui/components/InstallBanner.tsx  [designer]  the banner (uses the hook)
src/app/layout.tsx                          [engineer]  early-capture inline script
src/modules/routine-generation/ui/RoutineHomeScreen.tsx [designer] mounts <InstallBanner />
```

**Rule satisfied:** `RoutineHomeScreen` is `modules/*/ui` importing
`@/shared/ui/components/InstallBanner` — the `shared/ui` allowance in firewall
rule 1. `InstallBanner` (in `shared/ui`) imports `@/shared/ui/install/...` and
`@/shared/i18n` — both inside `shared/`, so no rule applies. Nothing in
`shared/ui` imports a feature's `logic/`, and nothing new enters the
dependency-cruiser graph (rule 3 governs `src/modules/**` only). No cycle.

Rationale: `shared/ui/theme` already establishes "app-level browser state +
its hook live in `shared/ui`, next to the components that consume it". Install
state is the identical shape.

*Rejected — a new `modules/pwa-install/` feature, passed into
`RoutineHomeScreen` as a `ReactNode` prop (the `weekStrip` pattern).* Prop
threading exists solely to route around rule 1's cross-**feature** ban, which
does not apply here — so it would be pure ceremony, plus a fifth module with no
domain, no types, no repo. Consequence if install ever grows a domain (dismiss
persistence, analytics): promote it to a real module then.

*Rejected — a `showInstallBanner` prop on `AppShell`.* Every screen uses
`AppShell`; home-only logic would leak into the shared frame.

### D2 — The logic↔UI interface

```ts
// src/shared/ui/install/useInstallPrompt.ts
export type InstallStatus = "hidden" | "native" | "ios" | "manual";

export interface InstallPromptApi {
  /**
   * hidden — render NOTHING. Installed / standalone, or not yet detected
   *          (server render + first client render always start here).
   * native — browser exposes a native prompt: title + description + button.
   * ios    — no native prompt, iOS device: title + description (Share →
   *          "Add to Home Screen"), NO button.
   * manual — no native prompt, not iOS: title + generic description, NO button.
   */
  status: InstallStatus;
  /** Opens the browser's native install prompt. No-op unless status === "native". */
  promptInstall: () => Promise<void>;
}

export function useInstallPrompt(): InstallPromptApi;
```

One field drives the whole render — `status` maps 1:1 onto the proposal's three
visible branches plus "not shown". The designer consumes this and nothing else:
no `navigator`, no `matchMedia`, no event listeners in `ui/`.

*Rejected — `{ status: 'installed'|'promptable'|'manual'; platform: 'ios'|'other' }`.*
Two fields whose legal combinations are a subset of the product (`installed` +
`ios` means nothing) push a truth table into the component. One enum, one switch.

### D3 — Detection, and why an inline capture script

`beforeinstallprompt` fires **once**, is not replayed, and Chromium commonly
fires it before home mounts (home sits behind `dynamic(ssr:false)` + a Dexie
profile read). A listener registered at mount can miss it and the button would
never appear on the primary Android story.

Add a second inline `<script>` in `app/layout.tsx` `<head>`, beside the existing
no-flash script (same precedent, same "duplicated literal" caveat):

```js
window.__wpInstallPrompt = null;
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__wpInstallPrompt = e;
});
```

Hook, all inside a mount effect (so SSR + first client render are `hidden` —
no hydration mismatch, no flash):

1. standalone? `window.matchMedia("(display-mode: standalone)").matches ||
   (navigator as { standalone?: boolean }).standalone === true` → `hidden`, stop.
2. `window.__wpInstallPrompt` already stashed → `native`.
3. else → iOS ? `ios` : `manual`.
4. listen `beforeinstallprompt` → `preventDefault()`, stash on
   `window.__wpInstallPrompt`, set `native`. (Redundant with the script by
   design: it makes the hook self-sufficient under RTL, where the script does
   not run.)
5. listen `appinstalled` → clear the stash, set `hidden`. This is what removes
   the banner without a reload.

`promptInstall()`: read + clear the stash; if absent, resolve. Else
`await e.prompt()`, `await e.userChoice`; if `outcome === "dismissed"` set
`manual`. Rationale: the event is consumed and Chromium will not re-fire it, so
leaving `status: "native"` would leave a dead button on a banner that cannot be
dismissed. `accepted` is left alone so `appinstalled` takes it to `hidden`
without a flicker through `manual`.

*Rejected — module-scope listener in the hook file instead of the inline
script.* The chunk evaluates at hydration, still after the event in the bad
case, and buries a side effect in an import.

### D4 — iOS detection: platform, not browser

```ts
const ua = navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua) ||
  (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua));
```

UA sniffing is imperfect; this is the least-bad version. The second clause
catches iPadOS, which reports a `Macintosh` UA. We branch on the **platform**,
not on Safari: every iOS browser is WebKit and every one of them installs
through the same Share → "Add to Home Screen" flow, so the iOS copy is correct
for iOS Chrome/Edge too. A desktop Mac with a touch display is the known false
positive; it lands on iOS copy that is merely unhelpful, never broken.

*Rejected — Safari-specific sniffing (`!/crios|fxios/`).* More regex, more
drift, and it would send iOS Chrome to generic copy that is *less* accurate.

### D5 — No persistence

No dismiss control ⇒ no state to remember. Zero Dexie tables, zero
localStorage keys, zero network calls. The local-first constraint holds
trivially. All state is React state in one hook plus one `window` property that
holds a live, non-serializable browser event.

### D6 — i18n keys (exact — both builders use these)

Added flat to `en.json` and `es.json`:

| key | shown when |
| --- | --- |
| `install.title` | always |
| `install.description.native` | `status === "native"` |
| `install.description.ios` | `status === "ios"` — names the Share menu + "Add to Home Screen" |
| `install.description.manual` | `status === "manual"` — one generic sentence |
| `install.cta` | button label, `status === "native"` only |

### D7 — Visual contract

First child of `AppShell`'s `<main>` inside `RoutineHomeScreen`, above the
greeting block. The `main` gap (`--space-6`) supplies the spacing below the
header — the banner sets no outer margin.

```
┌───────────────────────────────────────────────┐  bg-accent-wash
│ Install workout-pal            ┌────────────┐ │  border border-accent-text
│ Get it on your home screen…    │  Install   │ │  px --space-4 / py --space-3
└───────────────────────────────└────────────┘──┘  radius 0 (system-wide)
```

- container: `flex items-center gap-[var(--space-4)]`, `bg-accent-wash`,
  `border border-accent-text`, `px-[var(--space-4)] py-[var(--space-3)]`.
- text column: `flex min-w-0 flex-1 flex-col gap-[var(--space-1)]`;
  title `text-body-strong text-accent-text`, description
  `text-caption text-text-muted`.
- button: `<Button size="sm" variant="secondary">` (48px, clears the tap-target
  floor), `shrink-0`. **Secondary, not primary** — the composer's submit is
  already the one full-saturation accent fill on home
  (design-system.md §2 "Color usage"). `accent-wash` is a tint and stays legal
  (the `GoalBadge` precedent). The `secondary` variant needs the border fix in
  D9 first.
- 320px: stays one row. The button never shrinks or truncates; the description
  wraps to as many lines as it needs.
- Semantics: `<section aria-label={t("install.title")}>`, title as
  `<p className="text-body-strong text-accent-text">` — **not** an `<h2>`.
  The banner mounts above the greeting, and `RoutineHomeScreen.tsx` documents
  the greeting as the screen's one visible heading (`AppShell`'s `<h1>` is
  `sr-only`); an `<h2>` here would put "Install workout-pal" ahead of the user's
  greeting in both the AT heading list and the visual hierarchy. The
  `aria-label` keeps the region findable without competing for the outline.
  No `role="alert"`, no live region — it is not an interruption.

Craft (exact copy, entrance motion if any) is the designer's; the tokens above
are not.

### D8 — Testing

**Playwright** (`e2e/install-banner.spec.ts`). Every case seeds a profile first:
home sits behind `FirstRunGate`, which renders `WelcomeFlow` when no profile
exists — and four of these cases assert *absence*, so unseeded they would pass
against the wrong screen. Reuse the `seed(page)` pattern from
`e2e/workout-mode.spec.ts` verbatim. The states, each with a real seam:

- *manual (generic)* — the default. Playwright's Chromium never fires
  `beforeinstallprompt`, so a plain visit to home is exactly this case. This
  leans on a browser internal, so the spec file must name the assumption in a
  comment: if Chromium ever starts firing it, this case fails loudly instead of
  confusingly.
- *ios* — `test.use({ userAgent: "<iPhone Safari UA>" })`. Real UA, no stubbing.
- *native* — after home is visible, `page.evaluate` dispatches a synthetic
  event carrying the API surface the hook uses (`Event` instances are
  extensible):

  ```js
  const e = new Event("beforeinstallprompt");
  e.prompt = () => { window.__promptCalled = true; return Promise.resolve(); };
  e.userChoice = Promise.resolve({ outcome: "accepted" });
  window.dispatchEvent(e);
  ```

  Assert the button appears; click it; assert `window.__promptCalled`.
- *installed / standalone* — `page.addInitScript` wrapping `matchMedia` so
  `(display-mode: standalone)` matches and **every other query delegates to the
  real implementation** (the no-flash theme script calls
  `prefers-color-scheme` in the same document — a non-delegating stub breaks
  the page). Needs a **positive control**: assert the banner IS visible without
  the stub, then apply it and assert absence. D2 collapses "installed" and "not
  yet detected" into one `hidden`, so a bare absence assertion also passes if
  the hook threw or the seed failed silently.
- *install completes while visible* — dispatch the synthetic
  `beforeinstallprompt`, then `window.dispatchEvent(new Event("appinstalled"))`;
  assert the banner disappears with no reload.
- *home only* — visit `/workout/<dayId>` (the seeded routine supplies the id)
  and `/profile`; assert absent.
- *localized* — the `install.*` strings render in Spanish. Not a case in this
  file: extend `e2e/i18n-spanish.spec.ts`, which already runs under the
  `spanish` project (`locale: "es-ES"`, `playwright.config.ts`).

**Vitest + RTL**

- `useInstallPrompt.test.tsx` (`renderHook`): standalone → `hidden`;
  pre-stashed `window.__wpInstallPrompt` → `native`; iPhone UA → `ios`; bare
  jsdom → `manual`; dispatch `beforeinstallprompt` after mount → `native` and
  `preventDefault` was called; `appinstalled` → `hidden`; `promptInstall()`
  calls `prompt()`, and a `dismissed` outcome lands on `manual`.
- `InstallBanner.test.tsx`: `vi.mock` the hook, assert per status — button
  present only for `native`, absent for `ios`/`manual`, nothing rendered for
  `hidden`, and each status renders its own description key.

### D9 — Fix `secondary`'s border app-wide, not in the banner

`Button.tsx` `secondary` is `bg-transparent … border border-border`, and
`--color-border` is `rgba(255,255,255,0.1)` / `rgba(11,11,11,0.1)` — ~1.1:1,
against the 3:1 SC 1.4.11 needs for a control's only boundary. This banner is
the first screen to put that button on a tinted surface, but the failure is
backdrop-independent: it is equally broken today on `background` and `surface`.

Fix: add `--color-border-strong` to both theme blocks in `tokens.css`, map it in
`globals.css`'s `@theme inline`, and switch `VARIANT_CLASSES.secondary` to it.
Value = the existing muted ink (`#C3C2B7` dark / `#52514E` light), already
measured at 10.85:1 / 7.53:1 in design-system.md §3.1 — so this needs a new
*token*, not a new *color* or a new measurement. Blocks the banner's button
(task 2.4).

*Rejected — a banner-scoped `border-accent-text` override.* It leaves the same
failure live on the two existing `secondary` sites (`OnboardingForm.tsx`,
`RoutineHomeScreen.tsx`'s error dismiss) and adds a one-off that the design
system exists to prevent. This finding was deferred at foundation time
explicitly until a real screen exposed it; this is that screen.

## Risks / Trade-offs

- **The inline script adds a `window` global (`__wpInstallPrompt`) duplicated
  as a literal in the hook** → same hazard as `wp.theme` today; document both
  sides, exactly as `themeStore.ts` does.
- **UA sniffing misfires on touch-screen Macs** → they get iOS copy. Unhelpful,
  not broken; no button is involved.
- **Chromium may fire `beforeinstallprompt` before the capture script in exotic
  cases** → the banner falls back to `manual` copy, which still tells the user
  what to do. Degradation, not failure.
- **A user who dismisses the native prompt sees the banner switch to manual
  copy** → accepted: the alternative is a permanently dead button on a banner
  with no dismiss control.
- **D9 changes two existing screens** (onboarding's Back, home's error dismiss)
  — their outline gets visibly stronger. Intended: that is the accessibility
  fix, not a side effect. Both are covered by existing e2e specs, which assert
  roles and names, not pixels.
- **The synthetic-event e2e seam tests our handling, not Chromium's real
  prompt** → the real prompt cannot be produced in automation at all; manual
  verification on an Android device is the only way to close that gap.

## Open Questions

None.
