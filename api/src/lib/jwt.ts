import jwt from "jsonwebtoken";
import { env } from "../config/env";

/**
 * Token issuing/verification (Ch 10 §10.1).
 * - Access token: short-lived (15m), held in memory by the client.
 * - Refresh token: long-lived (7d), httpOnly cookie, carries `tv` (tokenVersion) so a
 *   single integer bump on the user row invalidates every outstanding refresh token.
 */
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

export interface AccessPayload {
  sub: string;
}

export interface RefreshPayload {
  sub: string;
  tv: number;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

export function signRefreshToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, tv: tokenVersion }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TTL,
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
}
