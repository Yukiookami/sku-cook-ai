<script setup lang="ts">
import { computed } from 'vue';
import AutocompleteInput from './AutocompleteInput.vue';
import {
  getAmountUnitSuggestions,
  parseAmountUnit,
  type IngredientDraft,
} from '../../domain/recipe-form';

const props = withDefaults(
  defineProps<{
    modelValue: IngredientDraft;
    index: number;
    canDelete: boolean;
    errors: Record<string, string>;
    popupBoundary?: HTMLElement | null;
  }>(),
  { popupBoundary: null },
);
const emit = defineEmits<{
  'update:modelValue': [value: IngredientDraft];
  delete: [];
}>();
const suggestions = computed(() => getAmountUnitSuggestions(props.modelValue.amountUnit));
function update<K extends keyof IngredientDraft>(key: K, value: IngredientDraft[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
function selectAmount(value: string) {
  const parsed = parseAmountUnit(value, props.modelValue.amount, props.modelValue.unit);
  emit('update:modelValue', { ...props.modelValue, amountUnit: value, ...parsed });
}
function textInput(key: 'name' | 'note' | 'group', event: Event) {
  if (event.target instanceof HTMLInputElement) update(key, event.target.value);
}
function toggleAdvanced(event: Event) {
  if (event.target instanceof HTMLDetailsElement) update('advanced', event.target.open);
}
function toggleScaling(event: Event) {
  if (event.target instanceof HTMLInputElement) update('scaleWithServings', event.target.checked);
}
const advancedFields = ['note', 'group'] as const;
</script>

<template>
  <article class="ingredient-editor">
    <h3>食材 {{ index + 1 }}</h3>
    <label class="form-field" :for="`ingredient-${index}`">
      <span>食材名称 *</span>
      <input
        :id="`ingredient-${index}`"
        :value="modelValue.name"
        maxlength="50"
        required
        :aria-invalid="Boolean(errors.name)"
        placeholder="例如：鸡蛋"
        @input="textInput('name', $event)"
      />
      <small v-if="errors.name" class="field-error">{{ errors.name }}</small>
    </label>
    <div class="form-field amount-field">
      <span>数量与单位</span>
      <AutocompleteInput
        :id="`ingredient-amount-${index}`"
        :model-value="modelValue.amountUnit"
        :suggestions="suggestions"
        :label="`食材 ${index + 1} 数量与单位`"
        :maxlength="70"
        :invalid="Boolean(errors.amount || errors.unit)"
        :popup-boundary="popupBoundary"
        placeholder="如：3个、200克、适量、2～3"
        @update:model-value="update('amountUnit', $event)"
        @select="selectAmount"
      />
      <div class="amount-shortcuts" aria-label="常用用量">
        <span>快捷用量</span>
        <button
          v-for="shortcut in ['适量', '少量', '大量', '少许']"
          :key="shortcut"
          class="amount-shortcut"
          type="button"
          @click="selectAmount(shortcut)"
        >
          {{ shortcut }}
        </button>
      </div>
      <small v-if="errors.amount || errors.unit" class="field-error">{{
        errors.amount || errors.unit
      }}</small>
    </div>
    <label class="switch-row">
      <span><strong>随份数换算</strong><small>仅纯数字自动换算</small></span>
      <input
        :checked="modelValue.scaleWithServings"
        type="checkbox"
        role="switch"
        @change="toggleScaling"
      />
    </label>
    <details :open="modelValue.advanced" @toggle="toggleAdvanced">
      <summary>备注与分组</summary>
      <div class="form-grid">
        <label
          v-for="field in advancedFields"
          :key="field"
          class="form-field"
          :for="`ingredient-${field}-${index}`"
        >
          <span>{{ field === 'note' ? '备注' : '分组' }}</span>
          <input
            :id="`ingredient-${field}-${index}`"
            :value="modelValue[field]"
            :maxlength="field === 'note' ? 200 : 50"
            :aria-invalid="Boolean(errors[field])"
            :placeholder="field === 'note' ? '如：切块' : '如：腌料'"
            @input="textInput(field, $event)"
          />
          <small v-if="errors[field]" class="field-error">{{ errors[field] }}</small>
        </label>
      </div>
    </details>
    <button
      v-if="canDelete"
      class="button button-danger full-width"
      type="button"
      @click="emit('delete')"
    >
      删除食材
    </button>
  </article>
</template>
