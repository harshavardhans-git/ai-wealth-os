import type { BudgetWithProgress } from "@wealth-os/types";
import { formatMoney } from "@/lib/money";

/**
 * A budget's live progress (Ch 3 DoD item 6).
 *
 * Over-budget is signalled by an icon AND a worded caption, not just a red bar —
 * the same "never encode meaning by colour alone" rule as MoneyText (Ch 11 §11.6).
 * `role="meter"` gives screen readers the value directly.
 */
export function BudgetMeter({
  budget,
  currency,
}: {
  budget: BudgetWithProgress;
  currency: string;
}) {
  const isOver = budget.percentUsed > 100;
  const isNear = !isOver && budget.percentUsed >= 90;
  const width = Math.min(100, Math.max(0, budget.percentUsed));

  const fill = isOver
    ? "var(--negative)"
    : isNear
      ? "var(--warning)"
      : "var(--primary)";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-medium">{budget.categoryName}</span>
        <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
          {formatMoney(budget.spentMinor, currency)} /{" "}
          {formatMoney(budget.amountMinor, currency)}
        </span>
      </div>

      <div
        role="meter"
        aria-valuenow={budget.percentUsed}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${budget.categoryName} budget`}
        className="mt-1.5 h-2 w-full rounded-[4px] bg-[var(--border)]"
      >
        <div
          className="h-2 rounded-[4px] transition-[width]"
          style={{ width: `${width}%`, background: fill }}
        />
      </div>

      <p className="mt-1.5 text-xs text-[var(--text-muted)]">
        {isOver ? (
          <span className="text-[var(--negative)]">
            ⚠ Over by {formatMoney(budget.spentMinor - budget.amountMinor, currency)}
          </span>
        ) : (
          <>
            {budget.percentUsed}% used ·{" "}
            {formatMoney(budget.remainingMinor, currency)} left
          </>
        )}
      </p>
    </div>
  );
}
