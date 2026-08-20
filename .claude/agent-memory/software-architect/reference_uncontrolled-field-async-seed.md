---
name: uncontrolled-field-async-seed
description: Inputs in this repo that keep local text state re-seed only via a React `key`; an async prefill landing after mount is invisible unless the seam exposes a remount key
metadata:
  type: reference
---

Several inputs here are deliberately **uncontrolled-ish**: local `useState(text)`
seeded once at mount, re-seeded only by a `key` prop (`WeightField` in
`modules/workout-mode/ui/ExerciseView.tsx`, `Composer`'s prefill in
routine-generation). The reason is real — a controlled `value={String(n)}`
binding fights the user mid-decimal ("37." round-trips to "37").

**Consequence to design around:** any value that arrives *asynchronously* (an
IndexedDB lookup, a repo seed) after that mount will never reach the input, even
though the seam state holds it. The UI looks empty while logic thinks it is
filled.

**Fix pattern:** the seam exposes an opaque `seedKey`/stamp string that changes
**only** when logic commits a new value — never on a user edit — and the UI uses
it as the field's `key`. Deriving the key from the value itself remounts on every
keystroke and steals focus.

Same failure family as [[uselivequery-stale-deps]]: async data landing out of step
with what is already painted. Verify by asserting the **rendered input value**,
not the hook's return value — a seam-level test passes while the screen is blank.
