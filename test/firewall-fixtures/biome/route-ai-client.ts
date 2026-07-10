// FIREWALL FIXTURE — rule 4 (server firewall). A route importing the browser
// fetch client (api/ai/client) MUST make `biome check` error. Not part of the build.
import { generateRoutine } from "@/modules/routine-generation/api/ai/client";

export async function POST(): Promise<Response> {
  return Response.json({ ok: Boolean(generateRoutine) });
}
