import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { accountsRouter } from "./modules/accounts/accounts.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { budgetsRouter } from "./modules/budgets/budgets.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { healthRouter } from "./modules/health/health.routes";
import { transactionsRouter } from "./modules/transactions/transactions.routes";

/**
 * Builds the configured app WITHOUT listening, so tests can drive it in-process
 * with Supertest (Ch 6, Ch 13).
 *
 * Middleware order matters (Ch 7 §7.3):
 * security headers → CORS → body parse → cookies → routes → 404 → error handler.
 */
export function createApp(): Express {
  const app = express();

  app.use(helmet()); // security headers (Ch 12)
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" })); // cap body size (Ch 12)
  app.use(cookieParser()); // read the httpOnly refresh cookie (Ch 10)

  // Unversioned: used by uptime checks and the pre-demo warm-up (Ch 14).
  app.use("/health", healthRouter);

  // Brute-force / credential-stuffing defence on auth endpoints (Ch 12).
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiV1 = express.Router();
  apiV1.use("/auth", authLimiter, authRouter);
  apiV1.use("/accounts", accountsRouter);
  apiV1.use("/budgets", budgetsRouter);
  apiV1.use("/categories", categoriesRouter);
  apiV1.use("/dashboard", dashboardRouter);
  apiV1.use("/transactions", transactionsRouter);
  app.use("/api/v1", apiV1);

  app.use(notFoundHandler);
  app.use(errorHandler); // MUST be last

  return app;
}
