-- Prisma migrate diff 生成结构 SQL；审查后补充无损回填与事务。
-- 不修改旧 name/email/password_hash 或任何业务 user_id。
BEGIN;
LOCK TABLE "users" IN EXCLUSIVE MODE;

ALTER TABLE "users" ADD COLUMN "username" VARCHAR(32),
ADD COLUMN "username_key" VARCHAR(32);

-- id=1 保留全部数据归属；其他既有用户保留 id 并获得确定、互不冲突的账号名。
UPDATE "users"
SET "username" = CASE WHEN "id" = 1 THEN 'Sku001' ELSE 'Legacy' || "id"::text END,
    "username_key" = CASE WHEN "id" = 1 THEN 'sku001' ELSE 'legacy' || "id"::text END;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL,
ALTER COLUMN "username_key" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_username_format_check"
CHECK ("username" ~ '^[A-Za-z][A-Za-z0-9_]{2,31}$');
ALTER TABLE "users" ADD CONSTRAINT "users_username_key_check"
CHECK ("username_key" = lower("username"));

-- 旧 Seed 显式写入 id=1 可能未推进序列；只前进，不倒退，防止注册撞旧主键。
SELECT setval(pg_get_serial_sequence('users', 'id'),
  GREATEST(COALESCE((SELECT MAX("id") FROM "users"), 1),
           (SELECT last_value FROM "users_id_seq")), true);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "token_hash" VARCHAR(64) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key_key" ON "users"("username_key");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_token_hash_check"
CHECK ("token_hash" ~ '^[a-f0-9]{64}$');
COMMIT;
