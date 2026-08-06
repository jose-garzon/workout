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

**How to apply:** In any new e2e spec, use
`getByRole("radio", { name: "Male", exact: true })`. Copying the helper as-is
produces a *false red* (fails at the helper, not the feature under test). Fixing
a one-word selector bug in an e2e spec while running the change's own gate was
the right call — e2e specs are engineer-owned, so this is not crossing
[[parallel-slice-boundaries]] (that rule is about other *roles'* files).
