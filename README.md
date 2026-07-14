# workout-pal

> Plan and follow through on your workouts. **Live:** [Prod URL](https://workout-beta-nine.vercel.app/)

A local-first PWA for the intermediate gym-goer: generate a routine from an AI
prompt, follow it in a guided workout mode with built-in rest timers, and track
your consistency on a calendar. All your data stays in your browser — no
account, no backend.

## Features

- **Profile & goals** — register your personal data and training goals.
- **AI routine generation** — describe what you want; get a structured split
  (exercises, sets/reps/rest). The AI generates *structure only*; the app owns
  execution. One active routine at a time.
- **Workout mode** — a single tap-to-start stopwatch guides you through each
  exercise and set, cycling `ready → work → rest → overtime`. Logs per-set
  weight, reps, work time, and volume. Sessions resume where you left off after
  an interruption.
- **Consistency calendar** — tracks *completed* sessions against a weekly target
  derived from your routine ("3 of 4 this week").
- **Installable PWA** — works offline (Serwist service worker), dark-default
  gym-brand UI with an electric-yellow accent.

## Local-first, by design

All user data — profile, routines, sessions, set logs — lives in the browser via
IndexedDB (Dexie). **No server-side persistence, ever.** The only server code is
a single stateless Next.js proxy route (`app/api/generate-routine/route.ts`) that
forwards the routine prompt to OpenRouter and returns the result, storing nothing.
The API key and model id live in server-side env only — the client never sees the
key or picks the model.

## Stack

| Concern       | Choice                                                        |
| ------------- | ------------------------------------------------------------ |
| Framework     | Next.js 15 (App Router) + React 19 + TypeScript (strict)     |
| PWA           | Serwist (`@serwist/next`)                                     |
| Styling       | Tailwind v4 + CSS custom properties (design tokens)          |
| State         | Zustand                                                       |
| Persistence   | Dexie / IndexedDB                                             |
| AI            | OpenRouter (OpenAI-compatible), behind a stateless proxy; Zod-validated |
| Lint + format | Biome (not ESLint/Prettier)                                  |
| Arch boundaries | dependency-cruiser (what Biome can't express)              |
| Testing       | Vitest + RTL + fake-indexeddb + MSW (unit/integration), Playwright (e2e) |
| Runtime + PM  | Bun                                                          |

Fonts (Anton + Barlow) are self-hosted as `.woff2` — no CDN.

## Getting started

Prerequisites: [Bun](https://bun.sh).

```bash
bun install
cp .env.example .env.local   # then fill in your OpenRouter key + model
bun run dev                  # http://localhost:3000
```

### Environment

Set in `.env.local` (server-only — never prefix with `NEXT_PUBLIC_`):

| Variable             | Required | Description                                             |
| -------------------- | -------- | ------------------------------------------------------- |
| `OPENROUTER_API_KEY` | yes      | OpenRouter API key (https://openrouter.ai/keys).        |
| `OPENROUTER_MODEL`   | yes      | Model id, e.g. `anthropic/claude-3.5-sonnet`.           |
| `OPENROUTER_BASE_URL`| no       | Override the OpenRouter base URL.                       |
| `RATE_LIMIT_MAX`     | no       | Per-IP requests on the AI proxy (default `10`).         |
| `RATE_LIMIT_WINDOW_MS`| no      | Rate-limit window in ms (default `60000`).              |

## Scripts

| Command                 | Does                                              |
| ----------------------- | ------------------------------------------------- |
| `bun run dev`           | Start the dev server.                             |
| `bun run build`         | Production build.                                 |
| `bun run start`         | Serve the production build.                       |
| `bun run check`         | Biome lint + format.                              |
| `bun run depcruise`     | Enforce architecture boundaries.                  |
| `bun run firewall:proof`| Prove the server firewall rule errors as intended.|
| `bun run test`          | Vitest unit/integration tests.                    |
| `bun run e2e`           | Playwright end-to-end tests.                      |

Biome + dependency-cruiser run on a Husky pre-commit hook — a violating commit is blocked.

## Architecture

Domain-driven, feature-first, layered inside each feature. Import direction is
strictly downward: `ui → logic → api → types`.

```
src/
  app/       thin Next route wrappers → modules/<feature>/ui
             + api/generate-routine/route.ts (the one stateless AI proxy)
  modules/   one folder per feature (profile-goals, routine-generation,
             workout-mode, calendar), each layered:
               ui/      'use client' components + screen
               logic/   pure rules (model.ts) + seam hooks + Zustand store
               api/     <name>Repo (Dexie); routine-gen also api/ai/*
               types.ts feature-owned types
               index.ts PUBLIC BARREL — seam hooks + public types only
  shared/    db/ (the one Dexie instance + migrations),
             ui/ = the design system (tokens, primitives, layout, theme)
```

A feature's four inner folders are private — cross-feature access goes through
`index.ts` only. A four-rule **architecture firewall** (Biome + dependency-cruiser,
CI-failing) enforces feature isolation, layer direction, barrel-only cross-feature
imports, and a security-load-bearing server rule: the AI proxy route may never
import `shared/db` or any `*Repo` (both browser-only).

## Development workflow

Spec-driven via [OpenSpec](openspec/). Work is organized as *changes* (proposal →
design → tasks) under `openspec/changes/`, driven by role agents (product-owner,
software-architect, software-engineer, frontend-dev-designer). See
[`CLAUDE.md`](CLAUDE.md) for the full workflow and `openspec/config.yaml` for the
shared source of truth.
