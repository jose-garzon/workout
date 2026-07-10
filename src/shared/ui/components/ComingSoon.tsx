/**
 * Shared "not built yet" panel — foundation scope only. Every feature screen
 * is currently backed by a seam-hook stub that throws (design.md §7:
 * real logic lands in later feature changes A/B/D/C); this is the honest,
 * calm placeholder every feature's ErrorBoundary fallback renders instead of
 * a raw crash. Not one of the product's real four states (loading / empty /
 * error / success) — those get built per-feature once there's real data to
 * represent them.
 */
export interface ComingSoonProps {
  title: string;
  description: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col gap-[var(--space-3)] border border-border bg-surface p-[var(--space-6)]">
      <p className="text-title-3">{title}</p>
      <p className="text-caption text-text-muted">{description}</p>
    </div>
  );
}
