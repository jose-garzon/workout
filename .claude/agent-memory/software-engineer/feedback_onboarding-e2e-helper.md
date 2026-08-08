---
name: onboarding-e2e-helper
description: The completeOnboarding e2e helper copied across specs has a broken gender-radio selector (Male substring-matches Female)
metadata:
  type: feedback
---

When writing Playwright e2e specs, the `completeOnboarding` helper is copied
verbatim between spec files. Its gender step uses
`getByRole("radio", { name: "Male" })`, which is a **substring** match and also
hits "Female" → strict-mode violation, so onboarding never completes.

**Why:** Playwright role-name matching is substring + case-insensitive by
default; "Male" ⊂ "Female". Seen 2026-07-12, 2026-08-04, and **fixed in
`routine-generation.spec.ts` on 2026-08-05** (it was the last copy still
missing `exact: true`).

Same family, seen 2026-08-08: the raw-IndexedDB `seed(page, …)` helper copied
from `consistency-calendar.spec.ts` waits for the welcome **"Start" button** to
prove Dexie created its stores. That only holds on the FIRST seed of a test —
once a profile row exists, home renders and "Start" never appears, so any spec
that re-seeds mid-test (regenerate / edit scenarios) times out in the helper.
Wait on something present in BOTH states instead
(`'button:has-text("Start"), [data-testid="week-cell"]'`).

**How to apply:** In any new e2e spec, use
`getByRole("radio", { name: "Male", exact: true })`. Copying the helper as-is
produces a *false red* (fails at the helper, not the feature under test). Fixing
a one-word selector bug in an e2e spec while running the change's own gate was
the right call — e2e specs are engineer-owned, so this is not crossing
[[parallel-slice-boundaries]] (that rule is about other *roles'* files).
