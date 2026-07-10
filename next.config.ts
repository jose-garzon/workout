import path from "node:path";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: an unrelated lockfile in a parent dir otherwise makes
  // Next infer the wrong root for output file tracing.
  outputFileTracingRoot: path.join(import.meta.dirname, "."),
};

/**
 * Serwist PWA (design.md §1). Compiles `src/sw.ts` → `public/sw.js` and injects
 * the precache manifest. `globPublicPatterns` extends precaching to the
 * self-hosted fonts + icon so offline navigations render fully. The SW is
 * auto-registered (`register` defaults to true); disabled in dev for clean HMR.
 */
const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  globPublicPatterns: ["assets/fonts/**/*.woff2", "icon.svg"],
});

export default withSerwist(nextConfig);
