import type { ReactNode } from "react";

/**
 * A small inline label (Ch 11 §11.3) — provenance, transfer direction, status.
 *
 * `title` is optional context, never the only carrier of meaning: the visible
 * text always says enough on its own, because a tooltip is unreachable by touch
 * and inconsistently announced by screen readers.
 */
export function Badge({
  children,
  title,
  tone = "neutral",
}: {
  children: ReactNode;
  title?: string;
  tone?: "neutral" | "accent";
}) {
  const tones = {
    neutral: "border-[var(--border)] text-[var(--text-muted)]",
    accent: "border-[var(--primary)] text-[var(--primary)]",
  };

  return (
    <span
      title={title}
      className={`ml-2 inline-block whitespace-nowrap rounded-[var(--radius-sm)] border px-1.5 py-0.5 align-middle text-[10px] uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
