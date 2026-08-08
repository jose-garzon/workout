"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRoutineEdit } from "@/modules/routine-generation";
import { type TranslationKey, useTranslation } from "@/shared/i18n";
import { GoalBadge } from "@/shared/ui/components/GoalBadge";
import { InstallBanner } from "@/shared/ui/components/InstallBanner";
import { AppShell } from "@/shared/ui/layout/AppShell";
import { Button } from "@/shared/ui/primitives/Button";
import { useActiveRoutine } from "../logic/useActiveRoutine";
import { useDayCycle } from "../logic/useDayCycle";
import { useRoutineGeneration } from "../logic/useRoutineGeneration";
import { BuildingIndicator } from "./BuildingIndicator";
import { Composer } from "./Composer";
import { RoutineEditor } from "./RoutineEditor";
import { RoutineSummary } from "./RoutineSummary";

/**
 * Home (design.md §D1) — the routine dashboard + AI composer. Owned by
 * routine-generation; the user's identity (name, goal, and the profile context
 * the generator needs) arrives as props from the app composition layer, because
 * a feature's `ui/` may not import another feature (firewall rule 1).
 *
 * Adopt (§D5): the FIRST routine adopts frictionlessly — an effect calls
 * `confirmSave()` the moment a result is held and no routine yet exists. Once
 * a routine exists, the build composer is hidden entirely (edit-routine
 * design.md §F, BREAKING) — editing (`RoutineEditor`, below) is the single
 * post-creation path, so there is no longer a "replace" case to confirm.
 */
export interface RoutineHomeScreenProps {
  displayName?: string;
  /** The user's training goal (drives the badge + the generator). */
  focus: string;
  daysPerWeek: number;
  /**
   * Profile context handed to the generator so the routine fits the user (the
   * app composition layer supplies these from the loaded profile/goals — a
   * feature's ui/ may not read another feature). All fold into the AI prompt;
   * none are rendered.
   */
  gender: string;
  age: number;
  bodyweightKg?: number;
  heightCm?: number;
  unit: "metric" | "imperial";
  notes?: string;
  /**
   * The consistency week strip (calendar feature), supplied by the app
   * composition layer — a feature's `ui/` may not import another feature
   * (firewall rule 1), so `RoutineHomeScreen` never names `calendar` itself
   * and just renders whatever node it's handed (design.md §1).
   */
  weekStrip?: ReactNode;
  /**
   * The on-device summary of recent completed-session history
   * (routine-edit-history design.md §Decision 4) — a plain `string | null`
   * supplied by the app composition layer (same pattern as `weekStrip`), never
   * read from `workout-mode` directly (firewall rule 1). Forwarded untouched to
   * `RoutineEditor`, which hands it to the edit `submit`.
   */
  sessionSummary?: string | null;
}

/** Human, specific copy per AI failure — never a raw technical string. */
const ERROR_MESSAGE_KEYS: Record<string, TranslationKey> = {
  offline: "error.build.offline",
  network: "error.build.network",
  "rate-limit": "error.build.rateLimit",
  parse: "error.build.parse",
  provider: "error.build.provider",
};

export function RoutineHomeScreen({
  displayName,
  focus,
  daysPerWeek,
  gender,
  age,
  bodyweightKg,
  heightCm,
  unit,
  notes,
  weekStrip,
  sessionSummary,
}: RoutineHomeScreenProps) {
  const { t } = useTranslation();
  const { routine: active } = useActiveRoutine();
  // The day list, pre-ordered with `next` first (highlight-next-workout-day
  // design.md §D3) — the summary renders these and does no math of its own.
  const { days } = useDayCycle();
  const { status, progressMessage, error, generate, confirmSave, reset } =
    useRoutineGeneration();
  // The composer is remounted (via `composerKey`) whenever the example
  // prompt is tapped, so its uncontrolled text field starts pre-filled —
  // see the `Composer.initialValue` doc comment for why a remount, not a
  // controlled prop, is the clean way to do a one-shot external prefill.
  const [prefill, setPrefill] = useState("");
  const [composerKey, setComposerKey] = useState(0);
  const thinkingLogRef = useRef<HTMLDivElement>(null);
  // The floating editor's open/closed state is local UI state, not part of
  // the `useRoutineEdit` seam (edit-routine design.md §E). `editButtonRef`
  // lets the (non-modal) editor return focus to the button that opened it —
  // the button lives in `RoutineSummary`, a sibling, not inside the editor.
  const [editorOpen, setEditorOpen] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  // Read only for the background-block below — `RoutineEditor` owns the
  // actual `submit`/`reset` calls. While an edit is in flight the rest of
  // the screen must stop being reachable by pointer/keyboard/AT (extension
  // to design.md §F); idle/success/error all restore it, so only
  // `"editing"` counts as busy — an error must stay retriable/dismissible.
  const { status: editStatus } = useRoutineEdit();
  const editBusy = editStatus === "editing";

  const name = displayName?.trim() || t("home.greeting.fallbackName");
  const generating = status === "generating";

  // First routine adopts frictionlessly (§D5): once a result is held and no
  // routine exists yet, persist it immediately — no extra confirm step.
  useEffect(() => {
    if (status === "ready" && active === null) {
      void confirmSave();
    }
  }, [status, active, confirmSave]);

  const onSubmit = (prompt: string) => {
    void generate(prompt, {
      focus,
      daysPerWeek,
      gender,
      age,
      bodyweightKg,
      heightCm,
      unit,
      notes,
    });
  };

  const useExamplePrompt = () => {
    setPrefill(t("home.example.prompt"));
    setComposerKey((key) => key + 1);
  };

  // Keep the thinking log pinned to its newest line as `progressMessage`
  // streams in — without this the log stays scrolled to the top (its
  // initial, empty scroll position) and the latest reasoning sits hidden
  // below the fold. The div itself stays the live region (aria-live is on
  // the element, not this effect) — this only moves the scroll position, a
  // presentation detail AT already gets via the live-region announcement.
  // biome-ignore lint/correctness/useExhaustiveDependencies: progressMessage is the intentional re-run trigger even though the effect body reads it only via the DOM, not directly.
  useEffect(() => {
    const el = thinkingLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [progressMessage]);

  const motivation = active
    ? (active.subtitle ?? t("home.motivation.ready"))
    : t("home.motivation.default");

  return (
    <>
      <AppShell title={t("home.title")} inert={editBusy}>
        <InstallBanner />

        {/* Identity block: greeting + goal + motivational line. `AppShell`'s
          own `<h1>{title}</h1>` is `sr-only` (the header shows only the Logo
          + profile link), so this `<h2>` is the screen's one VISIBLE
          heading. Editing the profile now lives on its own page, reached
          via the header's profile link (profile-page design.md) — home no
          longer renders an edit affordance of its own. */}
        <div className="flex flex-col gap-[var(--space-3)]">
          <h2 className="text-title-1">{t("home.greeting", { name })}</h2>
          <GoalBadge focus={focus} />
          <p className="text-body text-text-muted">{motivation}</p>
        </div>

        {weekStrip}

        {/* This is the only flex-growing region in the layout, so it always
          absorbs exactly the leftover space between the identity block above
          and the composer dock below — on a short state (the empty invite,
          or a routine with one day) that CENTERS the content in the middle
          of that band instead of top-hugging it and leaving one big dead gap
          stacked above the composer (the same fix already applied to
          `OnboardingForm`'s short steps). The composer dock's own position
          is unaffected: it was already flush to the bottom via this sibling
          absorbing the remainder, not via its own margin, so it never moves. */}
        <div className="flex flex-1 flex-col justify-center">
          {active ? (
            <RoutineSummary
              routine={active}
              days={days}
              onEdit={() => setEditorOpen(true)}
              editButtonRef={editButtonRef}
            />
          ) : status === "idle" ? (
            <div className="flex flex-col gap-[var(--space-4)]">
              <p className="text-body text-text-muted">
                {t("home.empty.hint")}
              </p>
              <button
                type="button"
                onClick={useExamplePrompt}
                className="anim-press flex flex-col items-start gap-[var(--space-2)] border border-border bg-surface px-[var(--space-5)] py-[var(--space-4)] text-left transition-colors hover:border-text hover:bg-elevated-surface"
              >
                <span className="text-micro text-accent-text">
                  {t("home.example.try")}
                </span>
                <span className="text-body text-text">
                  “{t("home.example.prompt")}”
                </span>
              </button>
            </div>
          ) : null}
        </div>

        {/* Build composer + its status UI only apply before a routine exists
          (AC1.2, edit-routine design.md §F, BREAKING) — once one exists,
          editing via `RoutineEditor` below is the single post-creation path. */}
        {!active && (
          <div className="flex flex-col gap-[var(--space-3)] pt-[var(--space-8)]">
            {generating && <BuildingIndicator />}

            {progressMessage !== "" && (
              <div
                ref={thinkingLogRef}
                role="log"
                aria-live="polite"
                aria-label={t("home.thinking.label")}
                className="max-h-[var(--space-11)] overflow-y-auto border-l-2 border-border pl-[var(--space-4)]"
              >
                <p className="text-caption text-text-muted">
                  {progressMessage}
                </p>
              </div>
            )}

            {status === "error" && error && (
              <div
                role="alert"
                className="flex items-center justify-between gap-[var(--space-4)] border border-danger px-[var(--space-4)] py-[var(--space-3)]"
              >
                <p className="text-caption text-danger-text">
                  {t(ERROR_MESSAGE_KEYS[error.kind] ?? "error.build.provider")}
                </p>
                <Button size="sm" variant="secondary" onClick={reset}>
                  {t("error.build.dismiss")}
                </Button>
              </div>
            )}

            <Composer
              key={composerKey}
              initialValue={prefill}
              focusOnMount={prefill !== ""}
              onSubmit={onSubmit}
              busy={generating}
            />
          </div>
        )}
      </AppShell>

      {/* A SIBLING of `AppShell`, never a child — `AppShell`'s `inert` prop
          above disables its entire subtree while `editBusy`, and the editor
          itself must stay reachable throughout (design.md §F extension). */}
      <RoutineEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editButtonRef={editButtonRef}
        sessionSummary={sessionSummary}
      />
    </>
  );
}
