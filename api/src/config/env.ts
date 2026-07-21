import "dotenv/config";
import { z } from "zod";

/**
 * Validated environment configuration (Ch 6 §6.8, Ch 12).
 * Parsed once at boot; the process exits with a clear message if anything required
 * is missing or malformed ("fail fast" beats a mystery error deep in a request).
 *
 * ANTHROPIC_API_KEY and DEMO_MODE used to live here. Both are gone (ADR-001):
 * the capture parser is a deterministic pure function, so there is no vendor key
 * to hold and no cache to fall back to. `isDemoMode` was computed and never read
 * by anything — config that lies about what a system does is worse than absent,
 * because a reader trusts it.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, "use at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "use at least 32 chars"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:\n",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
};
