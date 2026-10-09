-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "servings" INTEGER NOT NULL DEFAULT 1,
    "prep_minutes" INTEGER,
    "cook_minutes" INTEGER,
    "difficulty" VARCHAR(10),
    "tips" VARCHAR(5000),
    "source" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "amount" VARCHAR(50),
    "unit" VARCHAR(20),
    "note" VARCHAR(200),
    "group" VARCHAR(50),
    "scale_with_servings" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_steps" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "text" VARCHAR(5000) NOT NULL,

    CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_tags" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "value" VARCHAR(20) NOT NULL,

    CONSTRAINT "recipe_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "active_recipe_id" INTEGER,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "kitchen_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_session_recipes" (
    "id" SERIAL NOT NULL,
    "kitchen_session_id" INTEGER NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "target_servings" INTEGER NOT NULL,

    CONSTRAINT "kitchen_session_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooking_histories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "cooked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(10) NOT NULL,
    "source_session_revision" INTEGER,

    CONSTRAINT "cooking_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooking_history_items" (
    "id" SERIAL NOT NULL,
    "history_id" INTEGER NOT NULL,
    "recipe_id" INTEGER,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(50) NOT NULL,
    "target_servings" INTEGER NOT NULL,

    CONSTRAINT "cooking_history_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "recipes_user_updated_id_idx" ON "recipes"("user_id", "updated_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "recipes_user_id_title_key" ON "recipes"("user_id", "title");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_recipe_id_position_key" ON "ingredients"("recipe_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_steps_recipe_id_order_key" ON "recipe_steps"("recipe_id", "order");

-- CreateIndex
CREATE INDEX "recipe_tags_value_idx" ON "recipe_tags"("value");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_tags_recipe_id_position_key" ON "recipe_tags"("recipe_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_tags_recipe_id_value_key" ON "recipe_tags"("recipe_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_sessions_user_id_key" ON "kitchen_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_session_recipes_kitchen_session_id_position_key" ON "kitchen_session_recipes"("kitchen_session_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_session_recipes_kitchen_session_id_recipe_id_key" ON "kitchen_session_recipes"("kitchen_session_id", "recipe_id");

-- CreateIndex
CREATE INDEX "cooking_histories_user_id_cooked_at_id_idx" ON "cooking_histories"("user_id", "cooked_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "cooking_histories_user_session_revision_key" ON "cooking_histories"("user_id", "source_session_revision");

-- CreateIndex
CREATE UNIQUE INDEX "cooking_history_items_history_id_position_key" ON "cooking_history_items"("history_id", "position");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_sessions" ADD CONSTRAINT "kitchen_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_session_recipes" ADD CONSTRAINT "kitchen_session_recipes_kitchen_session_id_fkey" FOREIGN KEY ("kitchen_session_id") REFERENCES "kitchen_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_session_recipes" ADD CONSTRAINT "kitchen_session_recipes_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_histories" ADD CONSTRAINT "cooking_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_history_items" ADD CONSTRAINT "cooking_history_items_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "cooking_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooking_history_items" ADD CONSTRAINT "cooking_history_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
