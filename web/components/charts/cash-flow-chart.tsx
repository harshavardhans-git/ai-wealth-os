import type { CashFlowPoint } from "@wealth-os/types";
import { formatMoney } from "@/lib/money";

/**
 * Six-month income vs expense, grouped bars.
 *
 * Colour: blue/orange from the validated categorical palette — NOT our semantic
 * green/red, which failed colour-blind separation (deutan ΔE 4.4 vs a target of
 * 8). A legend is always present, so identity never depends on colour alone.
 *
 * One y-scale for both series (same unit, same axis) — never a dual axis.
 */
export function CashFlowChart({
  data,
  currency,
}: {
  data: CashFlowPoint[];
  currency: string;
}) {
  const max = Math.max(
    1,
    ...data.flatMap((point) => [point.incomeMinor, point.expenseMinor]),
  );

  const monthLabel = (key: string) =>
    new Date(`${key}-01T00:00:00Z`).toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC",
    });

  return (
    <div>
      <div aria-hidden className="mb-4 flex gap-4 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <i
            aria-hidden
            className="h-2.5 w-2.5 rounded-[2px] bg-[var(--chart-income)]"
          />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <i
            aria-hidden
            className="h-2.5 w-2.5 rounded-[2px] bg-[var(--chart-expense)]"
          />
          Expense
        </span>
      </div>

      {/* The dataviz method's "a table view exists" relief: bars built from divs
          are invisible to a screen reader, so the same numbers are also available
          as a real table, hidden visually but fully readable. */}
      <table className="sr-only">
        <caption>Income and expense for the last six months</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Income</th>
            <th scope="col">Expense</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.month}>
              <th scope="row">{monthLabel(point.month)}</th>
              <td>{formatMoney(point.incomeMinor, currency)}</td>
              <td>{formatMoney(point.expenseMinor, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div aria-hidden className="flex h-40 items-end gap-3">
        {data.map((point) => (
          <div
            key={point.month}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            {/* gap-0.5 = the 2px surface gap between adjacent fills */}
            <div className="flex h-full w-full items-end justify-center gap-0.5">
              <div
                title={`Income · ${formatMoney(point.incomeMinor, currency)}`}
                className="w-1/2 rounded-t-[4px] bg-[var(--chart-income)]"
                style={{
                  height: `${(point.incomeMinor / max) * 100}%`,
                  minHeight: point.incomeMinor > 0 ? 2 : 0,
                }}
              />
              <div
                title={`Expense · ${formatMoney(point.expenseMinor, currency)}`}
                className="w-1/2 rounded-t-[4px] bg-[var(--chart-expense)]"
                style={{
                  height: `${(point.expenseMinor / max) * 100}%`,
                  minHeight: point.expenseMinor > 0 ? 2 : 0,
                }}
              />
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">
              {monthLabel(point.month)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
