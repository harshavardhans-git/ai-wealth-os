import jwt from "jsonwebtoken";
import { env } from "../config/env";

/**
 * Token issuing/verification (Ch 10 §10.1).
 * - Access token: short-lived (15m), held in memory by the client.
 * - Refresh token: long-lived (7d), httpOnly cookie. Carries two independent
 *   revocation handles:
 *     `tv`  — tokenVersion, the blunt lever: one bump kills every session.
 *     `jti` — this token's own row in `refresh_tokens`, the precise lever:
 *             retire exactly one token on rotation, and detect its reuse.
 */
const ACCESS_TTL = "15m";
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AccessPayload {
  sub: string;
}

export interface RefreshPayload {
  sub: string;
  tv: number;
  jti: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

export function signRefreshToken(
  userId: string,
  tokenVersion: number,
  jti: string,
): string {
  return jwt.sign(
    { sub: userId, tv: tokenVersion, jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TTL_MS / 1000 },
  );
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
}
