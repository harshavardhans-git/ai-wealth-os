/**
 * Period helpers for budgets and the dashboard.
 * All boundaries are half-open [start, end) so a transaction at exactly midnight
 * on the 1st belongs to the new month, never both.
 */

export interface Period {
  start: Date;
  end: Date;
}

export function currentMonth(now = new Date()): Period {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export function monthOf(date: Date): Period {
  return currentMonth(date);
}

/** Start of the month `count - 1` months ago — used for the cash-flow window. */
export function monthsAgo(count: number, now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1), 1),
  );
}

/** "2026-07" — stable, sortable key for grouping. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
