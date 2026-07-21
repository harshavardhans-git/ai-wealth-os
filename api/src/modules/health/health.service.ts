import { prisma } from "../../lib/prisma";

export interface HealthReport {
  status: "ok" | "degraded";
  database: "connected" | "unreachable";
  uptime: number;
}

/**
 * Liveness + database reachability. Also the free-tier warm-up target before a
 * demo (Ch 14 §14.4).
 *
 * Reports "degraded" with a 200 rather than throwing: a health check exists to
 * describe state, and a 500 tells a monitor the endpoint is broken when what is
 * actually broken is the database behind it. The distinction matters when you
 * are reading a dashboard at 3am.
 */
export const healthService = {
  async check(): Promise<HealthReport> {
    let database: HealthReport["database"] = "connected";

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "unreachable";
    }

    return {
      status: database === "connected" ? "ok" : "degraded",
      database,
      uptime: Math.round(process.uptime()),
    };
  },
};
