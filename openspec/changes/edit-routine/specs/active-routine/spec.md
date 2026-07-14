# active-routine Specification (delta)

## REMOVED Requirements

### Requirement: Replacing an existing routine requires explicit confirmation

**Reason:** Editing replaces regeneration as the single post-creation path to
change a routine. With no regenerate-while-a-routine-exists flow, there is no
"Replace your routine?" confirmation to gate — an edit is user-authored,
targeted, and applies in place (the user sees the before behind the editor and
the after in place), so the confirmation this requirement guarded no longer has a
trigger.

**Migration:** To change an existing routine, use the edit editor
(`routine-editing` capability): the edit button next to the routine title opens a
floating editor that sends the current routine plus a free-text instruction to
the AI and applies the targeted result directly. Broad changes ("replace with a
5-day PPL") are expressed as edit instructions and apply the same way. The
"First generated routine is adopted and persisted" and "Exactly one active
routine" requirements are unchanged: the first routine still adopts
frictionlessly, and an applied edit overwrites the single active routine.
