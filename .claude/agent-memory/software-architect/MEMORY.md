# Software Architect — Memory Index

- [Feature-first architecture](project_feature-first-architecture.md) — workout-pal uses modules/ + shared/ DDD layering, not a flat lib/+ui split
- [Local-first constraint](project_local-first-constraint.md) — all user data in-browser (Dexie); only server code is a stateless AI proxy route
- [Import firewall](reference_import-firewall.md) — Biome + depcruise boundary rules; they're forbid-lists, so a new shared/ slice needs no config change
