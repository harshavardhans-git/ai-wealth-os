import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { ListTransactionsQuery } from "./transactions.schema";

/** Builds the user-scoped, soft-delete-aware WHERE clause used by list + count. */
function buildWhere(
  userId: string,
  filters: ListTransactionsQuery,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId, deletedAt: null };

  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.type) where.type = filters.type;

  if (filters.from || filters.to) {
    where.occurredAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  return where;
}

export const transactionsRepository = {
  listForUser: (userId: string, filters: ListTransactionsQuery) =>
    prisma.transaction.findMany({
      where: buildWhere(userId, filters),
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: filters.limit,
      skip: filters.offset,
    }),

  countForUser: (userId: string, filters: ListTransactionsQuery) =>
    prisma.transaction.count({ where: buildWhere(userId, filters) }),

  findByIdForUser: (id: string, userId: string) =>
    prisma.transaction.findFirst({ where: { id, userId, deletedAt: null } }),

  create: (data: Prisma.TransactionUncheckedCreateInput) =>
    prisma.transaction.create({ data }),

  /**
   * Both legs of a transfer are written inside ONE database transaction (Ch 7 §7.7).
   * A half-written transfer would create or destroy money — atomicity is the whole
   * reason database transactions exist.
   */
  createTransferPair: (
    outLeg: Prisma.TransactionUncheckedCreateInput,
    inLeg: Prisma.TransactionUncheckedCreateInput,
  ) =>
    prisma.$transaction([
      prisma.transaction.create({ data: outLeg }),
      prisma.transaction.create({ data: inLeg }),
    ]),

  updateForUser: (
    id: string,
    userId: string,
    data: Prisma.TransactionUpdateManyMutationInput,
  ) =>
    prisma.transaction.updateMany({
      where: { id, userId, deletedAt: null },
      data,
    }),

  softDeleteForUser: (id: string, userId: string) =>
    prisma.transaction.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    }),

  /** Deleting one leg of a transfer must remove both. */
  softDeleteGroupForUser: (transferGroupId: string, userId: string) =>
    prisma.transaction.updateMany({
      where: { transferGroupId, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
};
