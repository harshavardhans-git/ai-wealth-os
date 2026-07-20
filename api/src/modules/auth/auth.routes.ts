import { Router, type CookieOptions, type Response } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import { validate } from "../../middleware/validate";
import { LoginSchema, SignupSchema } from "./auth.schema";
import { authService } from "./auth.service";

const REFRESH_COOKIE = "refresh_token";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Refresh-cookie settings (Ch 10 §10.1).
 * httpOnly  → JavaScript cannot read it, so XSS cannot steal it.
 * secure    → HTTPS only (production).
 * sameSite  → In production the web app (vercel.app) and API (onrender.com) are
 *             different sites, so the cookie must be "none" to be sent at all.
 *             Locally they are same-site, so "lax" is both sufficient and safer.
 * path      → only ever sent to the auth endpoints, never to normal API calls.
 */
function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    path: "/api/v1/auth",
  };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...refreshCookieOptions(),
    maxAge: SEVEN_DAYS_MS,
  });
}

export const authRouter = Router();

authRouter.post(
  "/signup",
  validate({ body: SignupSchema }),
  asyncHandler(async (req, res) => {
    const { accessToken, refreshToken, user } = await authService.signup(req.body);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ data: { accessToken, user } });
  }),
);

authRouter.post(
  "/login",
  validate({ body: LoginSchema }),
  asyncHandler(async (req, res) => {
    const { accessToken, refreshToken, user } = await authService.login(req.body);
    setRefreshCookie(res, refreshToken);
    res.json({ data: { accessToken, user } });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { accessToken, refreshToken, user } = await authService.refresh(
      req.cookies?.[REFRESH_COOKIE],
    );
    setRefreshCookie(res, refreshToken); // rotation: a fresh token every refresh
    res.json({ data: { accessToken, user } });
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await authService.logout(req.userId!);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    res.status(204).send();
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: await authService.me(req.userId!) });
  }),
);
