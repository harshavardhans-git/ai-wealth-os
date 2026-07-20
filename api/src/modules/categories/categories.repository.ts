import { prisma } from "../../lib/prisma";

/**
 * Category data access. Every query is scoped by the caller's user id (Ch 5 D3) —
 * a user sees the shared system categories (userId = null) plus their own, and
 * never anyone else's.
 */
export const categoriesRepository = {
  listForUser: (userId: string) =>
    prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
};
