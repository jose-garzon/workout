import type { MetadataRoute } from "next";

/**
 * PWA web manifest via Next's metadata API (typed, no separate JSON). Next
 * serves this at `/manifest.webmanifest` and injects the `<link>` automatically.
 *
 * Identity per design-system: dark-default gym brand. The maskable icon is an
 * SVG mark in `public/`; the designer may add raster sizes later.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "workout-pal",
    short_name: "workout-pal",
    description: "Plan and follow through on your workouts.",
    start_url: "/",
    display: "standalone",
    background_color: "#0D0D0D",
    theme_color: "#0D0D0D",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "maskable",
      },
    ],
  };
}
