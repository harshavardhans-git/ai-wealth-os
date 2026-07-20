import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--primary)] text-[var(--primary-contrast)] hover:opacity-90",
  secondary:
    "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)]",
  ghost: "text-[var(--text-muted)] hover:text-[var(--text)]",
  danger: "text-[var(--negative)] hover:underline",
};

/** Primitive (Ch 11 §11.3): knows about tokens, knows nothing about finance. */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
