import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OnboardingApi, OnboardingField } from "../logic/useOnboarding";
import { OnboardingForm } from "./OnboardingForm";

/**
 * Light UI tests (design.md §6 "Form UI (light)", tasks.md D9). These render
 * `OnboardingForm` against a hand-built `OnboardingApi` test double rather
 * than the real `useOnboarding` hook — the form is deliberately a pure
 * renderer of its `onboarding` prop (design.md §3.1), so its own rendering
 * contract is fully testable without the engineer's hook landed yet. Only
 * `import type` is used from `../logic/useOnboarding` (type-only, erased at
 * build time), so this file has no runtime dependency on that module.
 *
 * `vitest.config.ts` does not set `test.globals`, so RTL's automatic
 * post-test cleanup (which detects a global `afterEach`) never registers —
 * without an explicit `afterEach(cleanup)` every test after the first would
 * render into a document still holding the previous test's markup.
 */
afterEach(cleanup);

function makeApi(overrides: Partial<OnboardingApi> = {}): OnboardingApi {
  return {
    stepIndex: 0,
    stepCount: 3,
    stepTitle: "About you",
    fields: [],
    setField: vi.fn(),
    canGoBack: false,
    back: vi.fn(),
    isLastStep: false,
    canAdvance: true,
    next: vi.fn(),
    phase: "editing",
    submitError: null,
    finish: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function textField(overrides: Partial<OnboardingField> = {}): OnboardingField {
  return {
    name: "displayName",
    kind: "text",
    label: "Display name",
    value: "",
    required: true,
    error: null,
    ...overrides,
  };
}

function numberField(
  overrides: Partial<OnboardingField> = {},
): OnboardingField {
  return {
    name: "bodyweight",
    kind: "number",
    label: "Bodyweight (kg)",
    value: "",
    required: true,
    error: null,
    suffix: "kg",
    ...overrides,
  };
}

describe("OnboardingForm", () => {
  it("preserves entered values and calls back() when Back is activated", () => {
    const api = makeApi({
      stepIndex: 1,
      canGoBack: true,
      fields: [numberField({ value: "82", label: "Bodyweight (kg)" })],
    });

    render(<OnboardingForm onboarding={api} />);

    // Value already entered on this step stays visible when the step re-renders.
    expect(
      screen.getByLabelText("Bodyweight (kg)", { exact: false }),
    ).toHaveValue("82");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(api.back).toHaveBeenCalledTimes(1);
  });

  it("indicates the offending field and still lets Continue be activated when blocked", () => {
    const api = makeApi({
      fields: [
        textField({
          value: "",
          error: "Display name is required.",
        }),
      ],
    });

    render(<OnboardingForm onboarding={api} />);

    const input = screen.getByLabelText("Display name", { exact: false });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Display name is required.")).toBeInTheDocument();

    // Continue is always activatable — next() itself decides whether the
    // step advances (design.md §3.1: next() never throws, it never blocks
    // the button).
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(api.next).toHaveBeenCalledTimes(1);
  });

  it("relabels the body inputs when the field arrives with imperial labels", () => {
    const api = makeApi({
      fields: [
        numberField({
          name: "bodyweight",
          label: "Bodyweight (lb)",
          suffix: "lb",
          value: "180",
        }),
      ],
    });

    render(<OnboardingForm onboarding={api} />);

    expect(
      screen.getByLabelText("Bodyweight (lb)", { exact: false }),
    ).toHaveValue("180");
    expect(screen.getByText("lb")).toBeInTheDocument();
  });

  it("shows the step tracker as Step X of 3", () => {
    const api = makeApi({ stepIndex: 1, stepCount: 3 });

    render(<OnboardingForm onboarding={api} />);

    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
  });
});
