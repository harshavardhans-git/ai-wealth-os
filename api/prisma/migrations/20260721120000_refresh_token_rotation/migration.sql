-- Refresh-token rotation with reuse detection (Ch 10 §10.2).
--
-- Before this, `users.token_version` was the only revocation lever: a single
-- counter that could invalidate every session at once but could not retire one
-- rotated token. Rotation was therefore cosmetic — the old refresh token stayed
-- valid alongside its replacement for the full 7 days.
--
-- One row per issued token. The token string is never stored, only its id.

CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- Look up every token in a family when a reuse event forces a mass revoke.
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- Supports pruning expired rows so the table stays small.
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
