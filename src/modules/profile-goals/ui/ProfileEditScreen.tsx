"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useTranslation } from "@/shared/i18n";
import { BackLink } from "@/shared/ui/components/BackLink";
import { AppShell } from "@/shared/ui/layout/AppShell";
import { Button } from "@/shared/ui/primitives/Button";
import { ChoiceGroup } from "@/shared/ui/primitives/ChoiceGroup";
import { Input } from "@/shared/ui/primitives/Input";
import type { FieldName, OnboardingField } from "../logic/useOnboarding";
import { useProfileEditor } from "../logic/useProfileEditor";
import type { Goals, Profile } from "../types";

export interface ProfileEditScreenProps {
  profile: Profile;
  goals: Goals | null;
}

/** Fields long enough (or multi-row enough) to want the full grid width. */
const FULL_WIDTH: ReadonlySet<FieldName> = new Set([
  "displayName",
  "gender",
  "focus",
  "daysPerWeek",
]);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Renders one field via the OnboardingForm field->atom mapping, moved
 * verbatim from the deleted `ProfileDrawer` (design.md — "Field→atom
 * mapping is the drawer's `Field` switch, moved verbatim"). The one
 * deliberate deviation: `daysPerWeek` uses `ChoiceGroup`'s two-column
 * `"grid"` layout instead of onboarding's `CountStepper`.
 */
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
          <ChoiceGroup
            label={field.label}
            options={options}
            value={field.value}
            onChange={onChange}
            required={field.required}
            error={field.error}
            layout="grid"
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

/**
 * `/profile/edit` (design.md D1, D2, D9) — the same 8-field form the deleted
 * drawer rendered, now a full page. Discarding abandoned edits is a route
 * unmount, not an explicit `reset()` call (D2): navigating away and back
 * re-seeds `useProfileEditor` from the freshly live-queried records.
 *
 * Save (D2): `save()` resolves before `router.push("/profile")`, so there is
 * no window where a navigation could race a write. On a blocked save, the
 * drawer's exact error-focus behaviour is kept verbatim — wait a frame, then
 * focus + `scrollIntoView` the first `[role="alert"]` field.
 */
export function ProfileEditScreen({ profile, goals }: ProfileEditScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const editor = useProfileEditor(profile, goals);
  const formRef = useRef<HTMLDivElement>(null);

  async function handleSave() {
    if (editor.phase === "saving") return;
    const saved = await editor.save();
    if (saved) {
      router.push("/profile");
      return;
    }
    requestAnimationFrame(() => {
      const errorText =
        formRef.current?.querySelector<HTMLElement>('[role="alert"]');
      const fieldWrapper = errorText?.parentElement;
      const focusable = fieldWrapper?.querySelector<HTMLElement>(
        'input, [role="radio"][tabindex="0"]',
      );
      focusable?.focus();
      // jsdom (unit tests) has no `scrollIntoView` implementation at all.
      (fieldWrapper ?? errorText)?.scrollIntoView?.({
        block: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  }

  return (
    <AppShell title={t("profile.edit.title")}>
      <div className="flex items-center gap-[var(--space-4)]">
        <BackLink href="/profile" />
        <h2 className="text-micro text-text-muted">
          {t("profile.edit.title")}
        </h2>
      </div>

      <div ref={formRef} className="flex flex-1 flex-col gap-[var(--space-7)]">
        <div className="grid grid-cols-2 gap-x-[var(--space-4)] gap-y-[var(--space-6)]">
          {editor.fields.map((field) => (
            <div
              key={field.name}
              className={FULL_WIDTH.has(field.name) ? "col-span-2" : ""}
            >
              <Field
                field={field}
                onChange={(value) => editor.setField(field.name, value)}
              />
            </div>
          ))}
        </div>

        {editor.phase === "error" && editor.saveError && (
          <p role="alert" className="text-caption text-danger-text">
            {t("profile.edit.error")}
          </p>
        )}
      </div>

      <Button size="lg" fullWidth onClick={() => void handleSave()}>
        {editor.phase === "saving"
          ? t("profile.edit.saving")
          : t("profile.edit.save")}
      </Button>
    </AppShell>
  );
}
