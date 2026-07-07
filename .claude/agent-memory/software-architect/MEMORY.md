# Software Architect — Memory Index

- [Feature-first architecture](project_feature-first-architecture.md) — workout-pal uses modules/ + shared/ DDD layering, not a flat lib/+ui split
- [Local-first constraint](project_local-first-constraint.md) — all user data in-browser (Dexie); only server code is a stateless AI proxy route
- [ESLint import firewall](reference_eslint-import-firewall.md) — the import/no-restricted-paths boundary rules that enforce local-first + feature-first
