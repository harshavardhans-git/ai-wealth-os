import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

/** Budget data access — always user-scoped (Ch 5 D3). */
export const budgetsRepository = {
  listForUser: (userId: string) =>
    prisma.budget.findMany({
      where: { userId },
      include: { category: { select: { name: true, color: true } } },
      orderBy: { createdAt: "asc" },
    }),

  findByIdForUser: (id: string, userId: string) =>
    prisma.budget.findFirst({
      where: { id, userId },
      include: { category: { select: { name: true, color: true } } },
    }),

  create: (data: Prisma.BudgetUncheckedCreateInput) =>
    prisma.budget.create({
      data,
      include: { category: { select: { name: true, color: true } } },
    }),

  updateForUser: (
    id: string,
    userId: string,
    data: Prisma.BudgetUpdateManyMutationInput,
  ) => prisma.budget.updateMany({ where: { id, userId }, data }),

  deleteForUser: (id: string, userId: string) =>
    prisma.budget.deleteMany({ where: { id, userId } }),
};
