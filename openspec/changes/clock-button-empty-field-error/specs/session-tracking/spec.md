# session-tracking Delta

## MODIFIED Requirements

### Requirement: A completed session records its date and a per-series record for each exercise

A completed session MUST record its date and, for each exercise worked, a per-series record: one entry per completed set holding that set's reps, weight, work time, and volume (weight × reps), plus the exercise's total rest time as an aggregate.

Each set's reps — and therefore its volume — MUST be the reps the user confirmed for that set, and MUST NOT be plan-derived. The routine's reps for a set index are a PREFILL for the reps field, never the record: a set cannot start until the field holds a value, and the field is locked while the set runs, so the value recorded is always one the user confirmed for that set.

#### Scenario: Finishing a session writes a per-series record

- **GIVEN** the user completes every exercise in a day's session
- **WHEN** the session ends
- **THEN** a completed-session record is stored holding the session date and, per exercise, a `series[]` array with one entry per completed set — each carrying that set's reps, weight, work time, and volume — plus the exercise's total rest time

#### Scenario: Each set records the reps the user confirmed

- **GIVEN** a set whose plan prescribes 12 reps, and the user enters 10 reps at 40 kg
- **WHEN** the set is completed
- **THEN** the stored set records 10 reps and a volume of 400 kg (10 × 40) — the confirmed reps, never the planned 12

#### Scenario: No set is ever recorded with plan-derived reps

- **GIVEN** the start gate requires a non-empty reps field
- **WHEN** any set in any session is completed
- **THEN** its stored reps are a value the user confirmed for that set, and no code path records the plan's reps for that set index
