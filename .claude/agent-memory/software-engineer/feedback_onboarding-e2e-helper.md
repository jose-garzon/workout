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
default; "Male" ⊂ "Female". Confirmed 2026-07-12: `routine-generation.spec.ts`
currently fails at this exact line.

**How to apply:** In any new e2e spec, use
`getByRole("radio", { name: "Male", exact: true })`. Copying the helper as-is
produces a *false red* (fails at the helper, not the feature under test). The
existing broken specs (`routine-generation.spec.ts`, and any other that copied
it) are worth flagging to fix — don't silently propagate the bug. Related:
[[parallel-slice-boundaries]] — flag the breakage in others' files, don't
necessarily fix them as part of an unrelated task.
