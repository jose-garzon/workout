import { HttpResponse, http } from "msw";

/**
 * MSW request handlers — mock BOTH OpenRouter (the upstream the proxy route
 * calls) and the app's own `/api/generate-routine` (what the browser client
 * calls). Gives the offline/error and streaming tests a deterministic network
 * surface (design.md §6).
 */
export const handlers = [
  // Upstream: OpenRouter OpenAI-compatible chat completions.
  http.post("https://openrouter.ai/api/v1/chat/completions", () =>
    HttpResponse.json({
      choices: [{ message: { content: "{}" } }],
    }),
  ),

  // The app's own stateless proxy route (default: not-yet-implemented shell).
  http.post("/api/generate-routine", () =>
    HttpResponse.json({ error: { kind: "provider" } }, { status: 501 }),
  ),
];
