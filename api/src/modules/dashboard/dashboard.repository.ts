import { prisma } from "../../lib/prisma";

/**
 * Dashboard aggregates (Ch 7 §7.7) — hand-written SQL rather than ORM helpers,
 * because these are the queries that must be exactly right and are worth reading.
 *
 * THE critical invariant in every query here: `type IN ('income','expense')`
 * excludes transfers. A transfer moves money between your own accounts — counting
 * it as spend would inflate every total (Ch 5 R3, guarded by a test in Ch 13).
 *
 * All sums use `amount_base_minor`, the value converted to the user's reporting
 * currency at capture time (Ch 5 §5.5), so mixed-currency accounts still add up.
 */
export const dashboardRepository = {
  monthTotals: (userId: string, start: Date, end: Date) =>
    prisma.$queryRaw<Array<{ type: string; total: bigint }>>`
      SELECT type, COALESCE(SUM(amount_base_minor), 0) AS total
      FROM transactions
      WHERE user_id = ${userId}::uuid
        AND deleted_at IS NULL
        AND type IN ('income', 'expense')
        AND occurred_at >= ${start}
        AND occurred_at <  ${end}
      GROUP BY type
    `,

  spendByCategory: (userId: string, start: Date, end: Date) =>
    prisma.$queryRaw<
      Array<{
        category_id: string | null;
        name: string | null;
        color: string | null;
        total: bigint;
      }>
    >`
      SELECT t.category_id, c.name, c.color,
             COALESCE(SUM(t.amount_base_minor), 0) AS total
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId}::uuid
        AND t.deleted_at IS NULL
        AND t.type = 'expense'
        AND t.occurred_at >= ${start}
        AND t.occurred_at <  ${end}
      GROUP BY t.category_id, c.name, c.color
      ORDER BY total DESC
    `,

  cashFlowByMonth: (userId: string, since: Date) =>
    prisma.$queryRaw<
      Array<{ month: Date; income: bigint; expense: bigint }>
    >`
      SELECT date_trunc('month', occurred_at) AS month,
             COALESCE(SUM(CASE WHEN type = 'income'  THEN amount_base_minor ELSE 0 END), 0) AS income,
             COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_base_minor ELSE 0 END), 0) AS expense
      FROM transactions
      WHERE user_id = ${userId}::uuid
        AND deleted_at IS NULL
        AND type IN ('income', 'expense')
        AND occurred_at >= ${since}
      GROUP BY 1
      ORDER BY 1
    `,

  /** Spend per category within a window — the input to budget progress. */
  spendPerCategory: (userId: string, start: Date, end: Date) =>
    prisma.$queryRaw<Array<{ category_id: string; total: bigint }>>`
      SELECT category_id, COALESCE(SUM(amount_base_minor), 0) AS total
      FROM transactions
      WHERE user_id = ${userId}::uuid
        AND deleted_at IS NULL
        AND type = 'expense'
        AND category_id IS NOT NULL
        AND occurred_at >= ${start}
        AND occurred_at <  ${end}
      GROUP BY category_id
    `,
};
