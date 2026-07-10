# local-first-persistence

## Purpose

The local-first base: all user data lives in the browser, secrets stay
server-side.

## Requirements

### Requirement: No server-side persistence of user data

The application SHALL persist all user data exclusively in the browser
(IndexedDB via Dexie). No server component, route, or process SHALL read or
write user data. The `shared/db` Dexie instance SHALL be browser-only and MUST
NOT be importable by server code.

#### Scenario: All user data lives in the browser

- **WHEN** the running app's persistence surface is inspected
- **THEN** user data is written only to browser IndexedDB via Dexie, and no
  server-side store holds user data

#### Scenario: shared/db is not server-importable

- **WHEN** the firewall checks run against server code that imports `@/shared/db`
- **THEN** the check fails, confirming the Dexie instance is browser-only

### Requirement: AI provider secrets are server-only

`OPENROUTER_API_KEY` and `OPENROUTER_MODEL` SHALL be server-only environment
variables. They MUST NOT be prefixed `NEXT_PUBLIC_` and MUST NOT be shipped to
or readable by the client.

#### Scenario: Secrets never reach the client bundle

- **WHEN** the client bundle and environment configuration are inspected
- **THEN** `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are present only
  server-side, are not `NEXT_PUBLIC_*`, and do not appear in client-shipped code
