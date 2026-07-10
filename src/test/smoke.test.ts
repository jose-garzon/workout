import { afterEach, describe, expect, it } from "vitest";
import { postGenerateRoutine } from "@/modules/routine-generation/api/ai/client";
import { db } from "@/shared/db";

/**
 * Foundation smoke tests — prove the harness itself works (Vitest +
 * fake-indexeddb + MSW) and that the local-first data layer + the AI client's
 * offline surface behave. Feature behavior is tested in the feature changes.
 */

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});

describe("shared/db (fake-indexeddb)", () => {
  it("persists and reads a row via real Dexie", async () => {
    await db.profile.put({ id: "me", unit: "metric", bodyweightKg: 80 });
    const row = await db.profile.get("me");
    expect(row?.unit).toBe("metric");
    expect(row?.bodyweightKg).toBe(80);
  });
});

describe("MSW OpenRouter mock", () => {
  it("intercepts the upstream chat-completions call", async () => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
    });
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    expect(json.choices[0].message.content).toBe("{}");
  });
});

describe("AI client offline surface (task 7.3)", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });

  it("returns { kind: 'offline' } without hitting the network when offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    const outcome = await postGenerateRoutine("push/pull/legs");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toEqual({ kind: "offline" });
    }
  });

  it("leaves the offline branch and attempts the request when online", async () => {
    const outcome = await postGenerateRoutine("push/pull/legs");
    // Online, it dispatches to /api/generate-routine; whatever comes back, it is
    // NOT the short-circuit offline error.
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).not.toBe("offline");
    }
  });
});
