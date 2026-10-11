-- AlterTable
BEGIN;
ALTER TABLE "users" ADD COLUMN     "is_super_admin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users" SET "email" = lower("email") WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check"
  CHECK ("email" IS NULL OR "email" = lower("email"));

-- 初始家庭账号的稳定ID不随用户名修改；仅该账号升级为超级管理员。
UPDATE "users" SET "is_super_admin" = true WHERE "id" = 1;
CREATE UNIQUE INDEX "users_single_super_admin_key"
  ON "users" ("is_super_admin") WHERE "is_super_admin" = true;
COMMIT;
