import { z } from 'zod';

const trimmedText = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => trimmedText(max).optional();
const PositiveIdSchema = z.number().int().positive();

export const TargetServingsSchema = z.number().int().min(1).max(100);

export const IngredientInputSchema = z
  .object({
    name: trimmedText(50).min(1),
    amount: optionalText(50),
    unit: optionalText(20),
    note: optionalText(200),
    group: optionalText(50),
    scaleWithServings: z.boolean().default(true),
  })
  .strict();

export const StepInputSchema = z
  .object({
    order: z.number().int().positive(),
    text: trimmedText(5000).min(1),
  })
  .strict();

export const RecipeInputSchema = z
  .object({
    title: trimmedText(50).min(1),
    description: optionalText(500),
    servings: TargetServingsSchema.default(1),
    prepMinutes: z.number().int().min(0).max(1440).optional(),
    cookMinutes: z.number().int().min(0).max(1440).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    tags: z.array(trimmedText(20).min(1)).max(20).default([]),
    ingredients: z.array(IngredientInputSchema).min(1).max(100),
    steps: z.array(StepInputSchema).min(1).max(100),
    tips: optionalText(5000),
    source: optionalText(500),
  })
  .strict()
  .superRefine((recipe, context) => {
    const tags = new Set<string>();
    recipe.tags.forEach((tag, index) => {
      if (tags.has(tag)) {
        context.addIssue({ code: 'custom', path: ['tags', index], message: '标签不能重复' });
      }
      tags.add(tag);
    });
    recipe.steps.forEach((step, index) => {
      if (step.order !== index + 1) {
        context.addIssue({
          code: 'custom',
          path: ['steps', index, 'order'],
          message: '步骤序号必须从1开始连续排列',
        });
      }
    });
  });
export type RecipeInput = z.infer<typeof RecipeInputSchema>;

export const RecipeIngredientSchema = z
  .object({
    name: z.string().min(1).max(50),
    amount: z.string().max(50).nullable(),
    unit: z.string().max(20).nullable(),
    note: z.string().max(200).nullable(),
    group: z.string().max(50).nullable(),
    scaleWithServings: z.boolean(),
  })
  .strict();
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const RecipeStepSchema = z
  .object({
    order: z.number().int().positive(),
    text: z.string().min(1).max(5000),
  })
  .strict();
export type RecipeStep = z.infer<typeof RecipeStepSchema>;

export const RecipeSummarySchema = z
  .object({
    id: PositiveIdSchema,
    title: z.string().min(1).max(50),
    description: z.string().max(500).nullable(),
    servings: TargetServingsSchema,
    prepMinutes: z.number().int().min(0).nullable(),
    cookMinutes: z.number().int().min(0).nullable(),
    difficulty: z.enum(['easy', 'medium', 'hard']).nullable(),
    tags: z.array(z.string().min(1).max(20)).max(20),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type RecipeSummary = z.infer<typeof RecipeSummarySchema>;

export const RecipeSchema = RecipeSummarySchema.extend({
  ingredients: z.array(RecipeIngredientSchema).min(1).max(100),
  steps: z.array(RecipeStepSchema).min(1).max(100),
  tips: z.string().max(5000).nullable(),
  source: z.string().max(500).nullable(),
  createdAt: z.iso.datetime(),
})
  .strict()
  .superRefine((recipe, context) => {
    const tags = new Set<string>();
    recipe.tags.forEach((tag, index) => {
      if (tags.has(tag)) {
        context.addIssue({ code: 'custom', path: ['tags', index], message: '响应标签不能重复' });
      }
      tags.add(tag);
    });
    recipe.steps.forEach((step, index) => {
      if (step.order !== index + 1) {
        context.addIssue({
          code: 'custom',
          path: ['steps', index, 'order'],
          message: '响应步骤序号不连续',
        });
      }
    });
  });
export type Recipe = z.infer<typeof RecipeSchema>;

export const RecipeResponseSchema = z.object({ recipe: RecipeSchema }).strict();
export type RecipeResponse = z.infer<typeof RecipeResponseSchema>;

export const RecipeListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(20).default(20),
    q: z.string().trim().max(50).optional(),
    tag: z.string().trim().max(20).optional(),
  })
  .strict();
export type RecipeListQuery = z.infer<typeof RecipeListQuerySchema>;

export const RecipeListResponseSchema = z
  .object({
    items: z.array(RecipeSummarySchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(20),
    hasMore: z.boolean(),
  })
  .strict();
export type RecipeListResponse = z.infer<typeof RecipeListResponseSchema>;

export const RecipeTagsResponseSchema = z.object({ tags: z.array(z.string()) }).strict();
export type RecipeTagsResponse = z.infer<typeof RecipeTagsResponseSchema>;
export const RecipeTagsQuerySchema = z.object({}).strict();

export const RecipeIdParamsSchema = z.object({ id: z.coerce.number().int().positive() }).strict();

export const RecipeRandomQuerySchema = z
  .object({
    excludeRecipeId: z.coerce.number().int().positive().optional(),
  })
  .strict();
export type RecipeRandomQuery = z.infer<typeof RecipeRandomQuerySchema>;

export const RecipeRandomResponseSchema = z.union([
  z.object({ recipe: RecipeSummarySchema, reason: z.null() }).strict(),
  z.object({ recipe: z.null(), reason: z.enum(['EMPTY_LIBRARY', 'NO_ALTERNATIVE']) }).strict(),
]);
export type RecipeRandomResponse = z.infer<typeof RecipeRandomResponseSchema>;

export const RecipeImportValidationRequestSchema = z
  .object({
    version: z.literal(1),
    recipes: z.array(z.unknown()).min(1).max(100),
  })
  .strict();
export type RecipeImportValidationRequest = z.infer<typeof RecipeImportValidationRequestSchema>;

export const RecipeImportInputSchema = z
  .object({
    version: z.literal(1),
    recipes: z.array(RecipeInputSchema).min(1).max(100),
  })
  .strict();
export type RecipeImportInput = z.infer<typeof RecipeImportInputSchema>;

export const ApiErrorIssueSchema = z
  .object({
    path: z.array(z.union([z.string(), z.number()])),
    message: z.string(),
  })
  .strict();
export type ApiErrorIssue = z.infer<typeof ApiErrorIssueSchema>;

export const ApiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        issues: z.array(ApiErrorIssueSchema).optional(),
      })
      .strict(),
  })
  .strict();

export const RecipeImportValidationResponseSchema = z
  .object({
    valid: z.literal(true),
    count: z.number().int().min(1).max(100),
    issues: z.array(ApiErrorIssueSchema),
  })
  .strict();
export type RecipeImportValidationResponse = z.infer<typeof RecipeImportValidationResponseSchema>;

export const RecipeImportResponseSchema = z
  .object({
    importedCount: z.number().int().min(1).max(100),
    recipeIds: z.array(PositiveIdSchema).min(1).max(100),
  })
  .strict();
export type RecipeImportResponse = z.infer<typeof RecipeImportResponseSchema>;
