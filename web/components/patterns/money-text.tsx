import { formatMoney } from "@/lib/money";

interface MoneyTextProps {
  amountMinor: number;
  currency?: string;
  /** Drives the sign and colour. Transfers stay neutral. */
  type?: "income" | "expense" | "transfer";
  className?: string;
}

/**
 * The single place money is rendered (Ch 11 §11.3) — the UI edge of the
 * integer-minor-units rule.
 *
 * Accessibility: the +/− sign is always rendered, so meaning is never conveyed by
 * colour alone (~8% of men cannot distinguish red/green) — Ch 11 §11.6.
 */
export function MoneyText({
  amountMinor,
  currency = "INR",
  type,
  className = "",
}: MoneyTextProps) {
  const sign = type === "income" ? "+" : type === "expense" ? "−" : "";

  const tone =
    type === "income"
      ? "text-[var(--positive)]"
      : type === "expense"
        ? "text-[var(--negative)]"
        : "text-[var(--text)]";

  return (
    <span className={`tabular-nums font-medium ${tone} ${className}`}>
      {sign}
      {formatMoney(amountMinor, currency)}
    </span>
  );
}
