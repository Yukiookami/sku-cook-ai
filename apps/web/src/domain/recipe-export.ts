import {
  RecipeExportResponseSchema,
  type Recipe,
  type RecipeExportResponse,
} from '@sku-cook/shared';

export function createSingleRecipeExport(recipe: Recipe): RecipeExportResponse {
  return RecipeExportResponseSchema.parse({
    version: 1,
    recipes: [
      {
        title: recipe.title,
        ...(recipe.description !== null ? { description: recipe.description } : {}),
        servings: recipe.servings,
        ...(recipe.prepMinutes !== null ? { prepMinutes: recipe.prepMinutes } : {}),
        ...(recipe.cookMinutes !== null ? { cookMinutes: recipe.cookMinutes } : {}),
        ...(recipe.difficulty !== null ? { difficulty: recipe.difficulty } : {}),
        tags: recipe.tags,
        ingredients: recipe.ingredients.map((ingredient) => ({
          name: ingredient.name,
          ...(ingredient.amount !== null ? { amount: ingredient.amount } : {}),
          ...(ingredient.unit !== null ? { unit: ingredient.unit } : {}),
          ...(ingredient.note !== null ? { note: ingredient.note } : {}),
          ...(ingredient.group !== null ? { group: ingredient.group } : {}),
          scaleWithServings: ingredient.scaleWithServings,
        })),
        steps: recipe.steps.map(({ order, text }) => ({ order, text })),
        ...(recipe.tips !== null ? { tips: recipe.tips } : {}),
        ...(recipe.source !== null ? { source: recipe.source } : {}),
      },
    ],
  });
}
