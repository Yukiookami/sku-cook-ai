import { z } from 'zod';

export const CookingHistoryItemSchema = z
  .object({
    recipeId: z.number().int().positive().nullable(),
    title: z.string(),
    targetServings: z.number().int().min(1).max(100),
  })
  .strict();
export const CookingHistorySchema = z
  .object({
    id: z.number().int().positive(),
    cookedAt: z.iso.datetime(),
    source: z.enum(['kitchen', 'manual']),
    items: z.array(CookingHistoryItemSchema).min(1).max(10),
  })
  .strict();
export type CookingHistory = z.infer<typeof CookingHistorySchema>;
export const CookingHistoryResponseSchema = z.object({ history: CookingHistorySchema }).strict();

export const CookingHistoryInputSchema = z
  .object({
    recipeId: z.number().int().positive(),
    targetServings: z.number().int().min(1).max(100),
  })
  .strict();
export type CookingHistoryInput = z.infer<typeof CookingHistoryInputSchema>;

export const CookingHistoryListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(20).default(20),
  })
  .strict();
export type CookingHistoryListQuery = z.infer<typeof CookingHistoryListQuerySchema>;
export const CookingHistoryListResponseSchema = z
  .object({
    items: z.array(CookingHistorySchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(20),
    hasMore: z.boolean(),
  })
  .strict();
export type CookingHistoryListResponse = z.infer<typeof CookingHistoryListResponseSchema>;
export const CookingHistoryIdParamsSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();
