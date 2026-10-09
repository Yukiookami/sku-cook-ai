import { z } from 'zod';
import { RecipeSchema, TargetServingsSchema } from './recipe.js';

export const KitchenItemSchema = z
  .object({
    recipeId: z.number().int().positive(),
    targetServings: TargetServingsSchema,
  })
  .strict();

export const KitchenSessionSchema = z
  .object({
    recipeIds: z.array(z.number().int().positive()).max(10),
    items: z.array(KitchenItemSchema).max(10),
    activeRecipeId: z.number().int().positive().nullable(),
    revision: z.number().int().nonnegative(),
    updatedAt: z.iso.datetime().nullable(),
    recipes: z.array(RecipeSchema).max(10),
  })
  .strict()
  .superRefine((session, context) => {
    if (
      session.recipeIds.length !== session.items.length ||
      session.items.length !== session.recipes.length
    ) {
      context.addIssue({ code: 'custom', path: ['items'], message: '厨房菜单数据长度不一致' });
    }
    session.items.forEach((item, index) => {
      if (
        session.recipeIds[index] !== item.recipeId ||
        session.recipes[index]?.id !== item.recipeId
      ) {
        context.addIssue({ code: 'custom', path: ['items', index], message: '厨房菜单顺序不一致' });
      }
    });
    if (
      (session.items.length === 0 && session.activeRecipeId !== null) ||
      (session.items.length > 0 && !session.recipeIds.includes(session.activeRecipeId ?? -1))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['activeRecipeId'],
        message: '当前菜必须属于厨房菜单',
      });
    }
  });
export type KitchenSession = z.infer<typeof KitchenSessionSchema>;

export const KitchenStateResponseSchema = z
  .object({
    session: KitchenSessionSchema,
    pollIntervalSeconds: z.number().int().positive(),
  })
  .strict();
export type KitchenStateResponse = z.infer<typeof KitchenStateResponseSchema>;

export const KitchenReplaceInputSchema = z
  .object({
    items: z.array(KitchenItemSchema).min(1).max(10),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((input, context) => {
    const ids = new Set<number>();
    input.items.forEach((item, index) => {
      if (ids.has(item.recipeId)) {
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'recipeId'],
          message: '菜谱不能重复',
        });
      }
      ids.add(item.recipeId);
    });
  });
export type KitchenReplaceInput = z.infer<typeof KitchenReplaceInputSchema>;

export const KitchenActiveInputSchema = z
  .object({
    activeRecipeId: z.number().int().positive(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export type KitchenActiveInput = z.infer<typeof KitchenActiveInputSchema>;

export const KitchenRevisionInputSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export type KitchenRevisionInput = z.infer<typeof KitchenRevisionInputSchema>;
