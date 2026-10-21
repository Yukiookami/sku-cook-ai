-- CreateTable
CREATE TABLE "shopping_batches" (
    "id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "error_code" VARCHAR(64),
    "message" TEXT,
    "receipt" JSONB,
    "lease_until" TIMESTAMP(3),
    "attempt_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopping_batches_user_id_created_at_idx" ON "shopping_batches"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "shopping_batches" ADD CONSTRAINT "shopping_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
