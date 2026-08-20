---
name: no-git-stash-parallel
description: Never use git stash to check "is this failure pre-existing" — during parallel apply phases it can swallow another agent's in-flight edits
metadata:
  type: feedback
---

Do NOT run `git stash` (even `--keep-index`) to test whether a failure is
pre-existing. Use `git show HEAD:<path>` into a temp file, or just read the test
and reason about it.

**Why:** during a parallel apply I ran `git stash push --keep-index` to check a
ProfileScreen test failure. It stashed my entire working tree AND the
frontend-dev-designer's concurrently-edited files. The pop succeeded, but a
designer write landing inside that window would have been lost or conflicted.

**How to apply:** any time you are tempted to snapshot/restore the tree while
another agent is working in it (`/opsx:apply` runs engineer + designer at the
same time). Cheap alternative for "is this red mine?": check whether the failing
file is inside your task's file set at all — the ProfileScreen one never was.

Related: [[parallel-slice-boundaries]]
