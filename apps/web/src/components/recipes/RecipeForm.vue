<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { Recipe, RecipeInput } from '@sku-cook/shared';
import { getRecipeTags } from '../../api/recipes';
import { apiErrorMessage } from '../../api/errors';
import {
  blankIngredient,
  draftFromRecipe,
  firstErrorInputId,
  validateRecipeDraft,
} from '../../domain/recipe-form';
import RecipeBasicFields from './RecipeBasicFields.vue';
import RecipeTagPicker from './RecipeTagPicker.vue';
import IngredientEditor from './IngredientEditor.vue';
import RecipeStepsEditor from './RecipeStepsEditor.vue';

const props = withDefaults(
  defineProps<{
    initialRecipe?: Recipe | null;
    saving?: boolean;
    submitLabel: string;
    titleError?: string;
    serverError?: string;
  }>(),
  { initialRecipe: null, saving: false, titleError: '', serverError: '' },
);
const emit = defineEmits<{ submit: [input: RecipeInput]; dirtyChange: [dirty: boolean] }>();
const draft = reactive(draftFromRecipe(props.initialRecipe));
const errors = ref<Record<string, string>>({});
const validationAttempted = ref(false);
const suggestedTags = ref<string[]>([]);
const tagError = ref('');
const tagLoading = ref(true);
const actionFooter = ref<HTMLElement | null>(null);
const baseline = ref(JSON.stringify(draftFromRecipe(props.initialRecipe)));
const dirty = computed(() => JSON.stringify(draft) !== baseline.value);
const basics = computed(() => ({
  title: draft.title,
  description: draft.description,
  servings: draft.servings,
  prepMinutes: draft.prepMinutes,
  cookMinutes: draft.cookMinutes,
  difficulty: draft.difficulty,
}));
const basicErrors = computed(() =>
  Object.fromEntries(Object.entries(errors.value).filter(([key]) => key in basics.value)),
);
const tagsError = computed(
  () =>
    errors.value.tags ??
    Object.entries(errors.value).find(([key]) => key.startsWith('tags.'))?.[1] ??
    '',
);
const stepErrors = computed(() =>
  Object.fromEntries(
    Object.entries(errors.value)
      .filter(([key]) => key === 'steps' || key.startsWith('steps.'))
      .map(([key, message]) => [key === 'steps' ? key : key.split('.')[1], message]),
  ),
);
function ingredientErrors(index: number): Record<string, string> {
  const prefix = `ingredients.${index}.`;
  return Object.fromEntries(
    Object.entries(errors.value)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, message]) => [key.slice(prefix.length), message]),
  );
}
watch(dirty, (value) => emit('dirtyChange', value), { immediate: true });
watch(draft, () => {
  if (validationAttempted.value) validateDraft();
});
watch(
  () => props.initialRecipe,
  (recipe) => {
    Object.assign(draft, draftFromRecipe(recipe));
    baseline.value = JSON.stringify(draftFromRecipe(recipe));
    errors.value = {};
    validationAttempted.value = false;
  },
);
onMounted(async () => {
  try {
    suggestedTags.value = (await getRecipeTags()).tags;
  } catch (cause) {
    tagError.value = apiErrorMessage(cause, '已有标签读取失败，仍可输入任意标签。');
  } finally {
    tagLoading.value = false;
  }
});
function validateDraft() {
  const parsed = validateRecipeDraft(draft);
  const next: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      next[issue.path.map(String).join('.')] ??= issue.message;
  }
  errors.value = next;
  return parsed;
}
function submit() {
  validationAttempted.value = true;
  const parsed = validateDraft();
  if (!parsed.success) {
    const first = Object.keys(errors.value)[0];
    if (first)
      window.setTimeout(() => {
        const target = document.getElementById(firstErrorInputId(first));
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target?.focus();
      }, 0);
    return;
  }
  emit('submit', parsed.data);
}
</script>

<template>
  <form class="recipe-form" novalidate @submit.prevent="submit">
    <section class="paper-card form-section">
      <RecipeBasicFields
        :model-value="basics"
        :errors="basicErrors"
        :title-error="titleError"
        @update:model-value="Object.assign(draft, $event)"
      />
      <RecipeTagPicker
        v-model="draft.tags"
        v-model:query="draft.tagInput"
        :suggestions="suggestedTags"
        :loading="tagLoading"
        :error="tagsError"
        :load-error="tagError"
        :popup-boundary="actionFooter"
      />
    </section>
    <section class="paper-card form-section">
      <div class="section-heading">
        <h2 class="section-chip">食材 *</h2>
        <p class="muted">按原份数填写食材用量，可随份数自动换算</p>
      </div>
      <p v-if="errors.ingredients" class="field-error">{{ errors.ingredients }}</p>
      <IngredientEditor
        v-for="(ingredient, index) in draft.ingredients"
        :key="index"
        :model-value="ingredient"
        :index="index"
        :can-delete="draft.ingredients.length > 1"
        :errors="ingredientErrors(index)"
        :popup-boundary="actionFooter"
        @update:model-value="draft.ingredients[index] = $event"
        @delete="draft.ingredients.splice(index, 1)"
      />
      <p class="muted">食材最多100项。</p>
      <button
        class="button button-secondary full-width"
        type="button"
        :disabled="draft.ingredients.length >= 100"
        @click="draft.ingredients.push(blankIngredient())"
      >
        ＋ 添加食材
      </button>
    </section>
    <RecipeStepsEditor v-model="draft.steps" :errors="stepErrors" />
    <section class="paper-card form-section">
      <h2 class="section-chip">其他</h2>
      <label class="form-field" for="tips">
        <span>窍门</span>
        <textarea
          id="tips"
          v-model="draft.tips"
          rows="4"
          maxlength="5000"
          :aria-invalid="Boolean(errors.tips)"
        />
        <small v-if="errors.tips" class="field-error">{{ errors.tips }}</small>
      </label>
      <label class="form-field" for="source">
        <span>来源</span>
        <input
          id="source"
          v-model="draft.source"
          maxlength="500"
          :aria-invalid="Boolean(errors.source)"
          placeholder="书名、网址或家里的经验"
        />
        <small v-if="errors.source" class="field-error">{{ errors.source }}</small>
      </label>
    </section>
    <p v-if="serverError" class="inline-error" role="alert">{{ serverError }}</p>
    <div class="bottom-spacer" aria-hidden="true" />
    <div ref="actionFooter" class="fixed-action">
      <button
        class="button button-primary"
        type="submit"
        :disabled="saving || (initialRecipe !== null && !dirty)"
      >
        {{ saving ? '保存中…' : submitLabel }}
      </button>
    </div>
  </form>
</template>
