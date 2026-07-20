import type { RequestHandler } from "express";
import { AppError } from "../lib/app-error";
import { verifyAccessToken } from "../lib/jwt";

/**
 * Turns a verified access token into `req.userId` (Ch 10 §10.4).
 * This is the ONLY place identity enters the system — every downstream layer trusts
 * `req.userId` and nothing else.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    next(AppError.unauthorized("Missing access token"));
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.userId = payload.sub;
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired access token"));
  }
};
