import { RecipeInputSchema, type Recipe } from '@sku-cook/shared';

export type IngredientDraft = {
  name: string;
  amount: string;
  unit: string;
  amountUnit: string;
  note: string;
  group: string;
  scaleWithServings: boolean;
  advanced: boolean;
};
export type RecipeBasicsDraft = {
  title: string;
  description: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  difficulty: '' | 'easy' | 'medium' | 'hard';
};
export type RecipeFormDraft = RecipeBasicsDraft & {
  tags: string[];
  tagInput: string;
  ingredients: IngredientDraft[];
  steps: { text: string }[];
  tips: string;
  source: string;
};

export const unitSuggestions = [
  '个',
  '克',
  '勺',
  '毫升',
  '颗',
  '只',
  '根',
  '条',
  '片',
  '块',
  '瓣',
  '把',
  '张',
  '段',
  '杯',
  '汤匙',
  '茶匙',
  '千克',
  '升',
  '斤',
  '两',
  '包',
  '袋',
  '头',
];
const unitSuffixes = [...unitSuggestions].sort((left, right) => right.length - left.length);

export function blankIngredient(): IngredientDraft {
  return {
    name: '',
    amount: '',
    unit: '',
    amountUnit: '',
    note: '',
    group: '',
    scaleWithServings: true,
    advanced: false,
  };
}

export function draftFromRecipe(recipe: Recipe | null): RecipeFormDraft {
  return {
    title: recipe?.title ?? '',
    description: recipe?.description ?? '',
    servings: String(recipe?.servings ?? 1),
    prepMinutes: recipe?.prepMinutes == null ? '' : String(recipe.prepMinutes),
    cookMinutes: recipe?.cookMinutes == null ? '' : String(recipe.cookMinutes),
    difficulty: recipe?.difficulty ?? '',
    tags: [...(recipe?.tags ?? [])],
    tagInput: '',
    ingredients: recipe?.ingredients.map((item) => ({
      name: item.name,
      amount: item.amount ?? '',
      unit: item.unit ?? '',
      amountUnit: `${item.amount ?? ''}${item.unit ?? ''}`,
      note: item.note ?? '',
      group: item.group ?? '',
      scaleWithServings: item.scaleWithServings,
      advanced: Boolean(item.note || item.group),
    })) ?? [blankIngredient()],
    steps: recipe?.steps.map((step) => ({ text: step.text })) ?? [{ text: '' }],
    tips: recipe?.tips ?? '',
    source: recipe?.source ?? '',
  };
}

export function getAmountUnitSuggestions(value: string): string[] {
  const amount = value.trim();
  return /^\d+(?:\.\d+)?$/.test(amount) ? unitSuggestions.map((unit) => `${amount}${unit}`) : [];
}

export function parseAmountUnit(
  value: string,
  originalAmount = '',
  originalUnit = '',
): { amount: string; unit: string } {
  const normalized = value.trim();
  if (normalized === `${originalAmount}${originalUnit}`) {
    return { amount: originalAmount, unit: originalUnit };
  }
  const knownUnit = unitSuffixes.find((candidate) => normalized.endsWith(candidate));
  if (knownUnit) {
    const amount = normalized.slice(0, -knownUnit.length).trim();
    if (amount) return { amount, unit: knownUnit };
  }
  const match = normalized.match(
    /^(\d+(?:\.\d+)?(?:\s*[～〜~\-－–—至]\s*\d+(?:\.\d+)?|\s*\/\s*\d+)?)\s*(\p{L}[\p{L}\p{M}\d·.（）()]*)$/u,
  );
  if (match?.[1] && match[2]) return { amount: match[1].trim(), unit: match[2] };
  return { amount: normalized, unit: '' };
}

function optionalText(value: string): string | undefined {
  return value.trim() || undefined;
}

export function validateRecipeDraft(draft: RecipeFormDraft) {
  return RecipeInputSchema.safeParse({
    title: draft.title.trim(),
    ...(optionalText(draft.description) ? { description: optionalText(draft.description) } : {}),
    servings: Number(draft.servings),
    ...(draft.prepMinutes.trim() ? { prepMinutes: Number(draft.prepMinutes) } : {}),
    ...(draft.cookMinutes.trim() ? { cookMinutes: Number(draft.cookMinutes) } : {}),
    ...(draft.difficulty ? { difficulty: draft.difficulty } : {}),
    tags: draft.tags.map((tag) => tag.trim()),
    ingredients: draft.ingredients.map((item) => {
      const { amount, unit } = parseAmountUnit(item.amountUnit, item.amount, item.unit);
      return {
        name: item.name.trim(),
        ...(optionalText(amount) ? { amount: optionalText(amount) } : {}),
        ...(optionalText(unit) ? { unit: optionalText(unit) } : {}),
        ...(optionalText(item.note) ? { note: optionalText(item.note) } : {}),
        ...(optionalText(item.group) ? { group: optionalText(item.group) } : {}),
        scaleWithServings: item.scaleWithServings,
      };
    }),
    steps: draft.steps.map((step, index) => ({ order: index + 1, text: step.text.trim() })),
    ...(optionalText(draft.tips) ? { tips: optionalText(draft.tips) } : {}),
    ...(optionalText(draft.source) ? { source: optionalText(draft.source) } : {}),
  });
}

export function firstErrorInputId(path: string): string {
  const [section, index = '0', field] = path.split('.');
  if (section === 'ingredients') {
    if (field === 'amount' || field === 'unit') return `ingredient-amount-${index}`;
    if (field === 'note' || field === 'group') return `ingredient-${field}-${index}`;
    return `ingredient-${index}`;
  }
  if (section === 'steps') return `step-${index}`;
  return section === 'tags' ? 'tagInput' : (section ?? '');
}
