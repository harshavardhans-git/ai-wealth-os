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

  /** Records a newly issued refresh token so it can be retired individually. */
  createRefreshToken: (userId: string, expiresAt: Date) =>
    prisma.refreshToken.create({ data: { userId, expiresAt } }),

  findRefreshToken: (id: string) =>
    prisma.refreshToken.findUnique({ where: { id } }),

  /**
   * Rotates one token into its successor, atomically.
   *
   * Both writes must land together: revoking the old token without recording the
   * new one would sign the user out mid-request, and vice versa would leave two
   * live tokens — the exact defect this table exists to fix.
   */
  rotateRefreshToken: (oldId: string, userId: string, expiresAt: Date) =>
    prisma.$transaction(async (tx) => {
      const next = await tx.refreshToken.create({ data: { userId, expiresAt } });
      await tx.refreshToken.update({
        where: { id: oldId },
        data: { revokedAt: new Date(), replacedBy: next.id },
      });
      return next;
    }),

  /** Revokes every live token for a user — logout, or a detected reuse event. */
  revokeAllRefreshTokens: (userId: string) =>
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
};
