---
name: spec-review
description: Review an OpenSpec change (proposal.md, design.md, tasks.md) for completeness and quality before implementation. Use after design is written and before /opsx:apply, or whenever a change feels underspecified. Returns gaps and concrete fixes.
metadata:
  author: workout-pal
  version: "1.0"
---

Review an OpenSpec change end to end and return the gaps that would cause rework or ambiguity during implementation. Read all artifacts before judging.

**Input**: a change name. If omitted, infer from context or run `openspec list --json` and ask. Then read `openspec/changes/<name>/{proposal.md,design.md,tasks.md}` (use `openspec status --change "<name>" --json` to confirm which artifacts exist).

## Check proposal.md (the what/why)

- Problem is stated clearly — real user pain or goal, not a solution in disguise.
- Target users are named.
- User stories present and outcome-oriented.
- **Acceptance criteria are Given/When/Then and testable.** Flag any that can't be verified.
- **Explicit Non-goals section exists.** Its absence is a finding.

## Check design.md (the how)

- Every acceptance criterion is covered by some design element — no orphan requirements.
- Data model / entities defined where relevant.
- API or function contracts specified (shapes, error cases).
- Component/module boundaries clear.
- Key decisions state **rationale + alternative rejected**. Flag unexplained choices.
- Testing strategy present.
- Consistent with `openspec/config.yaml` `context:` (stack, conventions). Flag drift.
- Not over-engineered for the criteria in scope.

## Check tasks.md (the plan)

- Tasks are small, ordered, and independently verifiable.
- Every task traces to an acceptance criterion; every criterion has covering tasks.
- No task hides an undecided design question (that belongs in design.md, resolved).

## Output

A prioritized list of gaps, most blocking first. Each: **artifact + location → problem → concrete fix**. End with a verdict: **ready to implement** or **needs revision** (list what must change). Don't nitpick style; focus on what causes rework or wrong builds.
