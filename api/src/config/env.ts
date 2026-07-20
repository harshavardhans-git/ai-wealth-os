import "dotenv/config";
import { z } from "zod";

/**
 * Validated environment configuration (Ch 6 §6.8, Ch 12).
 * Parsed once at boot; the process exits with a clear message if anything required
 * is missing or malformed ("fail fast" beats a mystery error deep in a request).
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, "use at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "use at least 32 chars"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(), // used from Sprint 4 (AI)
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DEMO_MODE: z.enum(["true", "false"]).default("true"),
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
  isDemoMode: parsed.data.DEMO_MODE === "true",
};
