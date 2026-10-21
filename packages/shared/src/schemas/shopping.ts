import { z } from 'zod';
import { KitchenItemSchema } from './kitchen.js';

const text = (max: number) => z.string().trim().min(1).max(max);
export const SHOPPING_MAX_BYTES = 256 * 1024;
export const ShoppingSourceSchema = z
  .object({
    recipeId: text(128),
    originalText: text(500),
  })
  .strict();
export const ShoppingRecipeSchema = z
  .object({
    recipeId: text(128),
    title: text(200),
    servings: text(32),
  })
  .strict();
export const ShoppingItemSchema = z
  .object({
    itemId: z.uuid(),
    name: text(200),
    quantityText: z.string().trim().max(200),
    unit: z.string().trim().max(100),
    sources: z.array(ShoppingSourceSchema).min(1).max(50),
  })
  .strict();

// Todo 的公开机器协议在此独立校验，不依赖另一仓库源码或运行环境。
export const CookShoppingBatchInputSchema = z
  .object({
    batchId: z.uuid(),
    schemaVersion: z.literal(1),
    title: text(200),
    plannedDate: z.iso.date().nullable(),
    recipes: z.array(ShoppingRecipeSchema).min(1).max(50),
    items: z.array(ShoppingItemSchema).min(1).max(300),
  })
  .strict()
  .superRefine((batch, context) => {
    const recipeIds = new Set(batch.recipes.map((recipe) => recipe.recipeId));
    if (recipeIds.size !== batch.recipes.length) {
      context.addIssue({ code: 'custom', path: ['recipes'], message: '菜谱编号不可重复' });
    }
    if (new Set(batch.items.map((item) => item.itemId)).size !== batch.items.length) {
      context.addIssue({ code: 'custom', path: ['items'], message: '食材编号不可重复' });
    }
    batch.items.forEach((item, index) => {
      if (item.sources.some((source) => !recipeIds.has(source.recipeId))) {
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'sources'],
          message: '来源必须属于本批菜谱',
        });
      }
    });
  });
export type CookShoppingBatchInput = z.infer<typeof CookShoppingBatchInputSchema>;

export const ShoppingPreviewInputSchema = z
  .object({
    items: z.array(KitchenItemSchema).min(1).max(50),
  })
  .strict()
  .refine(
    (value) => new Set(value.items.map((item) => item.recipeId)).size === value.items.length,
    {
      message: '菜谱不可重复',
    },
  );
export type ShoppingPreviewInput = z.infer<typeof ShoppingPreviewInputSchema>;
export const ShoppingPreviewSchema = z
  .object({
    recipes: z.array(ShoppingRecipeSchema).min(1).max(50),
    items: z.array(ShoppingItemSchema).max(300),
  })
  .strict();
export type ShoppingPreview = z.infer<typeof ShoppingPreviewSchema>;

export const ShoppingReceiptSchema = z
  .object({
    replayed: z.boolean(),
    taskId: z.uuid(),
    shoppingId: z.uuid(),
    url: z.url(),
  })
  .strict();
export const ShoppingBatchSchema = z
  .object({
    payload: CookShoppingBatchInputSchema,
    status: z.enum(['pending', 'sending', 'succeeded', 'failed', 'conflict']),
    errorCode: z.string().nullable(),
    message: z.string().nullable(),
    receipt: ShoppingReceiptSchema.nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type ShoppingBatch = z.infer<typeof ShoppingBatchSchema>;
export const ShoppingBatchResponseSchema = z.object({ batch: ShoppingBatchSchema }).strict();
export const ShoppingBatchesResponseSchema = z
  .object({ batches: z.array(ShoppingBatchSchema) })
  .strict();
export const ShoppingBatchParamsSchema = z.object({ id: z.uuid() }).strict();
export const ShoppingEmptySchema = z.object({}).strict();
