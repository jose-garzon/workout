---
name: openspec-propose
description: Alias for the unified orchestrate flow, stopping at the design gate. Use when the user wants to propose or scaffold a new change — it routes framing to the product-owner agent and design to the software-architect agent (does NOT write the artifacts inline).
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "2.0"
  generatedBy: "1.3.1"
---

This is an **alias** for the one unified spec-driven flow. Proposing a change is just the front slice of `orchestrate`.

**Do this:** invoke the **orchestrate** skill with the user's input and the stop point `--until design`.

- `/opsx:propose <idea>` ≡ `/orchestrate <idea> --until design`.
- Framing (`proposal.md`) → **product-owner** agent. Design (`design.md`), delta specs, `tasks.md` → **software-architect** agent. Routing through orchestrate is the point — do NOT generate the artifacts inline yourself.

**Steps**

1. If no input, ask what the user wants to build (open-ended, via AskUserQuestion), then derive a kebab-case name.
2. Invoke the **orchestrate** skill (Skill tool, `orchestrate`) with the idea/name plus `--until design`. Orchestrate scaffolds (`openspec new change`), runs Frame (product-owner → proposal, **pause for user**) and Design (architect → design + specs + tasks), then stops at the apply-ready gate.
3. Relay orchestrate's summary and tell the user: "Apply-ready. Run `/orchestrate <name>` to continue, or `/opsx:apply` to build."

**Guardrails**
- Never write proposal.md / design.md / tasks.md directly — that regression (artifacts generated without the role agents) is exactly what this alias fixes.
- Run from the MAIN conversation only (orchestrate launches agents; subagents can't launch subagents).
