# ai-proxy-route

## Purpose

The stateless AI proxy route as a scaffolded shell — the firewall around it is
proven, but no generation logic ships in this change.

## Requirements

### Requirement: Stateless AI proxy route shell exists

The route `app/api/generate-routine/route.ts` SHALL exist as a stateless shell
that reads no store and writes no store and keeps nothing between requests. It
SHALL NOT contain real routine-generation logic in this change.

#### Scenario: Route shell is present and stateless

- **WHEN** `app/api/generate-routine/route.ts` is inspected
- **THEN** it exists as a shell that performs no persistence and holds no state
  across requests, with no routine-generation logic implemented

### Requirement: Proxy route imports only the server-safe AI subset

The proxy route SHALL import only
`modules/routine-generation/api/ai/{prompt,schema,errors}`. It MUST NOT import
`@/shared/db`, any `*Repo`, or the browser-side `api/ai/client`.

#### Scenario: Route restricted to the server-safe AI modules

- **WHEN** the firewall checks run against the proxy route's imports
- **THEN** imports of `@/shared/db`, any `*Repo`, or `api/ai/client` fail, and
  only `modules/routine-generation/api/ai/{prompt,schema,errors}` is permitted
