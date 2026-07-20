import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * One shared PrismaClient (Ch 7). Each client opens a connection pool, so we reuse a
 * single instance. Cached on globalThis in dev because `tsx watch` re-executes modules
 * on save, which would otherwise leak a new pool per reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
