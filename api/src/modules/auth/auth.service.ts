import argon2 from "argon2";
import type { User } from "@prisma/client";
import { AppError } from "../../lib/app-error";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt";
import { convertMinor } from "../../lib/fx";
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

/** Never leak passwordHash / tokenVersion to the client. */
function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    baseCurrency: user.baseCurrency,
  };
}

function issueTokens(user: User): AuthResult {
  return {
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id, user.tokenVersion),
    user: toPublicUser(user),
  };
}

export const authService = {
  async signup(input: SignupInput): Promise<AuthResult> {
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict("An account with that email already exists");
    }

    // argon2id: memory-hard, the current recommended password hash (Ch 10 §10.2).
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

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

    // The revocation check: a logout/password-change bumped tokenVersion, so every
    // token minted before that no longer matches.
    if (user.tokenVersion !== payload.tv) {
      throw AppError.unauthorized("Refresh token has been revoked");
    }

    return issueTokens(user);
  },

  async logout(userId: string): Promise<void> {
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
        // The scale factor for one unit, applied to every row in that currency.
        const ratio = convertMinor(1_000_000, currency, nextCurrency) / 1_000_000;
        await tx.$executeRaw`
          UPDATE transactions
          SET amount_base_minor = ROUND(amount_minor * ${ratio}::numeric)
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
        const ratio = convertMinor(1_000_000, currency, nextCurrency) / 1_000_000;
        await tx.$executeRaw`
          UPDATE budgets
          SET amount_minor = ROUND(amount_minor * ${ratio}::numeric),
              currency = ${nextCurrency}
          WHERE user_id = ${userId}::uuid AND currency = ${currency}
        `;
      }
    });

    const updated = await authRepository.findById(userId);
    return toPublicUser(updated!);
  },
};
