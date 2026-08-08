"use client";

/**
 * The app-wide install seam (design.md §D2). One field drives the whole
 * banner: `status` maps 1:1 onto the proposal's three visible branches plus
 * "not shown". The consuming component reads this hook and NOTHING else — no
 * `navigator`, no `matchMedia`, no event listeners in `ui/`.
 *
 * The global name `__wpInstallPrompt` is duplicated (unavoidably, as a
 * literal) in the early-capture inline <script> in app/layout.tsx, which has
 * to run before any JS module loads because `beforeinstallprompt` fires once
 * and is never replayed. Keep both in sync if this ever changes — the same
 * hazard `themeStore.ts` documents for `wp.theme`.
 */

import { useCallback, useEffect, useState } from "react";

/**
 * The Chromium-only event, typed locally — it is not in lib.dom. Only the two
 * members the hook uses are declared.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    /** Stashed by the early-capture script in app/layout.tsx (design §D3). */
    __wpInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

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

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Platform, not browser (design §D4): every iOS browser is WebKit and installs
 * through the same Share -> "Add to Home Screen" flow. The second clause catches
 * iPadOS, which reports a `Macintosh` UA; a touch-screen Mac is the known false
 * positive and lands on copy that is merely unhelpful, never broken.
 */
function isIOS(): boolean {
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua))
  );
}

export function useInstallPrompt(): InstallPromptApi {
  const [status, setStatus] = useState<InstallStatus>("hidden");

  // Detection runs on mount only, so the server render and the first client
  // render both stay "hidden" — no hydration mismatch, no flash (design §D3).
  useEffect(() => {
    if (isStandalone()) return;

    if (window.__wpInstallPrompt) {
      setStatus("native");
    } else {
      setStatus(isIOS() ? "ios" : "manual");
    }

    // Redundant with the early-capture script by design: it makes the hook
    // self-sufficient under RTL, where that script does not run.
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__wpInstallPrompt = event as BeforeInstallPromptEvent;
      setStatus("native");
    };
    const onAppInstalled = () => {
      window.__wpInstallPrompt = null;
      setStatus("hidden");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const event = window.__wpInstallPrompt;
    if (!event) return;

    // Chromium will not re-fire a consumed event, so the stash is cleared up
    // front: whatever happens next, this prompt cannot be opened twice.
    window.__wpInstallPrompt = null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Only `dismissed` moves the status — it would otherwise leave a dead
    // button on a banner with no dismiss control. `accepted` is left alone so
    // `appinstalled` takes it to "hidden" without flickering through "manual".
    if (outcome === "dismissed") setStatus("manual");
  }, []);

  return { status, promptInstall };
}
