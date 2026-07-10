/**
 * AI failure taxonomy — a discriminated union so the UI renders a specific,
 * human message (never a raw technical string). Server-safe: pure, no Dexie.
 * Design.md §4 "Error handling".
 */
export type AiError =
  | { kind: "offline" } // "You're offline — generation needs a connection"
  | { kind: "network" } // "Couldn't reach the generator. Retry."
  | { kind: "rate-limit" } // "Too many requests. Wait a moment."
  | { kind: "parse" } // "The AI returned something unexpected. Regenerate."
  | { kind: "provider" }; // "The generator had a problem. Try again."

/** Map an HTTP status from the proxy route to an {@link AiError}. */
export function aiErrorForStatus(status: number): AiError {
  if (status === 429) return { kind: "rate-limit" };
  if (status === 400 || status === 422) return { kind: "parse" };
  return { kind: "provider" };
}
