# Tasks — i18n-spanish-support

Follows `design.md` §Migration Plan. Step 2 (CLAUDE.md + config.yaml rule-1 prose)
is **already done** and is not repeated here.

Two standing rules for every extraction task below:

- **Every key added to `en.json` is added to `es.json` in the same commit.**
  `KEY_PARITY` + the pre-commit typecheck (task 1.6) will block the commit
  otherwise — this is enforcement, not etiquette.
- **Seam discipline (design §Decision 3):** React components use
  `useTranslation()`; `logic/`, `api/` and pure modules import `t` directly.

## 1. i18n substrate (engineer)

- [x] 1.1 Create `src/shared/i18n/translate.ts` — `Language`, `resolveLanguage`, memoised `activeLanguage`, `setActiveLanguage`, `en`/`es` JSON imports, `TranslationKey`, `KEY_PARITY`, `DICTIONARIES`, and `t(key, vars?)` (design §Decision 1, §Decision 2, §Decision 4)
- [x] 1.2 Create `src/shared/i18n/useTranslation.ts` — `"use client"`, returns `{ t, language }`
- [x] 1.3 Create `src/shared/i18n/index.ts` — the public barrel; nothing outside `shared/i18n` imports the inner files
- [x] 1.4 Seed `en.json` + `es.json` with a handful of keys including one interpolated (`{name}`) and one with two placeholders, to prove the pipeline end to end
- [x] 1.5 Write `src/shared/i18n/translate.test.ts` — `resolveLanguage` for `es-ES`/`es`/`ES-es`/`en-US`/`fr-FR`/`undefined`; interpolation (single, repeated, multiple, unprovided var left as `{token}`); missing-key → English fallback; runtime key parity + no empty values
- [x] 1.6 Add `"typecheck": "tsc --noEmit"` to `package.json` and append `bun run typecheck` to `.husky/pre-commit`
- [x] 1.7 Add the document-language line to the inline `<head>` script in `app/layout.tsx`, with a cross-reference comment there and in `translate.ts` naming the duplicated `es`-prefix rule (same pattern as `"wp.theme"`)
- [x] 1.8 **Gate:** `bun run typecheck` and `translate.test.ts` green

## 2. Language on the AI path (engineer)

- [x] 2.1 `api/ai/prompt.ts` — add local `type Language = "en" | "es"`, `LANGUAGE_NAMES`, `languageDirective()`; append the directive **last**, after `EXAMPLE`, pinning JSON keys to English (design §Decision 5)
- [x] 2.2 `api/ai/prompt.ts` — add a **required** `language` param to `buildRoutinePrompt(userPrompt, ctx, language)` and `buildEditPrompt(instruction, routine, language, sessionSummary?)` (before the optional param)
- [x] 2.3 `api/ai/openrouter.ts` — narrow `body.language` to `"en" | "es"` defaulting to `"en"` in both `parseBuildBody` and `parseEditBody`, and thread it into the prompt builders
- [x] 2.4 `api/ai/client.ts` — `postToProxy` adds `language: activeLanguage()` to every body (build **and** edit); hook and UI signatures unchanged
- [x] 2.5 Update `prompt.test.ts` and `openrouter.test.ts` for the new signatures, the directive, and the missing-`language` → `"en"` default
- [x] 2.6 Update `generation.integration.test.tsx` + `edit.integration.test.tsx` — MSW asserts `language` on both request bodies: `"en"` by default, `"es"` under `setActiveLanguage("es")`
- [x] 2.7 **Gate:** full Vitest suite green; `bun run check` and `bunx depcruise src` green (firewall rule 4 must be unchanged)

## 3. Server-render boundary fix (designer)

- [x] 3.1 Move `<AppShell>` out of `WorkoutModeScreen.tsx` and into `WorkoutModeBody.tsx` (inside the `ssr:false` chunk); the `loading` fallback becomes a bare `<Skeleton />` (design §Decision 4)
- [x] 3.2 Update `workoutMode.test.tsx` and any workout-mode e2e assertion that depends on the header being present during chunk load
- [x] 3.3 **Gate:** `/workout/[dayId]` server-renders no user-visible copy; workout-mode tests green

## 4. shared/ui copy (designer)

- [x] 4.1 `ThemeToggle.tsx` — "Dark"/"Light" and both `aria-label` variants → `common.theme.*`
- [x] 4.2 `ComingSoon.tsx`, `ErrorBoundary.tsx`, and any `Logo`/`Skeleton` accessible labels → `common.*` (none needed: `ComingSoon` takes `title`/`description` as props from its caller and is currently unused; `ErrorBoundary` renders no copy of its own; `Logo` and `Skeleton` are `aria-hidden` with no accessible text)
- [x] 4.3 Primitive labels/messages in `Button`, `Input`, `ChoiceGroup`, `CountStepper`, `Stepper` → `common.*` (`Button`, `Input`, `ChoiceGroup` take all copy as props — nothing hardcoded; `CountStepper`'s Decrease/Increase `aria-label`s → `common.stepper.*`; `Stepper`'s "Step {current} of {total}" reuses the already-seeded `onboarding.step.indicator` key rather than duplicating it under `common.*`)
- [x] 4.4 Add every `common.*` key to `en.json` **and** `es.json`
- [x] 4.5 Update affected `shared/ui` tests to assert via `t(...)` (no dedicated `shared/ui` test files exist; the only tests exercising this copy are profile-goals tests, updated in 5.4)
- [x] 4.6 **Gate:** `bun run typecheck` + Vitest green

## 5. profile-goals copy

- [x] 5.1 (engineer) `logic/model.ts` → `t()`: the four `STEP_TITLES`, `fieldLabel`, the gender/units/focus choice labels, and **every validation message**; the unit-aware bodyweight label becomes `t("onboarding.field.bodyweight", { unit })` (design §Context). `OnboardingApi`/`OnboardingField` shapes do not change. Keys into both dictionaries
- [x] 5.2 (engineer) Update `logic/model.test.ts` and `logic/useProfileEditor.test.tsx` to assert via `t(...)`
- [x] 5.3 (designer) `ui/` → `useTranslation()`: `WelcomeFlow`, `OnboardingForm`, `ProfileDrawer`, `FirstRunGate`. **`Splash` stays as-is** — `workout-pal` is the brand name, not copy. Keys (`welcome.*`, `onboarding.*`, `profile.*`) into both dictionaries (`FirstRunGate` itself renders no static copy — nothing to change there)
- [x] 5.4 (designer) Update `OnboardingForm.test.tsx`, `ProfileDrawer.test.tsx`, `firstRunGate.integration.test.tsx` to assert via `t(...)`
- [x] 5.5 **Gate:** `bun run typecheck` + Vitest green

## 6. routine-generation copy

- [x] 6.1 (engineer) `logic/useRoutineEdit.ts` — `editErrorMessage(AiError)` → `t("error.edit.*")`; keys into both dictionaries
- [x] 6.2 (engineer) Update `edit.integration.test.tsx` to assert the error copy via `t(...)`
- [x] 6.3 (designer) `ui/` → `useTranslation()`: `RoutineHomeScreen` (**including its `AiError` → message map** → `error.build.*`), `Composer`, `RoutineSummary`, `RoutineEditor`, `BuildingIndicator`, `EditIndicator`. Keys (`home.*`, `composer.*`, `routine.*`, `editor.*`, `error.build.*`) into both dictionaries
- [x] 6.4 (designer) Update `routineHome.integration.test.tsx` and `generation.integration.test.tsx` to assert via `t(...)` (`generation.integration.test.tsx` asserts only data/store values, no rendered UI copy — no changes needed there)
- [x] 6.5 **Gate:** `bun run typecheck` + Vitest green

## 7. workout-mode copy (designer)

- [x] 7.1 `ui/` → `useTranslation()`: `WorkoutModeBody` (incl. the `AppShell` title moved in task 3.1), `SessionOverview`, `ExerciseView`, `Stopwatch`, `SuccessView` (incl. the difficulty/fatigue rating labels), and the rest-default label. Keys (`workout.*`) into both dictionaries
- [x] 7.2 Confirm `logic/summary.ts` **stays English** — it is AI prompt context, not user-visible copy, and translating it would change what the model reads
- [x] 7.3 Update `workoutMode.test.tsx`, `workoutSession.integration.test.tsx`, `sessionSummary.integration.test.tsx` to assert via `t(...)` (the latter two exercise `logic/` only and render no copy — no changes needed there)
- [x] 7.4 **Gate:** `bun run typecheck` + Vitest green

## 8. calendar copy

- [x] 8.1 (engineer) `logic/model.ts` — replace `WEEKDAYS`/`MONTHS_FULL` with `WEEKDAY_KEYS` (indexed by `Date#getDay()`) and `MONTH_KEYS`, resolved through `t`; `dayLabel`, `monthName` and `buildWeek` signatures unchanged (design §Decision 6). 19 keys × 2 dictionaries
- [x] 8.2 (engineer) Update `logic/model.test.ts` and `logic/useCalendar.test.tsx` — assert via `t(...)`, plus one case under `setActiveLanguage("es")` proving `Lun 12` / `Julio`
- [x] 8.3 (designer) `ui/` → `useTranslation()`: `CalendarWeekStrip`, `WeekCell`, `ActivityDrawer` (title + description), `YearGrid`. Keys (`calendar.*`) into both dictionaries (`WeekCell` renders only the already-translated `day.label` from `logic/model.ts` — nothing hardcoded there; `YearGrid` is fully `aria-hidden`/non-interactive — no copy at all)
- [x] 8.4 (designer) Update the calendar UI tests to assert via `t(...)` (no dedicated calendar `ui/` Vitest file exists; no Vitest test asserts this copy — only the `chromium`-project e2e spec does, unaffected since its English strings are unchanged)
- [x] 8.5 **Gate:** `bun run typecheck` + Vitest green

## 9. Spanish copy pass (builder)

- [x] 9.1 Read `es.json` end to end and make terminology and tone consistent across features (one word per concept — e.g. one translation of "routine", one of "set", one of "rest") — sorted both dictionaries alphabetically for review, confirmed one Spanish term per concept throughout: rutina/serie/descanso/repeticiones/ejercicio/entrenamiento/generador/editar all used consistently across every feature
- [x] 9.2 Verify no `es.json` value is still English left over from a copy-paste of `en.json`, and that casing matches the design system's conventions (notably the calendar labels — `Lun`, `Julio`, not CLDR's lowercase) — scripted diff of identical en/es values found only two legitimate Spanish–English cognates (`General`, `Imperial`); scripted check confirmed every `{var}` interpolation token matches exactly between the two dictionaries; calendar labels keep their engineer-authored capitalized abbreviations

## 10. Spanish e2e (engineer)

- [x] 10.1 Add a `spanish` Playwright project to `playwright.config.ts` with `use: { locale: "es-ES" }`
- [x] 10.2 Write `e2e/i18n-spanish.spec.ts` — Story 4 end to end: load, onboard, generate a routine, open workout mode; every assertion in Spanish
- [x] 10.3 In that spec, register a `page.on("console")` guard that **fails the run on any React error** — this is the standing catch for a future component that renders `t()` on the server (design §Decision 4)
- [x] 10.4 Assert the document element carries `lang="es"`
- [x] 10.5 **Gate:** the `spanish` project passes and the existing `chromium` project is unaffected (2 pre-existing `chromium` failures noted below are unchanged, confirmed via clean-checkout reproduction)

## 11. Verification

- [x] 11.1 `bun run typecheck` green (proves `KEY_PARITY` — `es.json` has exactly `en.json`'s keys)
- [x] 11.2 `bun run check` green (Biome lint + format, incl. firewall rules 1, 2, 4)
- [x] 11.3 `bunx depcruise src` green (rule 3 barrel-only + no cycles)
- [x] 11.4 `bun run test` — full Vitest suite green (284/284)
- [x] 11.5 `spanish` project green; `chromium` has exactly the 2 pre-existing failures called out below, confirmed unrelated to this change; `offline` project's one spec (`offline.offline.spec.ts`) fails identically on a clean, unstashed `main` checkout — a pre-existing sandbox/service-worker environment limitation, not introduced or touched by this change (no `sw.ts`/service-worker code was touched)
- [x] 11.6 Manual check against Story 4's bar for done: a browser configured with Spanish preferred → the whole experience, UI **and** the generated routine, is Spanish — demonstrated by the passing `spanish` Playwright spec
