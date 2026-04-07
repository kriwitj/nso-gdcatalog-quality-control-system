-- CreateTable: users
CREATE TABLE "users" (
    "id"            TEXT        NOT NULL,
    "username"      TEXT        NOT NULL,
    "email"         TEXT,
    "password_hash" TEXT        NOT NULL,
    "role"          TEXT        NOT NULL DEFAULT 'viewer',
    "is_active"     BOOLEAN     NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id"         TEXT         NOT NULL,
    "user_id"    TEXT         NOT NULL,
    "token"      TEXT         NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key"      ON "users"("username");
CREATE UNIQUE INDEX "users_email_key"         ON "users"("email");
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX        "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
