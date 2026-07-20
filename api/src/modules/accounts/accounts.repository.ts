import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

/**
 * All account data access. EVERY query is scoped by userId (Ch 5 D3) and excludes
 * soft-deleted rows (D4) — enforced here so no route can forget it.
 */
export const accountsRepository = {
  listForUser: (userId: string) =>
    prisma.account.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    }),

  findByIdForUser: (id: string, userId: string) =>
    prisma.account.findFirst({ where: { id, userId, deletedAt: null } }),

  create: (
    userId: string,
    data: {
      name: string;
      type: string;
      currency: string;
      openingBalanceMinor: bigint;
    },
  ) => prisma.account.create({ data: { ...data, userId } }),

  /** updateMany returns a count — 0 means "not yours or not found" → 404. */
  updateForUser: (id: string, userId: string, data: Prisma.AccountUpdateManyMutationInput) =>
    prisma.account.updateMany({ where: { id, userId, deletedAt: null }, data }),

  softDeleteForUser: (id: string, userId: string) =>
    prisma.account.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    }),

  /**
   * Balances are DERIVED, never stored (Ch 5 §5.4) — a stored balance drifts out of
   * sync with the transactions that define it.
   *
   * Hand-written SQL rather than an ORM helper: this is the aggregate that has to be
   * exactly right, and transfers must net out (an 'out' leg subtracts, an 'in' leg
   * adds) while income/expense use their sign from `type`.
   */
  balancesForUser: (userId: string) =>
    prisma.$queryRaw<Array<{ id: string; balance_minor: bigint }>>`
      SELECT a.id,
             a.opening_balance_minor + COALESCE(SUM(
               CASE
                 WHEN t.type = 'income'  THEN t.amount_minor
                 WHEN t.type = 'expense' THEN -t.amount_minor
                 WHEN t.type = 'transfer' AND t.transfer_direction = 'in'  THEN t.amount_minor
                 WHEN t.type = 'transfer' AND t.transfer_direction = 'out' THEN -t.amount_minor
                 ELSE 0
               END
             ), 0) AS balance_minor
      FROM accounts a
      LEFT JOIN transactions t
        ON t.account_id = a.id AND t.deleted_at IS NULL
      WHERE a.user_id = ${userId}::uuid AND a.deleted_at IS NULL
      GROUP BY a.id, a.opening_balance_minor
    `,
};
