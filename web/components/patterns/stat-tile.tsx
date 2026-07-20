import type { ReactNode } from "react";

/**
 * A headline number. Per the data-viz form heuristic, a single value is a stat
 * tile — not a chart. No plot means no hover layer needed.
 */
export function StatTile({
  label,
  value,
  caption,
}: {
  label: string;
  value: ReactNode;
  caption?: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {caption && (
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{caption}</p>
      )}
    </div>
  );
}
