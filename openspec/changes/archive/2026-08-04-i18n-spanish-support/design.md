# Design — i18n-spanish-support

A hand-rolled translation substrate: two flat JSON dictionaries, one pure `t()`,
one detection call at boot. No library, no provider tree, no context, no storage,
no new network call, and — as it turns out — **no change to the architecture
firewall config**. The whole change is one new `src/shared/i18n/` slice plus a
mechanical string extraction across every shipped UI file.

## Context (what already exists, and what it means for i18n)

- **Nothing translated today, and a lot of the copy is not in `ui/`.** Most
  strings are literals inside components, but three `logic/` modules own copy too,
  and missing them is the easiest way to ship a half-Spanish app:
  - `profile-goals/logic/model.ts` — **the biggest logic-side surface**: the four
    `STEP_TITLES`, every field label (`fieldLabel`), every choice-option label
    (gender / units / focus), and **every validation message**
    (`"Enter an age from 13 to 120"`, `"Choose a unit"`, …). It also builds a
    *unit-aware* label — `"Bodyweight (kg)"` vs `"(lb)"` — which becomes an
    interpolated key, `"onboarding.field.bodyweight": "Bodyweight ({unit})"`.
  - `routine-generation/logic/useRoutineEdit.ts` — `editErrorMessage(AiError)`.
  - `calendar/logic/model.ts` — the `WEEKDAYS` / `MONTHS_FULL` arrays.

  (Generation error copy, by contrast, *is* in `ui/` —
  `RoutineHomeScreen.tsx`'s `AiError` → message map.) The `OnboardingApi` /
  `OnboardingField` seam shapes do **not** change: the fields stay `string`, they
  are just produced by `t()` now.
- **The app is effectively client-rendered.** `app/page.tsx` mounts `FirstRunGate`
  via `dynamic(..., { ssr: false })` with `Splash` as the fallback; `Splash`
  contains one string, the brand name `workout-pal` (not translatable).
  `WorkoutModeScreen` likewise defers its body with `ssr: false`.
  **Consequence: the prerendered HTML contains no translatable copy** — with one
  exception, below. That single fact removes the whole SSR/hydration problem and
  is the pivot the language-detection decision turns on.
- **The one exception.** `WorkoutModeScreen` renders
  `<AppShell title="Workout">` *outside* its `ssr:false` boundary, and `AppShell`
  renders `ThemeToggle` ("Dark"/"Light" + `aria-label`). Those three strings do
  render on the server on `/workout/[dayId]`. This change has to move them inside
  the client boundary (Decision 4).
- **A blessed no-flash pattern already exists.** `app/layout.tsx` runs an inline
  `<head>` script that resolves the theme before hydration and writes
  `document.documentElement.dataset.theme`; `<html>` already carries
  `suppressHydrationWarning`. Language reuses this exact vehicle.
- **The firewall is a forbid-list, not an allow-list.** `biome.json`'s
  `modules/*/ui` override forbids `@/shared/db`, `**/api/**`, `**/*Repo` — it does
  **not** enumerate what is allowed. `.dependency-cruiser.cjs` only governs
  cross-*feature* imports and cycles, and `src/shared/**` is outside
  `^src/modules/`. So a new `src/shared/i18n/` is importable from `ui/`, `logic/`
  and `api/` with **zero config change**. Only the *prose* describing rule 1
  (CLAUDE.md / `config.yaml`) needs the word "shared/i18n" added.
- **The AI path.** `client.ts` (browser) → `POST /api/generate-routine` →
  `route.ts` → `openrouter.ts` (`parseBuildBody` / `parseEditBody`) →
  `prompt.ts` (`buildRoutinePrompt` / `buildEditPrompt`) → OpenRouter. `prompt.ts`
  is a deliberate **dependency leaf**: it redeclares the profile shape rather than
  importing domain types, so it stays server-safe. Firewall rule 4 constrains what
  `route.ts` imports; it is untouched here.

## Goals / Non-Goals

**Goals.** One dictionary per language with compile-time-checked key parity (AC1.4
can never silently regress). `{var}` interpolation (AC1.3). Browser-language
detection with **no English frame ever painted** for an `es-*` browser (AC1.1)
and byte-identical behaviour for everyone else (AC1.2). Calendar weekday/month
names follow the active language (AC2.2). Build **and** edit requests carry the
language so the model answers in it (AC3.1–AC3.4). Tests stop asserting literal
copy.

**Non-Goals.** No selector UI, no persisted override, no third language, no
plural/gender/ICU rules, no number/date/unit formatting, no lazy-loaded
dictionaries, no locale negotiation beyond "starts with `es`", no translation of
`metadata` (title/description) or the PWA manifest, no re-translation of stored
routines.

---

## Decisions

### Decision 1 — `src/shared/i18n/`: a new top-level shared slice, flat keys, typed by `en.json`

**Decision.**

```
src/shared/i18n/
  en.json            reference dictionary — FLAT, dot-namespaced keys
  es.json            exactly the same key set, Spanish copy
  translate.ts       Language + detection + dictionaries + TranslationKey + t()
  useTranslation.ts  'use client' React seam
  index.ts           the public barrel — everything is imported from "@/shared/i18n"
  translate.test.ts
```

Not `modules/i18n/` (it is owned by no feature and would then be barrel-gated by
dependency-cruiser for no benefit), and not `shared/ui/i18n/` (the design system
is *UI*; `modules/calendar/logic/model.ts` and `useRoutineEdit.ts` both need `t`,
and `logic/` reaching into `shared/ui` would invert the layering). A top-level
sibling of `shared/db` and `shared/ui` is the honest shape: **a dependency leaf
that every layer may import and that imports nothing from the app.**

**Flat, dot-namespaced keys** — `"onboarding.step.next"`, not
`{ onboarding: { step: { next: "..." } } }`:

```json
{
  "common.theme.toLight": "Switch to light theme",
  "home.greeting": "Hey {name}",
  "calendar.weekday.mon": "Mon",
  "calendar.month.july": "July"
}
```

Namespace prefixes (convention, not enforced): `common.*` (`shared/ui`),
`welcome.*` / `onboarding.*` / `profile.*` (profile-goals), `home.*` /
`composer.*` / `routine.*` / `editor.*` (routine-generation), `calendar.*`,
`workout.*`, `error.*` (AI failure copy).

Flat wins because the key type is then one line and needs no recursive mapped
type:

```ts
import en from "./en.json";
import es from "./es.json";

export type TranslationKey = keyof typeof en;   // union of every literal key

type KeyParity<A, B> = [Exclude<keyof A, keyof B>] extends [never]
  ? [Exclude<keyof B, keyof A>] extends [never]
    ? true
    : { "es.json has keys en.json does not": Exclude<keyof B, keyof A> }
  : { "es.json is missing keys": Exclude<keyof A, keyof B> };

/** Compile-time proof that es.json has EXACTLY the keys of en.json. */
export const KEY_PARITY: KeyParity<typeof en, typeof es> = true;

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, es };
```

`en.json` is the **reference**: `TranslationKey` is derived from it, so calling
`t("typo.key")` is a `tsc` error. `KEY_PARITY` fails to compile if `es.json` is
missing a key *or* has an extra one — and the error message names the offending
keys. `resolveJsonModule` is already on in `tsconfig.json`.

**Consequence — the compile-time guarantee needs a compiler run.** Today the
Husky hook is `bun run check` + `bunx depcruise src`; nothing runs `tsc`. Add
`"typecheck": "tsc --noEmit"` to `package.json` and append `bun run typecheck` to
`.husky/pre-commit`. Belt *and* suspenders: `translate.test.ts` also asserts key
parity at runtime (`Object.keys(es).sort()` equals `Object.keys(en).sort()`, and
every value is a non-empty string), so the guarantee survives even if the hook is
skipped.

**Rejected: nested JSON.** Nicer to read for a translator; needs a recursive
`Leaves<T>` mapped type, makes `KeyParity` far harder, and buys nothing at ~150
keys. **Rejected: `.ts` dictionaries instead of `.json`.** Would give literal
value types (see Decision 2) but invites logic/imports/template strings to creep
into what must stay pure copy. What we gave up: a translator can't be handed a
plain nested file, and copy files are now editable by anyone who can break the
build — accepted, because the build breaking *is* the safety net.

**Ownership.** `en.json` + `es.json` are copy: the frontend-dev-designer owns the
UI strings, the software-engineer owns `error.*` and anything produced in
`logic/`. Both edit the same two files. **Every key added to `en.json` must be
added to `es.json` in the same commit** — enforced, not trusted.

### Decision 2 — `t(key, vars?)`: one pure function, runtime interpolation, English fallback

```ts
// src/shared/i18n/translate.ts
export function t(
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const template = DICTIONARIES[activeLanguage()][key] ?? en[key] ?? key;
  if (vars === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    name in vars ? String(vars[name]) : token,
  );
}
```

- **Fallback chain (AC1.4):** active dictionary → `en` → the raw key. The last
  step is unreachable while `KEY_PARITY` compiles; it exists so a hand-edited
  dictionary degrades to something diagnosable instead of `undefined` leaking
  into JSX. The spec'd behaviour is "English is shown".
- **Interpolation:** one `String.replace` with `/\{(\w+)\}/g`. That is a language
  builtin, not a dependency, and it is *simpler* than a split/join loop — one
  pass, handles repeated and multiple placeholders, and does not need the caller
  to know the order. An **unprovided** variable leaves its `{token}` in place
  rather than substituting `""`: a caller bug should be loud, not invisible.
  AC1.3 presupposes the value is supplied.
- **No compile-time check that `vars` matches the placeholders.** TypeScript
  widens JSON string values to `string` (only *keys* keep literal types), so the
  `` `${string}{${infer V}}${string}` `` trick that would extract placeholder
  names has nothing to infer from. Decided not to move dictionaries to `.ts`
  just to get it. Coverage instead: `translate.test.ts` pins each interpolated
  key, and RTL tests render through `t(key, vars)` so a missed var shows up as a
  visible `{name}` in an assertion.
- `t` is a module-level function ⇒ referentially stable forever ⇒ safe in
  `useMemo`/`useCallback` dependency arrays without wrapping.

### Decision 3 — the seam: `useTranslation()` for React, `t` for everything else

```ts
// @/shared/i18n — THE public surface. Nothing imports the inner files.
export type Language = "en" | "es";
export type TranslationKey = keyof typeof en;

export function t(key: TranslationKey, vars?: Record<string, string | number>): string;

/** THE UI seam. `t` is stable; `language` is fixed for the page's lifetime. */
export function useTranslation(): { t: typeof t; language: Language };

/** The page's language, resolved once from `navigator.language`. */
export function activeLanguage(): Language;

/** `es-*` (any case) -> "es"; everything else, incl. undefined -> "en". */
export function resolveLanguage(tag: string | undefined): Language;

/** Test-only: force the language, or `null` to re-resolve. Never called in app code. */
export function setActiveLanguage(language: Language | null): void;
```

**The rule, and it is not optional:**

| Caller | Uses |
| --- | --- |
| `modules/*/ui/**`, `shared/ui/**` (React components) | `const { t } = useTranslation()` |
| `modules/*/logic/**`, `modules/*/api/**`, pure modules (`model.ts`) | `import { t } from "@/shared/i18n"` |

`useTranslation` is six lines over the same singleton — no context, no provider,
no store, nothing mounted in `layout.tsx`:

```tsx
"use client";
export function useTranslation() {
  return { t, language: activeLanguage() };
}
```

**Why a hook at all, given it wraps a module function?** Two reasons, both
concrete. (1) It matches the codebase's existing seam idiom — `useTheme()` is the
same shape and the designer already reaches for it. (2) The one plausible next
step is a language selector; with the hook that is a one-file change (subscribe to
a store, return its `t`), with 60 direct `import { t }` call sites it is a 60-file
change. Six lines now buys that. What we gave up: two ways to reach the same
function, hence the table above — treat a component importing `t` directly as a
review failure.

**Why no provider/context.** Language is immutable for the page's lifetime (no
selector — an explicit non-goal), so there is nothing to propagate and nothing to
re-render. A context would be pure ceremony and would force a client boundary in
`app/layout.tsx` that does not otherwise exist.

### Decision 4 — detection: resolve on the client at first use; keep every translated string out of the server render

**This is the load-bearing decision.** Concretely:

```ts
let active: Language | null = null;

export function resolveLanguage(tag: string | undefined): Language {
  return tag?.toLowerCase().startsWith("es") ? "es" : "en";
}

export function activeLanguage(): Language {
  if (active === null) {
    active = resolveLanguage(
      typeof navigator === "undefined" ? undefined : navigator.language,
    );
  }
  return active;
}

export function setActiveLanguage(language: Language | null): void {
  active = language; // tests only
}
```

Lazy + memoised: resolved on the **first `t()` call**, which — because every
translated string lives behind an `ssr:false` boundary — always happens in the
browser, after `navigator` exists. There is no boot step to call, nothing to
`await`, and no "not ready yet" state.

**Why there is no flash, and no hydration mismatch.** The prerendered HTML is
`<Splash />` (brand name only) on `/`, and a `<Skeleton />` on `/workout/[dayId]`
after the fix below. The first render that contains any copy is a client render,
and by then `activeLanguage()` already returns `es`. An `es-*` browser therefore
**never paints an English string** (AC1.1) — not because we hide something, but
because the English render never happens.

**The one required structural fix.** `WorkoutModeScreen.tsx` currently renders
`<AppShell title="Workout">` around its `ssr:false` body, so `AppShell`'s `<h1>`
and `ThemeToggle`'s "Dark"/"Light" + `aria-label` are server-rendered. Move
`AppShell` **into** `WorkoutModeBody` (the `ssr:false` chunk) and let the
`loading` fallback be a bare `<Skeleton />`. Cost: the header appears a beat later
during the chunk load on that one route. Accepted — it is a local chunk, and
`/` already shows a chrome-less `Splash` for the same reason.

**The standing invariant this creates:** *no component that calls `t()` may render
on the server.* In practice: any component reachable from a Server Component
without passing through an `ssr:false` boundary must not translate. Guard: the
Spanish e2e spec (Decision 7) fails the run on any React console error, and a
hydration mismatch is exactly that.

**`<html lang>`.** Extend the existing inline `<head>` script in `layout.tsx`
(inside its `try`) with one line, so the document language is correct before first
paint and screen readers pronounce Spanish correctly:

```js
document.documentElement.lang =
  (navigator.language || 'en').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
```

`<html lang="en">` stays as the server-rendered default and
`suppressHydrationWarning` (already present for `data-theme`) covers the swap.
This duplicates the `es`-prefix rule in two places — the script and
`resolveLanguage` — exactly as `"wp.theme"` is already duplicated between the
script and `themeStore.ts`. Same accepted, documented trade: an inline script
cannot import a TS module. Both sites carry a comment naming the other.

**Rejected: a blocking inline script that stashes the language on `window` for
React to read.** Buys nothing here — React never renders copy on the server, so
there is no earlier moment to be correct. **Rejected: default-render English then
swap after mount.** Directly violates AC1.1. **Rejected: `Accept-Language` on the
server + SSR the right language.** Would mean per-request rendering, killing the
static/PWA shell and the offline story for a local-first app with no
personalisation budget. **Rejected: `navigator.languages[0]`.** `navigator.language`
*is* the preferred language, it is what Playwright's `locale` option sets, and it
is one fewer edge case.

### Decision 5 — language reaches the AI by riding the existing POST body

**Client.** `client.ts` already reads a browser global (`navigator.onLine`, via
`isOffline()`); it reads one more. `postToProxy` adds `language: activeLanguage()`
to every body — build and edit alike:

```ts
async function postToProxy(body: object): Promise<GenerateOutcome> {
  // ... offline check unchanged
  body: JSON.stringify({ ...body, language: activeLanguage() }),
}
```

**Hook and UI signatures do not change.** `generate(prompt, ctx)`,
`submit(instruction, sessionSummary?)`, `GenerateContext`, `RoutineHomeScreen`'s
props — all untouched. The alternative, threading `language` down from `app/page.tsx`
through `GenerateContext`, would churn the UI for a value the UI has no opinion
about and would make the designer responsible for a data concern. What we gave up:
`generateRoutine` now depends on an ambient value rather than its arguments —
mitigated by `setActiveLanguage()` in tests and by MSW asserting the request body.

**Server.** `openrouter.ts` narrows it at the boundary and defaults to English, so
a stale cached client (no `language` field) keeps working unchanged:

```ts
const language: Language = body.language === "es" ? "es" : "en";
```

Then `prompt.ts` takes it as a **required** parameter — required, not defaulted,
so `tsc` catches a missed call site:

```ts
buildRoutinePrompt(userPrompt: string, ctx: PromptContext, language: Language): ChatMessage[]
buildEditPrompt(instruction: string, routine: unknown, language: Language, sessionSummary?: string): ChatMessage[]
```

(`language` goes **before** the optional `sessionSummary`.) Both system prompts
gain a final block — last, so it is the most salient instruction, and after
`EXAMPLE`, whose English exercise names the model would otherwise copy:

```ts
const LANGUAGE_NAMES = { en: "English", es: "Spanish" } as const;

function languageDirective(language: Language): string {
  return [
    `Write every human-readable value in ${LANGUAGE_NAMES[language]}: the routine`,
    '"name", the "subtitle", every day "name", and every exercise "name".',
    "The JSON KEYS stay EXACTLY as specified above, in English — do not translate",
    "keys. Numbers are unchanged.",
  ].join(" ");
}
```

Spelling out "keys stay English" is not decoration: translating keys would fail
`routineSchema` and surface as `{ kind: "parse" }`.

**`prompt.ts` and `openrouter.ts` redeclare `type Language = "en" | "es"` locally
rather than importing `@/shared/i18n`.** `prompt.ts` is documented as a
dependency leaf and already redeclares the profile shape for exactly this reason;
keeping the server graph free of a browser-side module means firewall rule 4 and
its scaffold fixture are untouched. What we gave up: a two-member union exists in
three files. At two values the drift risk is negligible; if a third language ever
lands, promote it to a shared type-only import then.

**Response contract unchanged.** `routineSchema`, `routineJsonSchema`,
`assembleRoutine`, `assembleEditedRoutine` and id preservation are all untouched —
only the *string values* differ.

**One honest wrinkle.** Id preservation on edit matches exercises by normalised
name. Editing an English-generated routine while the UI is Spanish may return
Spanish names, which look like renames, so those exercises get fresh ids and lose
their previous-weight history. That is the proposal's stated non-goal ("no
retroactive re-translation") landing in practice; see Risks.

### Decision 6 — calendar labels come from the dictionary, not `Intl`

`modules/calendar/logic/model.ts` replaces its two arrays with key arrays and
calls `t` directly (it is not React):

```ts
import { t } from "@/shared/i18n";

const WEEKDAY_KEYS = [
  "calendar.weekday.sun", "calendar.weekday.mon", /* ... */ "calendar.weekday.sat",
] as const;   // indexed by Date#getDay()

const MONTH_KEYS = ["calendar.month.january", /* ... */ "calendar.month.december"] as const;

export function dayLabel(dayKey: string): string {
  /* ... */ return `${t(WEEKDAY_KEYS[date.getDay()])} ${d}`;
}
```

Signatures (`dayLabel(dayKey)`, `monthName(dayKey)`, `buildWeek(...)`) do **not**
change, so `WeekStripDay.label` and every caller stay as they are.

**Why not `Intl.DateTimeFormat`.** It is free and correct for any locale, and for
a bigger app it would be the right call. Three reasons it loses here: (1) Spanish
CLDR yields lowercase `"lun"` / `"julio"`, while the rest of our Spanish copy has
designer-chosen casing — the calendar would visibly disagree with the app around
it, and the existing spec pins `"Mon 10"` / `"July"` capitalisation; (2) it splits
the source of truth — half the Spanish from `es.json`, half from the engine's CLDR
tables, which vary by browser and version and make e2e assertions flaky; (3) the
abbreviation length CLDR picks is not ours to choose. What we gave up: 19
hand-maintained strings per language, and a future third language costs 19 more
that `Intl` would have given free. At two languages that is a cheap price for a
single, deterministic source of truth.

**Consequence:** `model.ts` is no longer language-agnostic. `model.test.ts` must
either assert via `t("calendar.weekday.mon")` or set the language explicitly with
`setActiveLanguage`.

### Decision 7 — tests resolve copy through `t`, never through literals

| Level | Rule |
| --- | --- |
| `translate.test.ts` (new) | The **only** file that asserts literal copy. Covers: `resolveLanguage` for `es-ES`/`es`/`en-US`/`fr-FR`/`undefined`; interpolation (single, repeated, multiple, unprovided var); missing-key → English fallback; runtime key parity + no empty values. |
| Vitest + RTL (existing) | Replace `getByText("Continue")` with `getByText(t("onboarding.next"))`, and interpolated copy with `t("home.greeting", { name: "Ana" })`. Tests then survive any copy edit. Default language in jsdom is `en` (jsdom reports `en-US`). |
| Spanish unit coverage | A handful of `beforeEach(() => setActiveLanguage("es")); afterEach(() => setActiveLanguage(null))` cases — enough to prove the seam flips, not a second full suite. |
| MSW / integration | Assert the generate **and** edit request bodies carry `language` (`"en"` by default, `"es"` under `setActiveLanguage("es")`). |
| Playwright | A `spanish` project — `use: { locale: "es-ES" }` — running Story 4 end to end: load, onboard, generate, open workout mode. It also registers `page.on("console")` and **fails on any React error**, which is how a future server-rendered translated string gets caught (Decision 4). |

**Why not snapshot the dictionaries.** A snapshot of copy is a second copy of the
copy; every wording tweak becomes a two-file edit for zero signal.

---

## Risks / Trade-offs

| Risk | Severity | Mitigation / accepted position |
| --- | --- | --- |
| A future screen renders `t()` on the server → English flash + hydration mismatch on that route | High | Stated as a standing invariant; the Spanish e2e fails on React console errors. Not statically enforceable — Biome cannot see the `ssr:false` boundary. |
| The model returns English anyway, or translates JSON keys | Medium | Directive placed last, after the example; keys explicitly pinned to English. A key translation fails Zod and surfaces as the existing `parse` error — degraded, not broken. Non-goal: no QA tooling for AI Spanish. |
| Editing an English routine in a Spanish UI renames exercises → fresh ids → lost previous-weight history | Medium | Real and accepted (proposal non-goal: no retroactive re-translation). Only bites users who switch browser language after generating. Not solved here. |
| `es.json` drifts from `en.json` | Low | `KEY_PARITY` (tsc, now on pre-commit) + a runtime parity test. Missing keys still fall back to English at runtime. |
| Copy quality — a solo builder hand-writing Spanish | Low | Out of scope for architecture. `es.json` is one reviewable file. |
| Bundle size: both dictionaries always shipped | Low | ~150 keys × 2 ≈ 10–15 KB before compression. Lazy loading is an explicit non-goal and would reintroduce an async boot step and a flash. |
| `activeLanguage()` is ambient state read inside `client.ts` and `model.ts` | Low | Deliberate (Decision 5). `setActiveLanguage` makes it fully controllable in tests; `client.ts` already reads `navigator.onLine` the same way. |
| ~150 strings extracted by hand across every shipped file | Medium (effort, not design) | Mechanical. Sequenced screen-by-screen so each step stays reviewable (Migration Plan). |

**Local-first check.** Dictionaries are `import`ed JSON, bundled — never fetched.
Language is derived from the browser at load and **stored nowhere** (no
localStorage, no IndexedDB, no schema change, no migration). The AI request gains
one two-character field on the existing single proxy call. No new network call, no
server state, firewall rules 1–4 unchanged in behaviour.

## Migration Plan

Ordered so that each step is independently reviewable and the app is never
half-broken. Steps 3–7 are parallelisable between the two builders once step 2
lands — that is the point of doing the substrate first.

1. **Substrate (engineer).** `src/shared/i18n/` — `translate.ts`,
   `useTranslation.ts`, `index.ts`, empty-ish `en.json`/`es.json`, plus
   `translate.test.ts`. Add `"typecheck": "tsc --noEmit"` to `package.json` and
   `bun run typecheck` to `.husky/pre-commit`. Add the `lang` line to the
   `layout.tsx` inline script. **Gate: `translate.test.ts` green.**
2. **Doc + config — DONE before implementation started.** `shared/i18n` is
   already in the rule-1 prose in `CLAUDE.md` and `openspec/config.yaml`
   `context:`. No `biome.json` or `.dependency-cruiser.cjs` change is needed —
   verified: both are forbid-lists / feature-scoped. Not a task.
3. **Server language (engineer).** `openrouter.ts` narrowing + `prompt.ts`
   `language` parameter + `languageDirective`; `client.ts` `postToProxy` adds
   `language`. Update `prompt.test.ts`, `client.test.ts`, `openrouter.test.ts`.
   **Gate: MSW asserts `language` on both build and edit bodies.**
4. **The `ssr:false` fix (designer).** Move `AppShell` from `WorkoutModeScreen`
   into `WorkoutModeBody`; `loading` becomes a bare `<Skeleton />`. Do this
   *before* translating `shared/ui`, or the workout route breaks hydration mid-way.
5. **`shared/ui` copy (designer).** `ThemeToggle`, `ComingSoon`, `ErrorBoundary`,
   primitive labels → `common.*`.
6. **Feature copy, one feature per commit — `logic/` before `ui/` in each.**
   profile-goals (**`logic/model.ts` first**: step titles, field labels, choice
   labels, validation messages, the `{unit}` bodyweight label — then `welcome.*`,
   `onboarding.*`, `profile.*` in `ui/`) → routine-generation (`logic/`'s
   `editErrorMessage`, then `home.*`, `composer.*`, `routine.*`, `editor.*`,
   `error.*` in `ui/`) → workout-mode (`workout.*`) → calendar (Decision 6's
   `model.ts` rewrite, then `calendar.*` in `ui/`). Each commit updates that
   feature's tests to `t(...)` in the same commit.
7. **Spanish copy pass.** Note that `es.json` is *not* deferred to this step:
   with `tsc` on the pre-commit hook (step 1), `KEY_PARITY` blocks any commit
   that adds a key to `en.json` alone — so each of steps 5–6 fills both
   dictionaries as it goes, and the build is the checklist. This step is the
   consistency sweep over the finished `es.json`: one word per concept across
   features, and no value left as English copy-paste.
8. **E2E (engineer).** Add the `spanish` Playwright project (`locale: "es-ES"`,
   console-error guard) and the Story-4 spec. **Gate: green = done.**

**Rollback.** Every step is additive except 4 and 6; there is no data migration
and no persisted state, so reverting a commit fully reverts the behaviour.

## Open Questions

All three are **resolved**; kept as a record of what was decided and why.

1. **`metadata.description`** ("Plan and follow through on your workouts.") is
   server-rendered into `<meta>` and therefore cannot use `t()`. **Resolved: stays
   English.** It is not visible text, and PWA/install metadata translation is an
   explicit non-goal — so AC2.1 is read as covering on-screen copy only.
2. **Spanish copy source.** **Resolved: the builder writes `es.json` directly, no
   native-review step before shipping.** Copy quality is a follow-up concern, not
   a gate on this change.
3. **`navigator.language` on a Spanish-locale device whose UI language is English**
   (common on shared/managed devices) resolves to `en`. **Resolved: ship as-is** —
   it is the correct behaviour per AC1.2, and the fix is the language selector,
   which is an explicit non-goal.
