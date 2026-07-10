import { handleGenerateRoutine } from "@/modules/routine-generation/api/ai/openrouter";

/**
 * The ONE server-side route: a STATELESS OpenRouter proxy. Thin by design — the
 * app layer only wires; the work lives in the module
 * (`modules/routine-generation/api/ai/openrouter`).
 *
 * Firewall rule 4 (security-load-bearing, Biome-enforced): this route may import
 * ONLY `modules/routine-generation/api/ai/*` (prompt/schema/errors/openrouter).
 * It must never import `shared/db`, any `*Repo`, or `api/ai/client` — the
 * persistence layer is browser-only and the server never touches user data
 * (design.md §0/§2). `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` are read from
 * server env inside the service, never `NEXT_PUBLIC_*`, so neither the key nor
 * the model id ever reaches the client bundle.
 */
export function POST(request: Request): Promise<Response> {
  return handleGenerateRoutine(request);
}
