---
name: "OPSX: Propose"
description: Alias for the unified orchestrate flow, stopping at the design gate (apply-ready)
category: Workflow
tags: [workflow, artifacts, experimental]
---

`/opsx:propose` is an **alias** — it runs the one unified spec-driven flow and stops at the design gate, leaving the change apply-ready.

**Do this:** invoke the **orchestrate** skill with the user's input and the stop point `--until design`.

- `/opsx:propose <idea>` ≡ `/orchestrate <idea> --until design`.
- The framing (proposal.md) is written by the **product-owner** agent; the design (design.md), delta specs, and tasks.md by the **software-architect** agent — this is the whole point of routing through orchestrate instead of writing the artifacts inline.

**Steps**

1. If no input, ask what the user wants to build (open-ended, via AskUserQuestion), then derive a kebab-case name.
2. Invoke the **orchestrate** skill (Skill tool, `orchestrate`) with args: the idea/name plus `--until design`. Orchestrate handles scaffolding (`openspec new change`), the Frame phase (product-owner → proposal, **pause for user**), and the Design phase (architect → design + specs + tasks), then stops at the apply-ready gate.
3. When orchestrate stops, relay its summary and tell the user: "Apply-ready. Run `/orchestrate <name>` to continue through review → build → verify → archive, or `/opsx:apply` to start building."

**Guardrails**
- Do NOT write proposal.md / design.md / tasks.md yourself — that is the regression this alias fixes. Always route through orchestrate so the role agents produce them.
- Must run from the MAIN conversation (orchestrate launches agents; subagents can't launch subagents).
