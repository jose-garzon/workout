# profile-persistence

## MODIFIED Requirements

### Requirement: Profile and goals persist to IndexedDB without a network call

Completing onboarding SHALL persist a Profile record and a Goals record to
IndexedDB on the device. Editing the saved profile SHALL overwrite the existing
Profile and Goals records in place (the same singleton). Neither the first write
nor a later update SHALL make any network request.

#### Scenario: Finishing onboarding writes Profile and Goals locally

- **GIVEN** the user completes onboarding with valid required fields
- **WHEN** the finish action is activated
- **THEN** a Profile record and a Goals record are written to IndexedDB and no
  network request is made

#### Scenario: Editing updates the existing records locally

- **GIVEN** a device with an already-saved Profile and Goals
- **WHEN** the user saves edited values
- **THEN** the existing Profile and Goals records are overwritten in IndexedDB
  with the new values and no network request is made
