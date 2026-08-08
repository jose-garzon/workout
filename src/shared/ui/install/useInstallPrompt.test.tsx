import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BeforeInstallPromptEvent } from "./useInstallPrompt";
import { useInstallPrompt } from "./useInstallPrompt";

/**
 * Detection is browser-API sniffing, so each test stages the browser it is
 * about: the stash, `matchMedia`, or the UA. Bare jsdom (setup.ts's
 * `matches: false` matchMedia + a jsdom UA) is already the `manual` case.
 */

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const realMatchMedia = window.matchMedia;

/** `(display-mode: standalone)` matches; every other query keeps the stub. */
function runStandalone() {
  window.matchMedia = (query: string) =>
    query.includes("display-mode")
      ? ({
          matches: query.includes("standalone"),
          media: query,
        } as unknown as MediaQueryList)
      : realMatchMedia(query);
}

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

/**
 * A stand-in for the Chromium event. `cancelable` so `preventDefault()` is
 * observable as `defaultPrevented` — the mini-infobar suppression is the point.
 */
function promptEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt", {
    cancelable: true,
  }) as Event & Partial<BeforeInstallPromptEvent>;
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome });
  return event as BeforeInstallPromptEvent & {
    prompt: ReturnType<typeof vi.fn>;
  };
}

afterEach(() => {
  // `vitest.config.ts` sets no `test.globals`, so RTL's auto-cleanup never
  // registers — a leaked hook keeps its window listeners live across tests.
  cleanup();
  window.__wpInstallPrompt = null;
  window.matchMedia = realMatchMedia;
  Reflect.deleteProperty(navigator, "userAgent");
});

describe("useInstallPrompt — detection on mount", () => {
  it("is hidden when the app already runs standalone", () => {
    runStandalone();
    window.__wpInstallPrompt = promptEvent();

    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.status).toBe("hidden");
  });

  it("is native when the early-capture script already stashed an event", () => {
    window.__wpInstallPrompt = promptEvent();

    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.status).toBe("native");
  });

  it("is ios on an iPhone UA with no stashed event", () => {
    setUserAgent(IPHONE_UA);

    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.status).toBe("ios");
  });

  it("is manual in a browser with neither a prompt nor iOS", () => {
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.status).toBe("manual");
  });
});

describe("useInstallPrompt — events after mount", () => {
  it("goes native on beforeinstallprompt, suppressing the browser infobar", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.status).toBe("manual");

    const event = promptEvent();
    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.status).toBe("native");
    expect(event.defaultPrevented).toBe(true);
    expect(window.__wpInstallPrompt).toBe(event);
  });

  it("hides on appinstalled and drops the stash", () => {
    window.__wpInstallPrompt = promptEvent();
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(result.current.status).toBe("hidden");
    expect(window.__wpInstallPrompt).toBeNull();
  });

  it("stops listening once unmounted", () => {
    const { unmount } = renderHook(() => useInstallPrompt());
    unmount();

    window.dispatchEvent(promptEvent());

    expect(window.__wpInstallPrompt).toBeNull();
  });
});

describe("useInstallPrompt — promptInstall", () => {
  it("opens the native prompt and consumes the stash", async () => {
    const event = promptEvent();
    window.__wpInstallPrompt = event;
    const { result } = renderHook(() => useInstallPrompt());

    await act(() => result.current.promptInstall());

    expect(event.prompt).toHaveBeenCalledOnce();
    expect(window.__wpInstallPrompt).toBeNull();
    // `accepted` is deliberately left alone — `appinstalled` takes it to
    // "hidden" without flickering through "manual" (design §D3).
    expect(result.current.status).toBe("native");
  });

  it("falls back to manual copy when the user declines", async () => {
    window.__wpInstallPrompt = promptEvent("dismissed");
    const { result } = renderHook(() => useInstallPrompt());

    await act(() => result.current.promptInstall());

    expect(result.current.status).toBe("manual");
  });

  it("resolves without throwing when there is nothing to prompt", async () => {
    const { result } = renderHook(() => useInstallPrompt());

    await act(() => result.current.promptInstall());

    expect(result.current.status).toBe("manual");
  });
});
