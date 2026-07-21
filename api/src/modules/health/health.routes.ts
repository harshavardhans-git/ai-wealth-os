import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { healthService } from "./health.service";

/**
 * GET /health — liveness + database reachability. Also the free-tier warm-up
 * target before a demo (Ch 14 §14.4).
 *
 * Unversioned, because uptime monitors should not have to track an API version
 * to ask whether the process is alive.
 */
export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ data: await healthService.check() });
  }),
);
