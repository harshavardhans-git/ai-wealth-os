import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

/**
 * Category data access. Every query is scoped by the caller (Ch 5 D3) — a user
 * sees the shared system categories (userId = null) plus their own, never
 * anyone else's.
 *
 * Note the asymmetry: reads include system categories, but writes are restricted
 * to `userId: <the caller>`. That single difference is what makes the shared
 * system rows read-only without needing a permissions system.
 */
export const categoriesRepository = {
  listForUser: (userId: string) =>
    prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),

  findOwnedById: (id: string, userId: string) =>
    prisma.category.findFirst({ where: { id, userId } }),

  findDuplicate: (userId: string, name: string, kind: string) =>
    prisma.category.findFirst({
      where: { name, kind, OR: [{ userId }, { userId: null }] },
    }),

  create: (data: Prisma.CategoryUncheckedCreateInput) =>
    prisma.category.create({ data }),

  updateOwned: (
    id: string,
    userId: string,
    data: Prisma.CategoryUpdateManyMutationInput,
  ) => prisma.category.updateMany({ where: { id, userId }, data }),

  deleteOwned: (id: string, userId: string) =>
    prisma.category.deleteMany({ where: { id, userId } }),

  countUsage: (categoryId: string, userId: string) =>
    prisma.transaction.count({
      where: { categoryId, userId, deletedAt: null },
    }),

  countBudgets: (categoryId: string, userId: string) =>
    prisma.budget.count({ where: { categoryId, userId } }),
};
