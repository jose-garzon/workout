# Software Architect — Memory Index

- [Feature-first architecture](project_feature-first-architecture.md) — workout-pal uses modules/ + shared/ DDD layering, not a flat lib/+ui split
- [Local-first constraint](project_local-first-constraint.md) — all user data in-browser (Dexie); only server code is a stateless AI proxy route
- [Import firewall](reference_import-firewall.md) — Biome + depcruise boundary rules; they're forbid-lists, so a new shared/ slice needs no config change
- [Cross-feature session reads](project_cross-feature-session-reads.md) — own repo vs composition-layer prop; B must never import D; `routine.id` is always "active"
- [OpenSpec delta renames](reference_openspec-delta-rename.md) — RENAMED FROM/TO + MODIFIED under the NEW header; apply order is RENAMED→REMOVED→MODIFIED→ADDED
- [useLiveQuery stale deps](reference_uselivequery-stale-deps.md) — it serves the PREVIOUS result after a deps change; stamp results or a seam hook paints fabricated data
