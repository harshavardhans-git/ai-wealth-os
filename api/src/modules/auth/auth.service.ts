import argon2 from "argon2";
import type { User } from "@prisma/client";
import { AppError } from "../../lib/app-error";
import {
  REFRESH_TTL_MS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt";
import { ratePair } from "../../lib/fx";
import { prisma } from "../../lib/prisma";
import { authRepository } from "./auth.repository";
import type { LoginInput, SignupInput, UpdateMeInput } from "./auth.schema";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

/**
 * argon2id work factor, pinned explicitly (Ch 10 §10.2, Ch 12 §12.2).
 *
 * These are the OWASP minimums, not library defaults. A password hash's whole
 * value is its cost, and leaving that cost to whatever a minor dependency bump
 * happens to ship means the security property is unowned. Written down, it can be
 * reviewed and raised deliberately as hardware gets faster.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/** Never leak passwordHash / tokenVersion to the client. */
function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    baseCurrency: user.baseCurrency,
  };
}

/**
 * Mints a fresh token pair and records the refresh token so it can later be
 * retired on its own. Every issuing path goes through here, so no token can
 * exist without a row to revoke.
 */
async function issueTokens(user: User): Promise<AuthResult> {
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const record = await authRepository.createRefreshToken(user.id, expiresAt);

  return {
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id, user.tokenVersion, record.id),
    user: toPublicUser(user),
  };
}

export const authService = {
  async signup(input: SignupInput): Promise<AuthResult> {
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict("An account with that email already exists");
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    const user = await authRepository.create({
      email: input.email,
      passwordHash,
      name: input.name,
      ...(input.baseCurrency ? { baseCurrency: input.baseCurrency } : {}),
    });

    return issueTokens(user);
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await authRepository.findByEmail(input.email);

    // Same generic message whether the email is unknown or the password is wrong —
    // otherwise the endpoint becomes a user-enumeration oracle (Ch 12).
    if (!user) throw AppError.unauthorized("Invalid email or password");

    const passwordMatches = await argon2.verify(user.passwordHash, input.password);
    if (!passwordMatches) throw AppError.unauthorized("Invalid email or password");

    return issueTokens(user);
  },

  /** Verifies the refresh cookie and rotates it (Ch 10 §10.2). */
  async refresh(token: string | undefined): Promise<AuthResult> {
    if (!token) throw AppError.unauthorized("Missing refresh token");

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw AppError.unauthorized("Invalid or expired refresh token");
    }

    const user = await authRepository.findById(payload.sub);
    if (!user) throw AppError.unauthorized("Invalid refresh token");

    // Blunt lever: a logout or password change bumped tokenVersion, so every
    // token minted before that no longer matches.
    if (user.tokenVersion !== payload.tv) {
      throw AppError.unauthorized("Refresh token has been revoked");
    }

    const record = await authRepository.findRefreshToken(payload.jti);
    if (!record || record.userId !== user.id) {
      throw AppError.unauthorized("Refresh token has been revoked");
    }

    // REUSE DETECTION. This token was already rotated, so the caller is holding a
    // copy — either the legitimate user replaying an old cookie, or an attacker
    // with a stolen one. We cannot tell which, so we assume the worst and revoke
    // the whole family. The real user signs in again; the thief gets nothing.
    if (record.revokedAt) {
      await authRepository.revokeAllRefreshTokens(user.id);
      await authRepository.incrementTokenVersion(user.id);
      throw AppError.unauthorized("Refresh token has been revoked");
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw AppError.unauthorized("Invalid or expired refresh token");
    }

    // Precise lever: retire exactly this token and hand back its successor. Other
    // devices keep their own tokens and stay signed in.
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    const next = await authRepository.rotateRefreshToken(
      record.id,
      user.id,
      expiresAt,
    );

    return {
      accessToken: signAccessToken(user.id),
      refreshToken: signRefreshToken(user.id, user.tokenVersion, next.id),
      user: toPublicUser(user),
    };
  },

  async logout(userId: string): Promise<void> {
    // Both levers: the counter kills anything already minted, and the rows make
    // that visible in the table rather than only implied by a version mismatch.
    await authRepository.revokeAllRefreshTokens(userId);
    await authRepository.incrementTokenVersion(userId);
  },

  async me(userId: string): Promise<PublicUser> {
    const user = await authRepository.findById(userId);
    if (!user) throw AppError.notFound("User not found");
    return toPublicUser(user);
  },

  /**
   * Updates the profile — and, when the base currency changes, BACKFILLS every
   * historical `amount_base_minor`.
   *
   * Chapter 5 §5.5 flagged this as the cost of snapshotting values in the user's
   * reporting currency: change the reporting currency and every stored snapshot
   * is suddenly denominated in the old one. Skipping the backfill would leave a
   * dashboard silently adding rupees to dollars — numbers that look fine and are
   * wrong, which is the worst failure mode in a finance app.
   *
   * Done per currency rather than per row: conversion is a linear scale, so each
   * distinct currency needs exactly one UPDATE.
   */
  async updateMe(userId: string, input: UpdateMeInput): Promise<PublicUser> {
    const current = await authRepository.findById(userId);
    if (!current) throw AppError.notFound("User not found");

    const nextCurrency = input.baseCurrency ?? current.baseCurrency;
    const currencyChanged = nextCurrency !== current.baseCurrency;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.baseCurrency ? { baseCurrency: nextCurrency } : {}),
        },
      });

      if (!currencyChanged) return;

      const currencies = await tx.transaction.findMany({
        where: { userId },
        select: { currency: true },
        distinct: ["currency"],
      });

      for (const { currency } of currencies) {
        const rates = ratePair(currency, nextCurrency);
        // Unknown currency: convertMinor would pass it through 1:1, and
        // amount_base_minor already equals amount_minor. Nothing to do.
        if (!rates) continue;

        // Both integers cross the boundary and Postgres divides them in
        // `numeric` — exact rational arithmetic, rounded exactly once. Passing a
        // pre-divided JS ratio here would round twice and drift the ledger.
        await tx.$executeRaw`
          UPDATE transactions
          SET amount_base_minor = ROUND(
            amount_minor::numeric * ${rates.fromRate}::numeric
            / ${rates.toRate}::numeric
          )
          WHERE user_id = ${userId}::uuid AND currency = ${currency}
        `;
      }

      // Budget limits are compared against base-currency spend, so they have to
      // move with it or every budget silently changes meaning.
      const budgets = await tx.budget.findMany({
        where: { userId },
        select: { currency: true },
        distinct: ["currency"],
      });

      for (const { currency } of budgets) {
        const rates = ratePair(currency, nextCurrency);
        if (!rates) continue;

        // KNOWN LIMITATION: unlike transactions, a budget has no original-amount
        // column to re-derive from, so this rewrites the limit in place. Flipping
        // INR→USD→INR will not land back on the exact original rupee figure.
        // Fixing it properly means storing the limit's own currency snapshot —
        // tracked as a schema change, not patched with more rounding here.
        await tx.$executeRaw`
          UPDATE budgets
          SET amount_minor = ROUND(
                amount_minor::numeric * ${rates.fromRate}::numeric
                / ${rates.toRate}::numeric
              ),
              currency = ${nextCurrency}
          WHERE user_id = ${userId}::uuid AND currency = ${currency}
        `;
      }
    });

    const updated = await authRepository.findById(userId);
    return toPublicUser(updated!);
  },
};
