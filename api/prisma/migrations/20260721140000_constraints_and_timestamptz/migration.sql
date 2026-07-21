-- Database-level integrity (Ch 5 §5.4, §5.6).
--
-- schema.prisma carried a TODO to add these "after migrate dev" and it was never
-- done, so for six sprints the allowed values of every enum-ish column lived only
-- in zod. That is fine until something writes without passing a route — a seed
-- script, a `createMany`, a psql session, a future job — and the database, which
-- is the actual source of truth, accepts anything.

-- ── 1 · CHECK constraints ────────────────────────────────────────────────────
-- NOT VALID would let these pass without scanning; we validate immediately
-- because the tables are small and silently-invalid legacy rows are worse than
-- a slow migration.

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_type_check"
  CHECK ("type" IN ('cash', 'bank', 'card', 'wallet'));

ALTER TABLE "categories" ADD CONSTRAINT "categories_kind_check"
  CHECK ("kind" IN ('income', 'expense'));

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_type_check"
  CHECK ("type" IN ('income', 'expense', 'transfer'));

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_check"
  CHECK ("source" IN ('manual', 'capture', 'import'));

-- Amounts are always POSITIVE; direction is carried by `type` and, for
-- transfers, `transfer_direction`. A negative amount here would double-count
-- against the balance SQL, which already applies the sign itself.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive_check"
  CHECK ("amount_minor" > 0);

-- A transfer leg must say which way it points; nothing else may.
--
-- The IS NOT NULL is load-bearing, and its absence is a classic SQL trap: a
-- CHECK passes when its expression evaluates to NULL, not just to TRUE. With a
-- bare `transfer_direction IN ('in','out')`, a transfer row with a NULL
-- direction gives `NULL IN (...)` → NULL → constraint satisfied. The constraint
-- would have been silently inert for exactly the case it exists to catch.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_direction_check"
  CHECK (
    (
      "type" = 'transfer'
      AND "transfer_direction" IS NOT NULL
      AND "transfer_direction" IN ('in', 'out')
    )
    OR ("type" <> 'transfer' AND "transfer_direction" IS NULL)
  );

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_period_check"
  CHECK ("period" IN ('monthly'));

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_amount_positive_check"
  CHECK ("amount_minor" > 0);

ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_status_check"
  CHECK ("status" IN ('pending', 'committed', 'reverted'));

-- ── 2 · Partial unique index for system categories ───────────────────────────
-- The existing UNIQUE (user_id, name, kind) does NOT constrain the seeded rows:
-- Postgres treats NULLs as distinct, so `(NULL, 'Food', 'expense')` can be
-- inserted any number of times. This covers the case the composite index misses.
CREATE UNIQUE INDEX "categories_system_name_kind_key"
  ON "categories" ("name", "kind")
  WHERE "user_id" IS NULL;

-- ── 3 · Partial indexes matching how we actually query ───────────────────────
-- Every list filters `deleted_at IS NULL`, but no index reflected that, so the
-- planner scanned soft-deleted rows before discarding them. Partial indexes are
-- also smaller, because tombstones are never stored in them.
CREATE INDEX "transactions_user_occurred_active_idx"
  ON "transactions" ("user_id", "occurred_at" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX "accounts_user_active_idx"
  ON "accounts" ("user_id")
  WHERE "deleted_at" IS NULL;

-- Transfer legs are always fetched as a pair.
CREATE INDEX "transactions_transfer_group_idx"
  ON "transactions" ("transfer_group_id")
  WHERE "transfer_group_id" IS NOT NULL;

-- ── 4 · TIMESTAMP → TIMESTAMPTZ ──────────────────────────────────────────────
-- Ch 5 §5.4 specified timestamptz; the generated migration produced naive
-- `TIMESTAMP(3)`. Without a zone, "2026-07-21 18:30" means whatever the reading
-- server thinks it means — so a deploy region change would silently shift every
-- transaction's date, and month boundaries with it.
--
-- The conversion is safe because Prisma has always written UTC: `AT TIME ZONE
-- 'UTC'` states that explicitly rather than assuming the server's zone.

ALTER TABLE "users"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "accounts"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "categories"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "transactions"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "occurred_at" TYPE TIMESTAMPTZ(3) USING "occurred_at" AT TIME ZONE 'UTC';

-- `starts_on` is deliberately left a DATE: a budget period starts on a calendar
-- day, not at an instant. Giving it a zone would invent a precision the concept
-- does not have.
ALTER TABLE "budgets"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "import_batches"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "capture_logs"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "refresh_tokens"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "revoked_at" TYPE TIMESTAMPTZ(3) USING "revoked_at" AT TIME ZONE 'UTC';
