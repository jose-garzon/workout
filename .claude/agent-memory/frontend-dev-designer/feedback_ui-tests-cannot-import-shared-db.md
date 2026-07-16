---
name: feedback-ui-tests-cannot-import-shared-db
description: Biome firewall rule 1 (ui/ -> only its own logic/ + shared/ui) applies to *.test.tsx files too, not just prod code — blocks a natural "assert on the db" integration test
metadata:
  type: feedback
---

Writing `ProfileDrawer.test.tsx` for a component that owns its seam hook
internally (`useProfileEditor` called inside `ui/`, not passed as a prop —
design.md's explicit choice for this drawer), the natural instinct was an
integration test mirroring `firstRunGate.integration.test.tsx`: render with
the real hook, `await db.profile.get("me")` to assert persistence.
`bun run check` rejected `import { db } from "@/shared/db"` inside a file
under `modules/*/ui/` with "UI isolation (rule 1)" — Biome's
`noRestrictedImports` glob matches the whole `ui/` directory, test files
included, no exception for `*.test.tsx`.

**Why:** the firewall is about where the CODE lives, not whether it runs in
CI as a test — a `ui/`-directory file touching `shared/db` is disallowed
regardless of intent, keeping the boundary mechanically checkable rather
than relying on reviewer judgment about "it's just a test."

**How to apply:** for a `ui/` component that owns its seam call internally,
write the test as UI-behavior-only (what's rendered, which affordance closes
it, does `Save`'s boolean result open/keep the dialog) and leave "did the
byte land in the DB" to the seam hook's own `logic/*.test.ts(x)` file (which
CAN import `shared/db` — that's where `useProfileEditor.test.tsx` already
covers persistence). Don't reach for `db` from any `*.test.tsx` under
`ui/`, even transitively through a hand-rolled seed/cleanup helper.
