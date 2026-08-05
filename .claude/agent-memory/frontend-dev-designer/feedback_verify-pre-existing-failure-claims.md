---
name: feedback-verify-pre-existing-failure-claims
description: when a task says "N pre-existing failures, not yours to fix" but a DIFFERENT test also fails, verify it's pre-existing by git-stashing your diff and rerunning on clean main before writing it off
metadata:
  type: feedback
---

During `i18n-spanish-support`, the launch prompt named exactly two pre-existing/flaky `chromium` e2e failures. A third, unnamed failure showed up in the `offline` project (`offline.offline.spec.ts` — `page.reload()` under `context.setOffline(true)` throws `net::ERR_FAILED`, a service-worker/sandbox limitation, not a copy/hydration bug).

**Why this matters:** silently ignoring an unnamed failure risks masking a real regression; silently "fixing" it risks scope creep into someone else's territory or chasing an environment issue that isn't fixable from inside the sandbox.

**How to apply:** `git stash` the full working diff, rerun the exact failing command against clean `main`, confirm the failure reproduces identically, then `git stash pop` and re-verify typecheck/tests still pass after the round-trip. This is fast (a few minutes) and gives a defensible, evidence-based basis for reporting "pre-existing, confirmed via clean-checkout reproduction, not introduced by this change" instead of guessing. Report it explicitly in the final summary rather than quietly checking the gate box — the task's definition of done named specific failures, so an unnamed one deserves a call-out even when it turns out to be benign.
