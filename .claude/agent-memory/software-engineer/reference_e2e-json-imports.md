---
name: e2e-json-imports
description: Playwright specs importing a JSON dictionary need `with { type: "json" }` — plain `import en from "...json"` throws at collection time ("No tests found")
metadata:
  type: reference
---

Playwright's ESM loader rejects a bare JSON import in an `e2e/*.spec.ts`:

```
TypeError: Module ".../en.json" needs an import attribute of "type: json"
Error: No tests found.
```

The failure is a **collection** error, not a test failure, so the whole file
vanishes from the run and the message about "No tests found" is what you notice.
Fix: `import en from "../src/shared/i18n/en.json" with { type: "json" };`
(tsc accepts it — `module: "esnext"` + `resolveJsonModule`; Vitest/Next do not
need the attribute, only Playwright).

Why it comes up: asserting on i18n copy in e2e is best done by reading the value
out of `en.json`/`es.json` rather than repeating the literal, so the spec cannot
drift from the dictionary. See [[e2e-dev-server-reuse]] and
[[e2e-theme-color-scheme]] for the other gate gotchas here.
