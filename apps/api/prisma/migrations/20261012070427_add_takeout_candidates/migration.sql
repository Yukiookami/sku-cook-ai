-- CreateTable
CREATE TABLE "takeout_candidates" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "url_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "takeout_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "takeout_candidates_user_created_id_idx" ON "takeout_candidates"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "takeout_candidates_user_url_hash_key" ON "takeout_candidates"("user_id", "url_hash");

-- AddForeignKey
ALTER TABLE "takeout_candidates" ADD CONSTRAINT "takeout_candidates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
