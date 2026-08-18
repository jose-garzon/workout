---
name: dont-underweight-literal-asks-in-critique
description: When self-critique surfaces an issue that maps directly to a word in the user's original request, treat it as a requirement gap, not optional polish
metadata:
  type: feedback
---

On `clock-button-empty-field-error`, the original ask was literally "I want to see the
empty field in an error state: **red focus** and red label." I built the red label but
left the focus ring accent-yellow (the global `--focus-ring` token, unconditional in
`Input.tsx`), and my own design-critique pass *found* this — noted it as "the focus ring
visually eclipses the red border" — then filed it as optional polish because the border
still existed underneath and other signals (label, caption) were non-color. The
coordinator sent it back: it's not polish, it's the literal ask, and it's worse than a
transient edge case because this specific change autofocuses the errored field, so the
eclipsed frame is *the* frame the user sees at the moment they tap the clock.

**Why:** a critique finding that directly restates a word from the user's own request
("red focus") is not a judgment call about severity — it's an unmet requirement wearing
a critique's clothing. Weighing it against "is this technically WCAG-compliant without
the fix" (which it was, via non-color signals) is the wrong test; the test is "does the
literal ask hold."

**How to apply:** before closing a design-critique finding as "polish, not acted on,"
re-read it against the ORIGINAL request's literal wording. If a finding echoes specific
language the user used (a color, a state, an element named), escalate it and either fix
it or flag it explicitly for confirmation — don't self-resolve it as acceptable because
redundant signals technically cover accessibility. Accessibility-adequate and
request-adequate are different bars.

Fix pattern for "swap only the danger color, keep geometry": add a parallel
`--focus-ring-danger` token next to the existing `--focus-ring` in `tokens.css`,
defined for BOTH themes (light/dark colors differ), same 2px-inner/4px-outer box-shadow
shape, outer stroke only swapped to `--color-danger-text`. Apply conditionally in the
primitive (`error ? ...danger : ...normal`) rather than overriding globally — every
other consumer of the primitive must keep the unconditional accent ring untouched.

See [[project_i18n-spanish-ui-pass]] for the broader pattern of "component gets a new
conditional variant of an existing token, not a bespoke one."
