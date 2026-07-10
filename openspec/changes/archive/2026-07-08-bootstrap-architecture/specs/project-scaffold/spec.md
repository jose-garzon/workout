# project-scaffold

Foundation scaffold: the app boots and the feature/shared structure exists as
empty skeletons with the layer shape and seam-hook stubs. *How* is specified in
[`design.md`](../../design.md) §1, §3, §4 — this spec states only *what*.

## ADDED Requirements

### Requirement: Application boots via Bun

The application SHALL boot as a Next.js 15 App Router app on React 19 with
TypeScript in strict mode, installed and run using **Bun**, with no build or
type errors from a clean checkout.

#### Scenario: Clean checkout builds and starts

- **WHEN** the app is installed and started with Bun from a clean checkout
- **THEN** the Next.js 15 App Router app starts with React 19 under TypeScript
  strict mode, producing no build errors and no type errors

### Requirement: Feature and shared structure exists with the layer shape

The source tree SHALL contain the four `modules/<feature>` skeletons
(`profile-goals`, `routine-generation`, `workout-mode`, `calendar`) and
`shared/db` + `shared/ui`. Each feature SHALL carry the layered shape
`ui/ → logic/ → api/ → types.ts` and expose a public `index.ts` barrel; the
feature's inner layers SHALL be reachable from outside only through that barrel.

#### Scenario: Four feature skeletons and shared modules present

- **WHEN** the `src/` tree is inspected
- **THEN** `modules/profile-goals`, `modules/routine-generation`,
  `modules/workout-mode`, and `modules/calendar` each exist with `ui/`,
  `logic/`, `api/`, `types.ts`, and `index.ts`, and `shared/db` and `shared/ui`
  exist

#### Scenario: Feature internals are exposed only through the barrel

- **WHEN** a feature's public surface is examined
- **THEN** its seam hooks and public types are re-exported through its
  `index.ts`, and the `ui/`, `logic/`, `api/`, and `types.ts` members are not
  otherwise exported for outside consumption

### Requirement: Seam-hook stubs match the design signatures

Each feature SHALL provide stub implementations of its seam hooks whose
signatures match `design.md` §4 exactly, so both builders can compile against a
stable contract before feature logic exists.

#### Scenario: Seam-hook signatures match design §4

- **WHEN** the seam-hook stubs are type-checked
- **THEN** `useProfile`, `useRoutineGeneration`, `useWorkoutSession`,
  `useRestTimer`, `useCalendar`, and `useTheme` compile with the exact
  signatures defined in `design.md` §4
