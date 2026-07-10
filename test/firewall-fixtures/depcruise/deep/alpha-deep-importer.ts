// FIREWALL FIXTURE — rule 3 (cross-feature barrel-only). Feature "alpha" reaches
// into feature "beta"'s internal logic/ path instead of its index.ts barrel.
// MUST make `depcruise` report a `cross-feature-barrel-only` violation.
import { internalThing } from "@/modules/__fixture_beta__/logic/internal";

export const usesInternal = internalThing;
