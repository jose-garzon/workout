import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { Goals, Profile } from "../types";
import { ProfileDrawer } from "./ProfileDrawer";

/**
 * UI tests against the REAL `useProfileEditor` (real Dexie/fake-indexeddb
 * underneath it), mirroring `firstRunGate.integration.test.tsx`'s convention
 * for a component that owns its seam call internally (design.md D3) rather
 * than receiving it as a prop (unlike `OnboardingForm`, a pure renderer of an
 * injected prop, tested against a hand-built double).
 *
 * These tests stay UI-only per the firewall (`modules/*\/ui` may import only
 * its own `logic/` + `shared/ui` — not `shared/db`, enforced by Biome even in
 * test files): they assert on the drawer's own contract (what's shown, which
 * affordance closes it, whether `Save`'s result opens/keeps it) and leave
 * "did the byte land in IndexedDB" to `useProfileEditor.test.tsx` (a `logic/`
 * test, which the firewall does let touch `shared/db`).
 *
 * `vitest.config.ts` sets no `test.globals`, so RTL's auto-cleanup never
 * registers — hence the explicit `afterEach(cleanup)`.
 */
afterEach(cleanup);

const profile: Profile = {
  id: "me",
  displayName: "Alex",
  gender: "male",
  age: 28,
  unit: "metric",
  bodyweightKg: 80,
  heightCm: 180,
};

const goals: Goals = { id: "me", focus: "strength", daysPerWeek: 4 };

/**
 * Mirrors the real app-layer wrapper (`page.tsx`'s `Home`): a trigger button
 * owns `open`, `ProfileDrawer` is a sibling — the shape the discard/re-open/
 * focus-return assertions below depend on.
 */
function Harness({ initialOpen = false }: { initialOpen?: boolean } = {}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Edit profile
      </button>
      <ProfileDrawer
        open={open}
        onClose={() => setOpen(false)}
        profile={profile}
        goals={goals}
      />
    </>
  );
}

function dialog() {
  return screen.getByRole("dialog", { name: "Edit your data" });
}

/**
 * Wait for the mount-lifecycle to reach "closing" (the exit-animation class),
 * then fire the `animationend` jsdom never dispatches on its own, and wait
 * for the resulting unmount — the same three-beat shape `ActivityDrawer`'s
 * real CSS/JS lifecycle goes through.
 */
async function waitForClose() {
  await waitFor(() =>
    expect(screen.getByRole("dialog").className).toMatch(/anim-slide-exit/),
  );
  fireEvent.animationEnd(screen.getByRole("dialog"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

describe("ProfileDrawer — layout + prefill", () => {
  it("renders nothing when closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pre-fills all 8 fields from the saved records and shows the drawer chrome", () => {
    render(<Harness initialOpen />);
    const d = dialog();

    expect(d.querySelector("#your-name")).toHaveValue("Alex");
    expect(screen.getByRole("radio", { name: "Male" })).toBeChecked();
    expect(screen.getByLabelText("Age", { exact: false })).toHaveValue("28");
    expect(screen.getByRole("radio", { name: "Metric" })).toBeChecked();
    expect(
      screen.getByLabelText("Bodyweight (kg)", { exact: false }),
    ).toHaveValue("80");
    expect(screen.getByRole("radio", { name: "Strength" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("lays out daysPerWeek as a two-column radiogroup of 1..7", () => {
    render(<Harness initialOpen />);
    const days = screen.getByRole("radiogroup", {
      name: "Training days per week",
    });
    expect(days.className).toContain("grid-cols-2");
    for (const n of ["1", "2", "3", "4", "5", "6", "7"]) {
      expect(screen.getByRole("radio", { name: n })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "4" })).toBeChecked();
  });
});

describe("ProfileDrawer — editing + save", () => {
  it("blocks save on invalid input, surfaces the error, and stays open", async () => {
    render(<Harness initialOpen />);
    fireEvent.change(
      screen.getByLabelText("Bodyweight (kg)", { exact: false }),
      { target: { value: "" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/enter your bodyweight/i)).toBeVisible();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("moves focus to the first invalid field on a blocked save", async () => {
    render(<Harness initialOpen />);
    const bodyweight = screen.getByLabelText("Bodyweight (kg)", {
      exact: false,
    });
    fireEvent.change(bodyweight, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(bodyweight).toHaveFocus());
  });

  it("a valid Save closes the drawer", async () => {
    render(<Harness initialOpen />);
    fireEvent.change(screen.getByLabelText("Your name", { exact: false }), {
      target: { value: "Sam" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitForClose();
  });
});

describe("ProfileDrawer — discard affordances", () => {
  it("the X button closes the drawer", async () => {
    render(<Harness initialOpen />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitForClose();
  });

  it("a backdrop click closes the drawer", async () => {
    render(<Harness initialOpen />);
    fireEvent.click(screen.getByTestId("profile-drawer-backdrop"));
    await waitForClose();
  });

  it("Escape closes the drawer", async () => {
    render(<Harness initialOpen />);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitForClose();
  });

  it("a short swipe snaps back; a swipe past the threshold closes", async () => {
    render(<Harness initialOpen />);
    const panel = screen.getByRole("dialog");

    fireEvent.touchStart(panel, { touches: [{ clientX: 10, clientY: 100 }] });
    fireEvent.touchMove(panel, { touches: [{ clientX: 40, clientY: 100 }] });
    fireEvent.touchEnd(panel);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.touchStart(panel, { touches: [{ clientX: 10, clientY: 100 }] });
    fireEvent.touchMove(panel, { touches: [{ clientX: 220, clientY: 100 }] });
    fireEvent.touchEnd(panel);

    await waitForClose();
  });

  it("reopening after a discard shows saved values, not the discarded edit", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Your name", { exact: false }), {
      target: { value: "Temp" },
    });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitForClose();

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    expect(screen.getByLabelText("Your name", { exact: false })).toHaveValue(
      "Alex",
    );
  });
});

describe("ProfileDrawer — focus", () => {
  it("moves focus in on mount and returns it to the trigger on close", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Edit profile" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitForClose();
    expect(trigger).toHaveFocus();
  });

  it("traps Tab within the panel (Close is first, Save is last)", () => {
    render(<Harness initialOpen />);
    const closeButton = screen.getByRole("button", { name: "Close" });
    const saveButton = screen.getByRole("button", { name: "Save" });

    saveButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(saveButton).toHaveFocus();
  });
});
