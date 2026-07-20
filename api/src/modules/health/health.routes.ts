import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { prisma } from "../../lib/prisma";

/**
 * GET /health — liveness + database reachability. Also the free-tier warm-up
 * target before a demo (Ch 14 §14.4).
 */
export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      data: {
        status: "ok",
        database: "connected",
        uptime: Math.round(process.uptime()),
      },
    });
  }),
);
