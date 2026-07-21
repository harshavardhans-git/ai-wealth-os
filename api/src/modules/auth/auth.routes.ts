import {
  Router,
  type CookieOptions,
  type RequestHandler,
  type Response,
} from "express";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";
import { asyncHandler } from "../../lib/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import { validate } from "../../middleware/validate";
import { LoginSchema, SignupSchema, UpdateMeSchema } from "./auth.schema";
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
 *
 * CSRF (Ch 12 §12.3): `SameSite=none` in production means the browser WILL attach
 * this cookie to cross-site requests, so SameSite is not the control here. Two
 * things are:
 *   1. Nothing else authenticates by cookie. Every other endpoint requires a
 *      Bearer access token held in memory, which a foreign origin cannot read or
 *      replay — so there is no cookie-authenticated state change to forge.
 *   2. `requireSameOrigin` below rejects cross-origin calls to the one endpoint
 *      the cookie does reach.
 */
function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    path: "/api/v1/auth",
  };
}

/**
 * Rejects cookie-bearing calls that did not come from our own web app.
 *
 * Browsers set `Origin` on every cross-origin request and refuse to let scripts
 * forge it, so comparing it is a complete CSRF control for this route — and
 * unlike a double-submit token it needs no shared state. Non-browser callers
 * (curl, tests, the health checker) send no Origin at all; those are not the
 * threat, since CSRF depends on a browser silently attaching a cookie.
 */
const requireSameOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get("origin");
  if (origin && origin !== env.WEB_ORIGIN) {
    return next(AppError.forbidden("Cross-origin request rejected"));
  }
  next();
};

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
  requireSameOrigin,
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

authRouter.patch(
  "/me",
  requireAuth,
  validate({ body: UpdateMeSchema }),
  asyncHandler(async (req, res) => {
    res.json({ data: await authService.updateMe(req.userId!, req.body) });
  }),
);
