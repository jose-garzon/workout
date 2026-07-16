import "@testing-library/jest-dom/vitest";
// Real Dexie against an in-memory IndexedDB — a broken migration/index fails a
// test instead of shipping (design.md §6). Must load before any db import.
import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// jsdom has no CSS Animation/Transition support at all, which React's event
// system feature-detects at module-load time: with no `window.AnimationEvent`
// (`window.TransitionEvent`), it never wires up a root listener for
// `animationend`/`transitionend`, so a component's `onAnimationEnd` prop
// silently never fires — the mount-lifecycle drawers/sheets in this app all
// rely on that callback to unmount after their exit animation. Must run
// before ANYTHING imports react-dom (a `setupFiles` entry runs first, and
// nothing above this line does).
if (typeof window.AnimationEvent === "undefined") {
  class AnimationEventPolyfill extends Event {}
  // @ts-expect-error — minimal stand-in, jsdom has no real implementation.
  window.AnimationEvent = AnimationEventPolyfill;
}
if (typeof window.TransitionEvent === "undefined") {
  class TransitionEventPolyfill extends Event {}
  // @ts-expect-error — minimal stand-in, jsdom has no real implementation.
  window.TransitionEvent = TransitionEventPolyfill;
}

// jsdom doesn't implement `matchMedia` — every mount-lifecycle drawer/sheet
// (`ActivityDrawer`, `RoutineEditor`, `ProfileDrawer`) calls it via
// `prefersReducedMotion()`/`isDesktopViewport()` on mount, so any test that
// actually renders one throws without this stub. Reports `matches: false`
// (motion on, mobile-width) — the common case; a test that needs the other
// branch overrides `window.matchMedia` itself.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
