-- Rename ai_parse_logs -> capture_logs (and its "model" column -> "parser").
--
-- Hand-written on purpose: Prisma's generated migration for a rename is a DROP
-- + CREATE, which silently destroys every existing row. ALTER ... RENAME keeps
-- the data and the table's identity.
--
-- The constraint and index are renamed too, so Prisma doesn't report drift
-- against the names it expects from the schema.
ALTER TABLE "ai_parse_logs" RENAME TO "capture_logs";
ALTER TABLE "capture_logs" RENAME COLUMN "model" TO "parser";

ALTER INDEX "ai_parse_logs_pkey" RENAME TO "capture_logs_pkey";
ALTER INDEX "ai_parse_logs_user_id_idx" RENAME TO "capture_logs_user_id_idx";
ALTER TABLE "capture_logs" RENAME CONSTRAINT "ai_parse_logs_user_id_fkey" TO "capture_logs_user_id_fkey";
