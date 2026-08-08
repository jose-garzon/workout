"use client";

import { useId } from "react";
import { type TranslationKey, useTranslation } from "@/shared/i18n";
import { useInstallPrompt } from "@/shared/ui/install/useInstallPrompt";
import { Button } from "@/shared/ui/primitives/Button";

/**
 * The home-only install invitation (pwa-install-banner design.md §D7).
 * Consumes `useInstallPrompt()` and nothing else — no `navigator`, no
 * `matchMedia`, no event listeners live here; detection is the engineer's.
 *
 * `status === "hidden"` covers BOTH "already installed" and "not yet
 * detected" (design §D2) — rendering `null` for both is correct: there is
 * nothing honest to show before detection settles, so this is not a loading
 * state that needs a skeleton (design-system.md §2 "The four states").
 *
 * Uses `aria-labelledby` pointing at the title `<p>` rather than a duplicate
 * `aria-label` with the same string — one accessible name, not the same text
 * announced twice — while still satisfying "a `<section>` needs an
 * accessible name to expose the `region` role" (design §D7's requirement,
 * and what `e2e/install-banner.spec.ts` locates by).
 */
const DESCRIPTION_KEYS: Record<"native" | "ios" | "manual", TranslationKey> = {
  native: "install.description.native",
  ios: "install.description.ios",
  manual: "install.description.manual",
};

export function InstallBanner() {
  const { t } = useTranslation();
  const { status, promptInstall } = useInstallPrompt();
  const titleId = useId();

  if (status === "hidden") return null;

  return (
    <section
      aria-labelledby={titleId}
      className="anim-fade flex items-center gap-[var(--space-4)] border border-accent-text bg-accent-wash px-[var(--space-4)] py-[var(--space-3)]"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-1)]">
        <p id={titleId} className="text-body-strong text-accent-text">
          {t("install.title")}
        </p>
        <p className="text-caption text-text-muted">
          {t(DESCRIPTION_KEYS[status])}
        </p>
      </div>
      {status === "native" && (
        <div className="shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void promptInstall()}
          >
            {t("install.cta")}
          </Button>
        </div>
      )}
    </section>
  );
}
