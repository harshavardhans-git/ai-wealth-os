import argon2 from "argon2";
import type { User } from "@prisma/client";
import { AppError } from "../../lib/app-error";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt";
import { authRepository } from "./auth.repository";
import type { LoginInput, SignupInput } from "./auth.schema";

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
};
