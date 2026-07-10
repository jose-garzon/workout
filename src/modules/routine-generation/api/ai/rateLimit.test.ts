import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rateLimitOk, resetRateLimits } from "./rateLimit";

/**
 * Fixed-window IP limiter (design.md §D9). Defaults: 10 requests / 60s. `now` is
 * injected so the window is deterministic without fake timers.
 */

const WINDOW = 60_000;

beforeEach(() => resetRateLimits());
afterEach(() => resetRateLimits());

describe("rateLimitOk", () => {
  it("allows up to the max within a window, then blocks", () => {
    for (let i = 0; i < 10; i++) {
      expect(rateLimitOk("1.2.3.4", 1000)).toBe(true);
    }
    expect(rateLimitOk("1.2.3.4", 1000)).toBe(false);
    expect(rateLimitOk("1.2.3.4", 1000)).toBe(false);
  });

  it("resets after the window elapses", () => {
    for (let i = 0; i < 10; i++) rateLimitOk("1.2.3.4", 1000);
    expect(rateLimitOk("1.2.3.4", 1000)).toBe(false);

    // A request past the window boundary starts a fresh bucket.
    expect(rateLimitOk("1.2.3.4", 1000 + WINDOW)).toBe(true);
  });

  it("tracks IPs independently", () => {
    for (let i = 0; i < 10; i++) rateLimitOk("1.1.1.1", 1000);
    expect(rateLimitOk("1.1.1.1", 1000)).toBe(false);
    // A different IP is unaffected.
    expect(rateLimitOk("2.2.2.2", 1000)).toBe(true);
  });
});
