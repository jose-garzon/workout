# profile-persistence

Onboarding results persist locally so the user is never asked twice on this
device. Local-first: data stays in the browser and no user data leaves the
device. This spec states only *what*.

## ADDED Requirements

### Requirement: Profile and goals persist to IndexedDB without a network call

Completing onboarding SHALL persist a Profile record and a Goals record to
IndexedDB on the device. Saving the profile SHALL NOT make any network request.

#### Scenario: Finishing onboarding writes Profile and Goals locally

- **GIVEN** the user completes onboarding with valid required fields
- **WHEN** the finish action is activated
- **THEN** a Profile record and a Goals record are written to IndexedDB and no
  network request is made

### Requirement: Saved profile survives reload

Persisted Profile and Goals values SHALL remain available after the browser is
reloaded or reopened on the same device.

#### Scenario: Saved values are present after a reload

- **GIVEN** a completed onboarding whose Profile and Goals were saved
- **WHEN** the browser is fully reloaded or reopened
- **THEN** the saved Profile and Goals values are still present
