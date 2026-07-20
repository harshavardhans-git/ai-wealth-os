import { prisma } from "../../lib/prisma";

/**
 * The only place user rows are read/written (Ch 7 §7.1).
 */
export const authRepository = {
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),

  findById: (id: string) => prisma.user.findUnique({ where: { id } }),

  create: (data: {
    email: string;
    passwordHash: string;
    name: string;
    baseCurrency?: string;
  }) => prisma.user.create({ data }),

  /** Bumping tokenVersion invalidates every outstanding refresh token (Ch 10 §10.3). */
  incrementTokenVersion: (id: string) =>
    prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    }),
};
