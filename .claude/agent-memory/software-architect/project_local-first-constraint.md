---
name: local-first-constraint
description: workout-pal's refined hard constraint — all user data in-browser (IndexedDB/Dexie); the ONLY server code is a stateless AI proxy route
metadata:
  type: project
---

workout-pal is **local-first**: all user data (profile, goals, active routine, sessions, set logs) lives exclusively in the browser via IndexedDB/Dexie. The ONLY server code is a single stateless Next.js Route Handler (`src/app/api/generate-routine/route.ts`) that proxies one AI call to OpenRouter, holding `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` in server env vars. That route stores nothing, reads nothing, remembers nothing between requests.

**Why:** deliberate narrow relaxation of "no servers at all" — trades pure-static hosting for a hidden API key. Only routine generation touches the network; everything else works fully offline.

**How to apply:** every feature's persistence must go through the browser (Dexie via `shared/db`). Never design server-held data. The [[eslint-import-firewall]] enforces that the AI route cannot import any persistence module. Codified in bootstrap design.md §0 + §2.
