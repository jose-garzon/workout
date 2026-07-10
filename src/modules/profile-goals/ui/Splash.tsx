/**
 * Neutral boot frame (design.md §4.2) — deliberately NOT an onboarding or
 * home frame, so returning users never see a flash of the wrong screen.
 * Must render identically wherever it's mounted: the server's `ssr:false`
 * fallback (app/page.tsx, T1) and `FirstRunGate`'s own `status:'loading'`
 * branch both use this exact component, so the client's first paint always
 * matches the prerendered HTML and there's nothing for React to reconcile
 * at hydration (no props, no client-only APIs — safe to import from a
 * server file).
 *
 * Static — no motion, no spinner (design-system.md §1 "Silence is a valid
 * state": a screen that isn't reporting anything the user can act on stays
 * still; §2 "Loading" — the one honest exception to "no spinners" is AI
 * generation, not a local, sub-100ms IndexedDB read).
 */
export function Splash() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col items-center justify-center bg-background">
      <p className="text-micro text-text-muted">workout-pal</p>
    </div>
  );
}
