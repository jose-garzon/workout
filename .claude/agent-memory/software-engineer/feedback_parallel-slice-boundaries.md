---
name: parallel-slice-boundaries
description: In parallel role-slice apply work, flag transitive breakage in other roles' files rather than crossing the firewall to fix it
metadata:
  type: feedback
---

When implementing an engineer slice, a mandated seam change (e.g. rewriting a
foundation stub hook like `useProfile` to drop fields) can **transitively break**
UI/composition files owned by the designer (`ui/*`) or architect (`app/page.tsx`)
— even retired placeholders. Do NOT edit those files to make the gate green.
Implement your slice correctly, keep the seam signature EXACTLY per `design.md`
§3, and **flag the residual breakage** in the final report.

**Why:** Roles (engineer / frontend-dev-designer / architect) build in parallel
against the same `design.md` seam and meet only at that interface. The firewall
(Biome + dependency-cruiser) and explicit task ownership (E-tasks vs D-tasks vs
T-tasks) enforce the boundary. Crossing it to silence a typecheck error defeats
the point and can clobber the designer's in-flight work.

**How to apply:** After your slice, run `bunx tsc --noEmit` / `biome check` /
`depcruise src` / `bun run test`. If the ONLY remaining failure lives in a file
another role owns and is slated for their task (a retired placeholder, `page.tsx`
re-point, etc.), that is expected cross-slice ordering — report it as a known
gate gap tied to the specific downstream task, don't fix it yourself. See
[[welcome-view-gate-ordering]].
