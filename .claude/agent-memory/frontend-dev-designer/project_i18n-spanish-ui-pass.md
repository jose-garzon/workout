---
name: project-i18n-spanish-ui-pass
description: i18n-spanish-support change — UI-side status, key-reuse decisions, and the pre-existing-failure verification trick used to close it out
metadata:
  type: project
---

Completed 2026-08-04: designer half of `openspec/changes/i18n-spanish-support/` — moved every UI-owned string in `shared/ui` primitives, `profile-goals`, `routine-generation`, `workout-mode`, `calendar` behind `useTranslation()`/`t()` from `@/shared/i18n` (substrate + AI-path language plumbing were already done by the engineer). All gates green: typecheck, biome check, depcruise, full Vitest (284/284), Playwright `spanish` project, `chromium` unaffected.

**Why:** browser-language auto-detection (`es-*` → Spanish, else English), no selector UI — see design.md for the full decision log (flat dot-namespaced keys in `en.json`/`es.json`, `KEY_PARITY` compile-time check, `t(key, vars?)` interpolation).

**How to apply / reusable patterns for the next i18n or copy-extraction pass:**
- Cross-feature key reuse is fine and was done deliberately twice: `onboarding.step.indicator` (seeded by the engineer for `profile-goals`) is the actual copy for the shared `Stepper` primitive's "Step N of M" text — no duplicate `common.*` key. Likewise `routine.summary.exercises.one/other` ("1 exercise"/"{count} exercises") is reused verbatim by `workout-mode`'s `SessionOverview`. When two screens say literally the same English sentence, one key is correct; don't manufacture per-feature duplicates just to match the namespace-per-folder convention.
- Cycling-verb copy (`BuildingIndicator`/`EditIndicator`'s rotating "Building…/Programming…/Forging…" flavor text) needs a translation key **per verb**, not a single interpolated string, because the Spanish verb list isn't a 1:1 translation of the English one (different words feel natural in each language for the same concept). Pattern: `VERB_KEYS: TranslationKey[]` array of per-word keys + one shared `"{verb} your routine…"` template key, `t(template, { verb: t(VERB_KEYS[i]) })`.
- A key like `onboarding.step.indicator` or `home.greeting` that was seeded by the engineer purely as a `translate.test.ts` interpolation fixture (task 1.4: "one interpolated, one with two placeholders") turned out to double as real production copy once the matching screen was translated — check `translate.test.ts` for what's already seeded before inventing a new key with the same shape.
- [[feedback-verify-pre-existing-failure-claims]]
