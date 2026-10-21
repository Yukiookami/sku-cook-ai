import { createHash } from 'node:crypto';
import {
  scaleIngredientAmount,
  ShoppingPreviewSchema,
  type ShoppingPreviewInput,
} from '@sku-cook/shared';
import type { Ingredient, Recipe } from '@prisma/client';

type RecipeWithIngredients = Recipe & { ingredients: Ingredient[] };
const decimal = /^\d+(?:\.\d+)?$/;

function ingredientUuid(id: number) {
  const hex = createHash('sha256').update(`sku-cook:ingredient:${id}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function addDecimals(left: string, right: string) {
  const [lw = '0', lf = ''] = left.split('.');
  const [rw = '0', rf = ''] = right.split('.');
  const digits = Math.max(lf.length, rf.length);
  const sum = BigInt(lw + lf.padEnd(digits, '0')) + BigInt(rw + rf.padEnd(digits, '0'));
  if (!digits) return String(sum);
  const result = String(sum).padStart(digits + 1, '0');
  return `${result.slice(0, -digits)}.${result.slice(-digits)}`.replace(/\.?0+$/, '');
}

export function shoppingPreview(records: RecipeWithIngredients[], selection: ShoppingPreviewInput) {
  const recipes = selection.items.map(({ recipeId, targetServings }) => {
    const recipe = records.find((record) => record.id === recipeId);
    if (!recipe) throw new Error('采购预览缺少已验证的菜谱');
    return { recipeId: String(recipeId), title: recipe.title, servings: `${targetServings}人份` };
  });
  const items: {
    itemId: string;
    name: string;
    quantityText: string;
    unit: string;
    sources: { recipeId: string; originalText: string }[];
  }[] = [];
  const mergeCandidates = new Map<string, (typeof items)[number]>();
  for (const selected of selection.items) {
    const recipe = records.find((record) => record.id === selected.recipeId);
    if (!recipe) throw new Error('采购预览缺少已验证的菜谱');
    for (const ingredient of recipe.ingredients) {
      const scaled = scaleIngredientAmount(
        ingredient.amount,
        ingredient.scaleWithServings,
        recipe.servings,
        selected.targetServings,
      );
      const quantityText = `${scaled.unconverted ? '未换算 ' : scaled.approximate ? '约' : ''}${scaled.text}`;
      const unit = ingredient.unit ?? '';
      const source = {
        recipeId: String(recipe.id),
        originalText: `${ingredient.name} ${ingredient.amount ?? ''}${unit}${ingredient.note ? `（${ingredient.note}）` : ''}；原${recipe.servings}人份，目标${selected.targetServings}人份`,
      };
      const mergeable = decimal.test(quantityText) && !ingredient.note;
      const key = JSON.stringify([ingredient.name, unit]);
      const candidate = mergeable ? mergeCandidates.get(key) : undefined;
      const existing = candidate && candidate.sources.length < 50 ? candidate : undefined;
      if (existing) {
        existing.quantityText = addDecimals(existing.quantityText, quantityText);
        existing.sources.push(source);
      } else {
        const item = {
          itemId: ingredientUuid(ingredient.id),
          name: ingredient.name,
          quantityText,
          unit,
          sources: [source],
        };
        items.push(item);
        if (mergeable) mergeCandidates.set(key, item);
      }
    }
  }
  return ShoppingPreviewSchema.parse({ recipes, items });
}
