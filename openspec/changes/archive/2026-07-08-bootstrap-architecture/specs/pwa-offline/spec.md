# pwa-offline

The PWA offline baseline: the shell and all data screens work offline; only
routine generation needs the network. *How* (Serwist service worker, precache)
is specified in [`design.md`](../../design.md) §1. This spec states only *what*.

## ADDED Requirements

### Requirement: App shell and data screens work offline

The app SHALL be installable as a PWA whose service worker caches the app shell
and static assets. When the device is offline, the app shell and every data
screen SHALL remain usable.

#### Scenario: Data screens usable with no network

- **WHEN** the installed PWA is opened offline
- **THEN** the app shell loads and every data screen is usable without a network
  connection

### Requirement: Only routine generation requires the network

Routine generation SHALL be the only capability that requires network access.
When offline, it SHALL surface the offline error rather than crash; all other
functionality SHALL remain available.

#### Scenario: Generation surfaces the offline error

- **WHEN** the user attempts routine generation while offline
- **THEN** the offline error is surfaced, no crash occurs, and all non-generation
  screens remain usable
