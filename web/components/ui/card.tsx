import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
      <h2 className="text-sm font-medium text-[var(--text)]">{title}</h2>
      {action}
    </header>
  );
}

/** The four states every screen owes the user (Ch 4 §4.7, Ch 8 §8.6). */
export function EmptyState({ message }: { message: string }) {
  return (
    <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
      {message}
    </p>
  );
}

export function LoadingState() {
  return (
    <div className="space-y-2 px-5 py-5">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="h-9 animate-pulse rounded-[var(--radius-sm)] bg-[var(--border)]"
        />
      ))}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p className="px-5 py-10 text-center text-sm text-[var(--negative)]">
      {message}
    </p>
  );
}
