---
name: feedback-accessible-name-substring-collisions
description: getByRole name matching is substring/case-insensitive by default — a new button's name can silently collide with an unrelated existing one across features
metadata:
  type: feedback
---

Adding an icon-only "Edit profile" button (identity block, edit-profile
change) broke `e2e/edit-routine.spec.ts`'s `getByRole("button", { name:
"Edit" })` — both Playwright's and RTL's default `name` matching for
`getByRole` is substring + case-insensitive, so "Edit profile" satisfies a
query for "Edit" too, and when both buttons are on screen simultaneously
(any user past onboarding with an active routine) the query becomes
ambiguous and throws a strict-mode violation.

**Why:** this project already has one documented instance of the same class
of bug (`e2e/edit-profile.spec.ts`'s own comment: "Male"/"Female" — a
substring match on "Male" also hits "Female"). It's a recurring hazard, not
a one-off.

**How to apply:** before naming a new interactive control (aria-label or
visible text), grep the codebase's other accessible names (`grep -rn
'aria-label\|getByRole.*name:' e2e/ src/`) for substrings of the candidate
name, especially generic ones ("Edit", "Close", "Save", "Add"). If a
collision is possible and both controls can appear on screen together, keep
the new name literally distinct (not just a superset string), OR fix the
*other* test's query to `exact: true` if the new name is the more specific
one and out-of-scope for a rename. Either way, verify by running the full
e2e suite once (not just the new spec) before calling a change done — this
is exactly the kind of regression a single-spec run won't catch.
