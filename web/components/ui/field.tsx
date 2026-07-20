import type { ComponentProps, ReactNode } from "react";

const CONTROL =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--primary)]";

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[var(--text)]"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

/** ComponentProps (not InputHTMLAttributes) so `ref` is a valid prop — React 19
 *  passes refs to function components directly, no forwardRef needed. */
export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${CONTROL} ${className}`} {...props} />;
}
