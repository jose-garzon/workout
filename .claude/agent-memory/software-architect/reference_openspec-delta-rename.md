---
name: openspec-delta-rename
description: How to rename AND edit a requirement in one OpenSpec delta — RENAMED FROM/TO plus MODIFIED under the NEW header (apply order verified from CLI source)
metadata:
  type: reference
---

OpenSpec applies delta operations in a fixed order: **RENAMED → REMOVED → MODIFIED → ADDED**
(`@fission-ai/openspec/dist/core/specs-apply.js`, "Apply operations in order" comment).

So to rename a requirement *and* change its body in one change:

```
## RENAMED Requirements

- FROM: `### Requirement: Old name`
- TO: `### Requirement: New name`

## MODIFIED Requirements

### Requirement: New name      <- the NEW name; rename has already applied
...entire block, edited...
```

The parser regex is `^\s*-?\s*FROM:\s*`?###\s*Requirement:\s*(.+?)`?\s*$` — the backticks
and the leading `-` are both optional, the `### Requirement:` prefix is not.

Other tool facts worth not re-deriving:
- MODIFIED fails hard if its header does not resolve to an existing requirement
  ("MODIFIED failed ... not found"), and also if the header inside the copied block
  disagrees with the section entry ("header mismatch in content").
- REMOVED requires **both** `**Reason**` and `**Migration**`; validate does not always
  catch a missing one, the archive step does.
- RENAMED TO colliding with an ADDED name is a hard error.
- Section order in the file is irrelevant — sections are split by `##` and applied by kind.

Repo precedent before this was REMOVED+ADDED pairs for renames (see archived
`2026-08-05-profile-page`); that also works and loses nothing, but RENAMED+MODIFIED keeps
the requirement's identity across the archive. Related: [[project-feature-first-architecture]].
