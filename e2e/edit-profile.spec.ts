import { expect, type Page, test } from "@playwright/test";

/**
 * Feature edit-profile end-to-end (tasks.md group 6): after onboarding, the
 * home identity block gains an edit trigger that opens a drawer pre-filled from
 * the saved profile + goals. The drawer edits all 8 fields with onboarding's
 * exact validation + unit-awareness — toggling the unit CONVERTS the body
 * numbers, not just their labels — and Saves (persist to IndexedDB, no network,
 * close) or discards via four affordances (swipe-right, backdrop, X, Escape),
 * none of which persists.
 *
 * Written RED-first — nothing in this feature is built yet, so every test here
 * is expected to FAIL until the drawer + trigger land.
 *
 * ── Accessible-name contract the designer MUST match ─────────────────────────
 *   - edit trigger (in RoutineHomeScreen identity block):
 *                          role button, exact name "Edit profile"
 *   - drawer:              role dialog, aria-modal="true", accessible name
 *                          "Edit your data" (labelled by its title heading)
 *   - title:               role heading name "Edit your data"
 *   - close (X) button:    role button name "Close"
 *   - Save:                role button name "Save"
 *   - fields (reuse onboarding's unit-aware labels verbatim):
 *       displayName  → label "Your name"
 *       gender       → radios "Male" / "Female" / "Other"
 *       age          → label "Age"
 *       unit         → radios "Metric" / "Imperial"
 *       bodyweight   → label "Bodyweight (kg)"  |  "Bodyweight (lb)"
 *       height       → label "Height (cm)"      |  "Height (in)"
 *       focus        → radios "Strength" / "Hypertrophy" / "Endurance" /
 *                             "General fitness"
 *       daysPerWeek  → role radiogroup "Training days per week" of radios
 *                      "1".."7" (laid out as the two-column row — layout is the
 *                      designer's; the options are the model's describeField)
 *   - backdrop:            a full-screen element beneath the panel that closes
 *                          the drawer on click; the panel occupies the RIGHT of
 *                          the viewport, so a click at the far left hits it.
 *
 * Swipe-right (AC3.1): Desktop Chrome has no touch, and there is no drag
 * primitive for a custom JS touch handler — so the gesture is driven by
 * dispatching synthetic touchstart/move/end TouchEvents on the panel in
 * page.evaluate (net horizontal drag > threshold). `test.use({ hasTouch:true })`
 * is set on that block so the TouchEvent path is exercised as on a real device.
 * The three events are dispatched in SEPARATE ticks (an await between each): the
 * drawer's onTouchEnd reads the committed drag distance from React state, which
 * only reflects the touchmove after React re-renders — exactly what happens on a
 * real device where the events land in different event-loop turns.
 */

async function completeOnboarding(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();

  await page.getByLabel("Your name", { exact: false }).fill("Alex");
  // exact:true — a substring match on "Male" also hits "Female".
  await page.getByRole("radio", { name: "Male", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Age", { exact: false }).fill("28");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Bodyweight (kg)", { exact: false }).fill("80");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: "Strength" }).click();
  const increase = page.getByRole("button", {
    name: "Increase Training days per week",
  });
  for (let i = 0; i < 4; i++) await increase.click();
  await page.getByRole("button", { name: "Finish" }).click();

  await expect(page.getByRole("heading", { name: /Hey, Alex/ })).toBeVisible();
}

function dialog(page: Page) {
  return page.getByRole("dialog", { name: "Edit your data" });
}

async function openEditor(page: Page) {
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
}

test.describe("edit-profile", () => {
  test("opening the drawer pre-fills all 8 fields with saved values (AC1.1)", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await openEditor(page);
    const d = dialog(page);

    await expect(d.getByLabel("Your name", { exact: false })).toHaveValue(
      "Alex",
    );
    await expect(
      d.getByRole("radio", { name: "Male", exact: true }),
    ).toBeChecked();
    await expect(d.getByLabel("Age", { exact: false })).toHaveValue("28");
    await expect(d.getByRole("radio", { name: "Metric" })).toBeChecked();
    // Bodyweight in the chosen unit (metric → kg): the kg-labelled field
    // carries the saved value; no lb-labelled field exists.
    await expect(d.getByLabel("Bodyweight (kg)", { exact: false })).toHaveValue(
      "80",
    );
    await expect(d.getByLabel("Bodyweight (lb)", { exact: false })).toHaveCount(
      0,
    );
    // Height was left blank at onboarding (optional) → empty, cm-labelled.
    await expect(d.getByLabel("Height (cm)", { exact: false })).toHaveValue("");
    await expect(d.getByRole("radio", { name: "Strength" })).toBeChecked();
    await expect(
      d.getByRole("radio", { name: "4", exact: true }),
    ).toBeChecked();
  });

  test("drawer chrome is present: daysPerWeek row + Save (AC1.2)", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await openEditor(page);
    const d = dialog(page);

    const days = d.getByRole("radiogroup", { name: "Training days per week" });
    await expect(days).toBeVisible();
    await expect(
      days.getByRole("radio", { name: "1", exact: true }),
    ).toBeVisible();
    await expect(
      days.getByRole("radio", { name: "7", exact: true }),
    ).toBeVisible();
    await expect(d.getByRole("button", { name: "Save" })).toBeVisible();
  });

  test("editing enforces onboarding rules + unit-aware labels (AC2.1)", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await openEditor(page);
    const d = dialog(page);

    // Unit-aware label: switching to Imperial relabels the body inputs.
    await d.getByRole("radio", { name: "Imperial" }).click();
    await expect(
      d.getByLabel("Bodyweight (lb)", { exact: false }),
    ).toBeVisible();
    await expect(d.getByLabel("Height (in)", { exact: false })).toBeVisible();
    await expect(d.getByLabel("Bodyweight (kg)", { exact: false })).toHaveCount(
      0,
    );

    // Rule enforcement (age 13–120): an out-of-range age blocks Save and the
    // drawer stays open with the field indicated invalid.
    await d.getByLabel("Age", { exact: false }).fill("5");
    await d.getByRole("button", { name: "Save" }).click();
    await expect(d).toBeVisible();
    await expect(d.getByText(/13 to 120/i)).toBeVisible();
  });

  test("valid Save persists to IndexedDB, no network, and closes (AC2.2)", async ({
    page,
  }) => {
    let aiCalled = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/generate-routine")) aiCalled = true;
    });

    await completeOnboarding(page);
    await openEditor(page);
    const d = dialog(page);

    await d.getByLabel("Your name", { exact: false }).fill("Sam");
    await d.getByLabel("Bodyweight (kg)", { exact: false }).fill("85");
    await d.getByRole("button", { name: "Save" }).click();

    // Drawer closes; the live profile query re-emits and home reflects it.
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Hey, Sam/ })).toBeVisible();

    // Persisted to IndexedDB — survives a full reload.
    await page.reload();
    await expect(page.getByRole("heading", { name: /Hey, Sam/ })).toBeVisible();

    // Re-open shows the persisted values.
    await openEditor(page);
    await expect(
      dialog(page).getByLabel("Bodyweight (kg)", { exact: false }),
    ).toHaveValue("85");

    expect(aiCalled).toBe(false);
  });

  test("switching the unit converts the body values, and Save persists them (AC2.5)", async ({
    page,
  }) => {
    await completeOnboarding(page); // metric, bodyweight 80 kg
    await openEditor(page);
    const d = dialog(page);

    // Toggling to Imperial CONVERTS the number (80 kg → 176 lb), not just the
    // label — the same digits must not be reinterpreted on Save.
    await d.getByRole("radio", { name: "Imperial" }).click();
    await expect(d.getByLabel("Bodyweight (lb)", { exact: false })).toHaveValue(
      "176",
    );
    await expect(d.getByLabel("Bodyweight (kg)", { exact: false })).toHaveCount(
      0,
    );

    await d.getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);

    // Reopen: still ~176 lb (the stored 80 kg round-trips back to whole lb).
    await openEditor(page);
    await expect(
      dialog(page).getByLabel("Bodyweight (lb)", { exact: false }),
    ).toHaveValue("176");
  });

  test("Save with a cleared required field blocks, indicates, and stays open (AC2.4)", async ({
    page,
  }) => {
    let aiCalled = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/generate-routine")) aiCalled = true;
    });

    await completeOnboarding(page);
    await openEditor(page);
    const d = dialog(page);

    await d.getByLabel("Bodyweight (kg)", { exact: false }).fill("");
    await d.getByRole("button", { name: "Save" }).click();

    await expect(d).toBeVisible();
    await expect(d.getByText(/enter your bodyweight/i)).toBeVisible();
    // Nothing persisted — home identity is unchanged.
    await expect(
      page.getByRole("heading", { name: /Hey, Alex/ }),
    ).toBeVisible();
    expect(aiCalled).toBe(false);
  });

  test.describe("swipe-right discard", () => {
    test.use({ hasTouch: true });

    test("swipe right closes the drawer, saved data unchanged (AC3.1)", async ({
      page,
    }) => {
      await completeOnboarding(page);
      await openEditor(page);
      const d = dialog(page);

      await d.getByLabel("Your name", { exact: false }).fill("Temp");

      // Net horizontal touch drag to the right, past the ~80px threshold. The
      // three events are dispatched in separate ticks so React commits the drag
      // distance between touchmove and touchend (see header note).
      const box = await d.boundingBox();
      if (!box) throw new Error("no drawer box");
      const y = box.y + box.height / 2;
      const startX = box.x + 20;

      const touch = (type: string, x: number) =>
        page.evaluate(
          ({ type, x, y }) => {
            const el = document.querySelector('[role="dialog"]');
            if (!el) throw new Error("no dialog");
            const t = new Touch({
              identifier: 1,
              target: el,
              clientX: x,
              clientY: y,
            });
            const ongoing = type === "touchend" ? [] : [t];
            el.dispatchEvent(
              new TouchEvent(type, {
                bubbles: true,
                cancelable: true,
                touches: ongoing,
                targetTouches: ongoing,
                changedTouches: [t],
              }),
            );
          },
          { type, x, y },
        );

      await touch("touchstart", startX);
      await touch("touchmove", startX + 200);
      await touch("touchend", startX + 200);

      await expect(dialog(page)).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: /Hey, Alex/ }),
      ).toBeVisible();
    });
  });

  test("backdrop / X / Escape each close the drawer, saved data unchanged (AC3.2)", async ({
    page,
  }) => {
    await completeOnboarding(page);

    // X button.
    await openEditor(page);
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(dialog(page)).toHaveCount(0);

    // Escape.
    await openEditor(page);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);

    // Backdrop — the panel sits on the right, so a far-left click hits the
    // backdrop behind it.
    await openEditor(page);
    await page.mouse.click(10, 300);
    await expect(dialog(page)).toHaveCount(0);

    await expect(
      page.getByRole("heading", { name: /Hey, Alex/ }),
    ).toBeVisible();
  });

  test("reopening after discard shows saved values, not the discarded edit (AC3.3)", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await openEditor(page);
    const d = dialog(page);

    await d.getByLabel("Your name", { exact: false }).fill("Temp");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);

    await openEditor(page);
    await expect(
      dialog(page).getByLabel("Your name", { exact: false }),
    ).toHaveValue("Alex");
  });
});
