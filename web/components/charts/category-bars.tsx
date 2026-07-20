import type { CategorySpend } from "@wealth-os/types";
import { formatMoney } from "@/lib/money";

/** Fixed slot order — assigned by entity, never cycled past the end. */
const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];

const MAX_SLOTS = SERIES.length;

/**
 * Spend by category, horizontal bars.
 *
 * Two rules from the validated palette are load-bearing here:
 * 1. Never cycle hues — anything past six slots folds into a neutral "Other"
 *    rather than reusing slot 1 for a seventh category.
 * 2. Three light-mode slots sit below 3:1 contrast, which triggers the relief
 *    rule: every bar carries a visible name and amount, so the chart is fully
 *    readable without relying on the fill colour at all.
 */
export function CategoryBars({
  data,
  currency,
}: {
  data: CategorySpend[];
  currency: string;
}) {
  const sorted = [...data].sort((a, b) => b.amountMinor - a.amountMinor);
  const top = sorted.slice(0, MAX_SLOTS);
  const rest = sorted.slice(MAX_SLOTS);

  const items = rest.length
    ? [
        ...top,
        {
          categoryId: null,
          name: `Other (${rest.length})`,
          color: null,
          amountMinor: rest.reduce((sum, item) => sum + item.amountMinor, 0),
        },
      ]
    : top;

  const max = Math.max(1, ...items.map((item) => item.amountMinor));

  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={item.categoryId ?? item.name}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-[var(--text)]">{item.name}</span>
            <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
              {formatMoney(item.amountMinor, currency)}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full rounded-[4px] bg-[var(--border)]">
            <div
              className="h-2 rounded-[4px]"
              style={{
                width: `${(item.amountMinor / max) * 100}%`,
                background:
                  index >= MAX_SLOTS || item.categoryId === null
                    ? "var(--series-other)"
                    : SERIES[index],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
