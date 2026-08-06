# profile-page Specification (delta)

## ADDED Requirements

### Requirement: Header profile entry point

Every screen using the app shell, other than the profile surfaces themselves,
SHALL show in its header a single control that navigates to the profile page, in
the position previously occupied by the theme toggle. The header SHALL NOT contain
a theme toggle. The control SHALL expose an accessible name even though it shows
only an icon.

#### Scenario: Header shows the profile control and no theme toggle

- **GIVEN** any screen using the app shell other than the profile or edit-profile
  page
- **WHEN** the user looks at the header
- **THEN** a user-icon control is shown where the theme toggle used to be
- **AND** no theme toggle is present in the header

#### Scenario: Activating the header control opens the profile page

- **GIVEN** any screen using the app shell that shows the control
- **WHEN** the user activates the user-icon control
- **THEN** the app navigates to the profile page

#### Scenario: The control is absent on its own destination

- **GIVEN** the user is on the profile page or the edit-profile page
- **WHEN** the header is shown
- **THEN** no profile link is present in the header

#### Scenario: The icon-only control is named for assistive technology

- **WHEN** the header control is inspected by assistive technology
- **THEN** it exposes an accessible name identifying it as the profile entry point

### Requirement: Navigation controls render as visible affordances

The header profile link and both back controls SHALL each render with a visible
border, matching the app's sharp-rectangle bordered controls, so that none of them
reads as bare decoration. The edit-routine control on home is not a navigation
control and SHALL remain borderless.

#### Scenario: Each navigation control has a visible border

- **WHEN** the header profile link or either back control is shown
- **THEN** it renders with a visible border in the app's bordered-control
  treatment, with square (zero-radius) corners

### Requirement: Profile page shows the user's name, goal and an edit entry point

The profile page SHALL show, in order from the top: a title row, the user's saved
display name, a badge showing the user's saved training focus, and a control that
navigates to the edit-profile page. The display name SHALL be rendered more
prominently than the page title. That content SHALL sit directly under the title
row rather than vertically centered in the remaining space. The goal badge SHALL
be display-only and SHALL use the same treatment as the goal badge on home.
Reaching the profile page SHALL NOT require or perform any network request.

#### Scenario: Profile page contents in order

- **GIVEN** a saved profile with display name "Jose" and focus "hypertrophy"
- **WHEN** the profile page is shown
- **THEN** it displays, in order from the top: the title row, "Jose", a goal badge
  reading the user's focus, and an edit-profile control

#### Scenario: The name outranks the title visually

- **GIVEN** a saved profile with display name "Jose"
- **WHEN** the profile page is shown
- **THEN** "Jose" is rendered more prominently than the page title

#### Scenario: Content is top-aligned

- **GIVEN** the profile page
- **WHEN** it is shown on a viewport taller than its content
- **THEN** the name, goal badge and edit control sit directly under the title row,
  not vertically centered in the remaining space

#### Scenario: Edit control navigates to the edit page

- **GIVEN** the profile page
- **WHEN** the user activates the edit-profile control
- **THEN** the app navigates to the edit-profile page

### Requirement: The edit-profile entry is a card, not a primary button

The edit-profile entry SHALL be a single full-width clickable card matching the
visual pattern of home's routine-day list cards — bordered surface, not a filled
primary button. It SHALL be the only card in that section.

#### Scenario: The edit entry renders as a day-card-style card

- **GIVEN** the profile page
- **WHEN** the edit-profile section is shown
- **THEN** it is a single full-width clickable card matching the visual pattern of
  home's routine-day list cards, not a filled primary button
- **AND** it is the only card in that section

#### Scenario: Updated name is reflected after an edit

- **GIVEN** the user saved a new display name on the edit page
- **WHEN** the app returns to the profile page
- **THEN** the profile page shows the updated display name

### Requirement: Back control on the profile surfaces

The profile page and the edit-profile page SHALL each show a back control leading
their title, navigating one step back in the app's structure — from the profile
page to home, and from the edit-profile page to the profile page. The control
SHALL be icon-only and SHALL expose an accessible name.

#### Scenario: Back from the profile page goes home

- **GIVEN** the profile page
- **WHEN** the user activates the back control
- **THEN** the app navigates to home

#### Scenario: Back from the edit page goes to the profile page

- **GIVEN** the edit-profile page
- **WHEN** the user activates the back control
- **THEN** the app navigates to the profile page and nothing is persisted

#### Scenario: The back control is named for assistive technology

- **GIVEN** the profile page or the edit-profile page
- **WHEN** the back control is inspected by assistive technology
- **THEN** it exposes an accessible name identifying it as a back control

### Requirement: Personal settings row pinned at the bottom

The profile page SHALL show, pinned at the bottom of the screen, one row
containing exactly two controls — the theme toggle and the language toggle —
side by side, each occupying half the row's width.

#### Scenario: The row holds exactly two controls at 50% each

- **GIVEN** the profile page
- **WHEN** the settings row is shown
- **THEN** it contains exactly two controls, the theme toggle and the language
  toggle
- **AND** the two sit side by side in one row, each occupying 50% of the row width

### Requirement: The theme toggle lives only on the profile page

The theme toggle SHALL be reachable only from the profile page, and its behaviour
SHALL be unchanged — dark by default, a manual choice persisted on-device and
applied on the first paint after a reload with no flash of the other theme.

#### Scenario: Toggling and reloading keeps the chosen theme with no flash

- **GIVEN** the profile page
- **WHEN** the user toggles to the light theme and reloads the app
- **THEN** the app renders in light theme on first paint, with no flash of the
  dark theme

#### Scenario: No other screen offers a theme toggle

- **GIVEN** any screen other than the profile page
- **WHEN** the screen is shown
- **THEN** no theme toggle is present on it

### Requirement: Language toggle on the profile page

The profile page SHALL offer a two-state language control using the same visual
treatment as the theme toggle — no dropdown and no options list to open. It SHALL
show the language currently in effect as its active state, and a single activation
SHALL switch to the other supported language and apply it to the visible UI
immediately without a reload. The control SHALL expose an accessible name stating
the language it switches to.

#### Scenario: The toggle shows the language in effect

- **GIVEN** a browser preferring English and no language chosen yet
- **WHEN** the profile page is shown
- **THEN** the language control is a two-state toggle showing English as its
  active state, with no dropdown and no options list to open

#### Scenario: Activating the toggle switches the UI immediately

- **GIVEN** the profile page with English in effect
- **WHEN** the user activates the language toggle
- **THEN** its state flips to Spanish and the visible UI copy switches to Spanish
  without a reload

#### Scenario: The toggle is named for assistive technology

- **GIVEN** the profile page with English in effect
- **WHEN** the language toggle is inspected by assistive technology
- **THEN** it exposes an accessible name stating that it switches to Spanish
