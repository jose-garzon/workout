// FIREWALL FIXTURE — rule 4 (server firewall), the ALLOWED case. A route importing
// only the server-safe AI modules (prompt/schema/errors) MUST pass `biome check`.
import { toAiError } from "@/modules/routine-generation/api/ai/errors";
import { buildPrompt } from "@/modules/routine-generation/api/ai/prompt";
import { routineSchema } from "@/modules/routine-generation/api/ai/schema";

export async function POST(): Promise<Response> {
  return Response.json({
    ok: [buildPrompt, routineSchema, toAiError].length,
  });
}
