"use client";

import { Button } from "@/shared/ui/primitives/Button";
import { ChoiceGroup } from "@/shared/ui/primitives/ChoiceGroup";
import { CountStepper } from "@/shared/ui/primitives/CountStepper";
import { Input } from "@/shared/ui/primitives/Input";
import { Stepper } from "@/shared/ui/primitives/Stepper";
import type { OnboardingApi, OnboardingField } from "../logic/useOnboarding";

export interface OnboardingFormProps {
  onboarding: OnboardingApi;
}

/**
 * PURE rendering of `useOnboarding`'s `fields[]` (design.md §3.1) — maps
 * `field.kind` to a `shared/ui` atom and wires `setField`/`back`/`next`/
 * `finish`. Never hard-codes a label, an option, or which field belongs on
 * which step — all of that arrives in `fields`.
 *
 * `Continue`/`Finish` is never disabled while `editing`: the contract is
 * "activating continue on an invalid step does not advance and indicates
 * the field" (spec: profile-setup-form), not "the button is unavailable
 * until valid" — `next()` handles that gating internally and never throws.
 */
export function OnboardingForm({ onboarding }: OnboardingFormProps) {
  const {
    stepIndex,
    stepCount,
    stepTitle,
    fields,
    setField,
    canGoBack,
    back,
    isLastStep,
    next,
    phase,
    submitError,
    finish,
  } = onboarding;

  const handlePrimary = () => {
    if (isLastStep) {
      // finish() drives the FirstRunGate -> home-slot swap reactively
      // (design.md §4.3) — no navigation call, and nothing here may set
      // state after the await, since this form can unmount mid-flight.
      void finish();
      return;
    }
    next();
  };

  const submitting = phase === "submitting";

  return (
    <div className="flex flex-1 flex-col gap-[var(--space-7)]">
      {/* The step heading + Stepper stay fixed directly under the header on
          every step — neither participates in the centering below, so
          they never move. `AppShell`'s own `<h1>{title}</h1>` is
          `sr-only` (the header now shows only the Logo + theme toggle), so
          this `<h2>` is the screen's only VISIBLE heading — it carries the
          same text (`stepTitle`) at the same `title-1` weight the header
          used to show, just relocated into the body. `Stepper` itself
          stays plain "Step N of M" (no `label`) to avoid repeating the
          title twice back to back. */}
      <div className="flex flex-col gap-[var(--space-4)]">
        <h2 className="text-title-1">{stepTitle}</h2>
        <Stepper current={stepIndex + 1} total={stepCount} />
      </div>

      {/* This region is the ONLY flex-growing child, so it always absorbs
          exactly the leftover space between the Stepper above and the CTA
          block below — on a short step (e.g. 2 short inputs) that centers
          the field cluster in the middle of that band instead of leaving
          one big gap stacked above the CTA; on a full step the cluster
          fills most of the band anyway, so it looks unchanged. Either way
          the CTA's own position is untouched: it was already flush to the
          bottom via this sibling absorbing the remainder, not via its own
          margin, so it never shifts between steps. */}
      <div className="flex flex-1 flex-col justify-center">
        <div
          key={stepIndex}
          className="anim-rise flex flex-col gap-[var(--space-6)]"
        >
          {fields.map((field) => (
            <Field
              key={field.name}
              field={field}
              onChange={(value) => setField(field.name, value)}
            />
          ))}
        </div>
      </div>

      {phase === "error" && submitError && (
        <p className="text-caption text-danger-text" role="alert">
          Couldn't save your details. Tap Finish to try again.
        </p>
      )}

      <div className="flex flex-col gap-[var(--space-4)]">
        <Button
          size="lg"
          fullWidth
          onClick={handlePrimary}
          disabled={submitting}
        >
          {isLastStep ? (submitting ? "Saving…" : "Finish") : "Continue"}
        </Button>
        {canGoBack && (
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={back}
            disabled={submitting}
          >
            Back
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  field,
  onChange,
}: {
  field: OnboardingField;
  onChange: (value: string) => void;
}) {
  switch (field.kind) {
    case "text":
      return (
        <Input
          label={field.label}
          value={field.value}
          onChange={onChange}
          required={field.required}
          error={field.error}
          placeholder={field.placeholder}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          label={field.label}
          value={field.value}
          onChange={onChange}
          required={field.required}
          error={field.error}
          placeholder={field.placeholder}
          suffix={field.suffix}
        />
      );
    case "choice": {
      const options = field.options ?? [];
      if (field.name === "daysPerWeek") {
        return (
          <CountStepper
            label={field.label}
            options={options}
            value={field.value}
            onChange={onChange}
            required={field.required}
            error={field.error}
          />
        );
      }
      return (
        <ChoiceGroup
          label={field.label}
          options={options}
          value={field.value}
          onChange={onChange}
          required={field.required}
          error={field.error}
          layout={options.length <= 2 ? "segmented" : "stack"}
        />
      );
    }
    default:
      return null;
  }
}
