// FIREWALL FIXTURE — rule 4 (server firewall). A route importing the browser-only
// persistence layer MUST make `biome check` error. Not part of the build.
import { db } from "@/shared/db";

export async function POST(): Promise<Response> {
  return Response.json({ ok: Boolean(db) });
}
