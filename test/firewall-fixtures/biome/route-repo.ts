// FIREWALL FIXTURE — rule 4 (server firewall). A route importing any *Repo
// (browser-only persistence) MUST make `biome check` error. Not part of the build.
import { routineRepo } from "@/modules/routine-generation/api/routineRepo";

export async function POST(): Promise<Response> {
  return Response.json({ ok: Boolean(routineRepo) });
}
