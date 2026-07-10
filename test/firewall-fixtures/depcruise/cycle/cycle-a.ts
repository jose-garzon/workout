// FIREWALL FIXTURE — no-circular. Same-feature cycle (isolates the cycle rule
// from the cross-feature rule). MUST make `depcruise` report `no-circular`.
import { bValue } from "@/modules/__fixture_alpha__/logic/cycle-b";

export const aValue = `a:${bValue}`;
