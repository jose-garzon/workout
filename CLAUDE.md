# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Pre-code. The stack + architecture are **decided** (change `bootstrap-architecture`, `design.md` v3) but no application code, build system, or dependencies exist yet. When the first real code lands, add the stack-specific build/lint/test commands here.

**Stack:** Next.js 15 (App Router) + React 19 + TypeScript strict; PWA via Serwist (`@serwist/next`); Tailwind v4 + CSS custom properties (design tokens); Zustand (state); Dexie/IndexedDB (persistence); OpenRouter behind a stateless proxy route (AI); **Biome** for lint + format (not ESLint/Prettier), **dependency-cruiser** for architecture boundaries Biome can't express — both run on a **Husky pre-commit** hook; Vitest + RTL + fake-indexeddb + MSW + Playwright (testing). Runtime + package manager: **Bun**. Fonts self-hosted via `@font-face`, served from `public/assets/fonts/` (`.woff2`, no CDN).

**Architecture — domain-driven, feature-first, layered inside each feature:**

```
src/
  app/       thin Next route wrappers -> delegate into modules/<feature>/ui;
             + api/generate-routine/route.ts (the ONE stateless AI proxy)
  modules/   one folder per feature (profile-goals A, routine-generation B,
             workout-mode D, calendar C), layered inside:
               ui/     designer — 'use client' components + screen
               logic/  engineer — pure rules (model.ts) + seam hooks + Zustand store
               api/    engineer — <name>Repo (Dexie); routine-gen also api/ai/{prompt,schema,errors,client}
               types.ts   feature-owned types
               index.ts   PUBLIC BARREL — seam hooks + public types only
  shared/    db/ (the ONE Dexie instance + migrations, browser-only),
             ui/ = the design system: tokens/, primitives/ (ATOMS — Button,
               Input… reused by every feature), components/ (feature-agnostic
               composites), layout/, theme/ (useTheme + store)
```

Feature-specific composite components stay in `modules/<feature>/ui`; only cross-feature atoms/primitives live in `shared/ui/primitives`. Import direction is strictly downward `ui -> logic -> api -> types`; a feature's four inner folders are private (exposed only via `index.ts`). The **logic↔UI interface** = the seam between a feature's `ui/` and its `logic/`.

**Architecture firewall (CI-failing), split across two tools** because Biome's `noRestrictedImports` is a per-file forbid-list with no zone→target model or cycle detection: (1) [Biome] `modules/*/ui` imports only its own `logic/` + `shared/ui`; (2) [Biome] no upward imports inside a feature; (3) [dependency-cruiser] cross-feature via `index.ts` barrel only + no cycles (relational, Biome can't express); (4) [Biome — **security-load-bearing**] `app/api/**/route.ts` imports only `modules/routine-generation/api/ai/{prompt,schema,errors}` — never `shared/db` or any `*Repo` (both browser-only). A scaffold-time fixture must prove Biome errors when a route imports `shared/db`.

## OpenSpec workflow (spec-driven)

This project uses OpenSpec (CLI `openspec`, v1.3.1, `schema: spec-driven` in `openspec/config.yaml`). Work is organized as **changes**: a change bundles a `proposal.md` (what & why), `design.md` (how), and `tasks.md` (implementation steps) under `openspec/changes/<name>/`. Completed changes move to `openspec/changes/archive/`.

The lifecycle is explore → propose → apply → archive, driven by skills/commands:

- `/opsx:explore` — think through a problem before committing to a change. Read/search only; **never write code** in this mode.
- `/opsx:propose` — scaffold a new change (`openspec new change "<name>"`, kebab-case) and generate all artifacts.
- `/opsx:apply` — implement the tasks in a change.
- `/opsx:archive` — finalize a completed change.

Useful CLI calls the skills rely on:

```bash
openspec list --json                          # available changes
openspec status --change "<name>" --json      # artifact + task completion
openspec instructions apply --change "<name>" --json
openspec new change "<name>"                   # scaffold a change
```

## Role agents

Four agents map onto the OpenSpec artifacts — they are *who*, OpenSpec is *when*, skills are *how*:

- **product-owner** (`.claude/agents/product-owner.md`) — owns `proposal.md`. What & why: users, stories, Given/When/Then acceptance criteria, non-goals. No source/design edits.
- **software-architect** (`.claude/agents/software-architect.md`) — owns `design.md`. How: stack, data model, contracts, boundaries, tradeoffs, and **the logic↔UI interface** the two builders share. Read-only on source. Proposes the stack in the first change.
- **software-engineer** (`.claude/agents/software-engineer.md`) — builds everything **behind** the UI: business logic, domain model, browser-only persistence (IndexedDB/localStorage), AI integration, timers, derived stats. Exposes clean interfaces. Builds **no UI**.
- **frontend-dev-designer** (`.claude/agents/frontend-dev-designer.md`) — builds **UI only**: components, styling, design system, subtle animation, a11y. **No business logic or storage** — consumes the software-engineer's interfaces. Design ethos: simple, beautiful, intuitive; not generic AI-looking UI.

The two builders work in parallel during apply, meeting at the interface the architect defines in `design.md`. Each flags out-of-scope work rather than crossing the boundary.

Typical flow: `/opsx:explore` → product-owner writes proposal → software-architect writes design (incl. logic↔UI interface) → `spec-review` → software-engineer + frontend-dev-designer run `/opsx:apply` in parallel.

## Shared source of truth

`openspec/config.yaml` `context:` holds the product vision, key features, hard constraints, and conventions. **All agents read it first.** The architect writes stack/convention decisions there so every agent inherits them. Stack + architecture are now decided (see **Project state** above); the architect keeps this block authoritative for any further convention changes.

**Hard constraint (local-first):** all user data lives in the browser (IndexedDB/localStorage). No servers, no backend. The only network call is the AI API used to generate a routine. Every design must hold under this.

## Design system

`openspec/design-system.md` is the source of truth for UI: principles, guidelines, and all tokens (color/type/spacing/radius/elevation/motion). **Every UI agent reads it before building.** Owned by frontend-dev-designer. Identity: energetic gym-brand — dark default (light via manual toggle), electric yellow accent (`#E8FF3D`, dark text on it), Anton + Barlow (self-hosted, no CDN), zero border radius (sharp rectangles), big easy-to-tap controls (48/56/64px) with generous spacing. Token *implementation* (CSS vars/theme + `@font-face`) is wired by the architect once the stack is chosen.

## Custom skills

- **orchestrate** (`.claude/skills/orchestrate/`) — conductor playbook: routes a whole feature through the role agents across the OpenSpec phases. Run from the main conversation (subagents can't launch subagents), which is the actual orchestrator.
- **spec-review** (`.claude/skills/spec-review/`) — check a change's proposal/design/tasks for gaps before implementing.
- **design-critique** (`.claude/skills/design-critique/`) — critique a UI against visual/UX/a11y heuristics; frontend agent self-reviews with it.

Stack-specific skills (how to add a component/route/test in the chosen framework) should be added *after* the stack is decided — they'd be hollow before then.
