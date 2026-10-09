<script setup lang="ts">
import type { RecipeBasicsDraft } from '../../domain/recipe-form';

const props = defineProps<{
  modelValue: RecipeBasicsDraft;
  errors: Record<string, string>;
  titleError: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: RecipeBasicsDraft] }>();
function update<K extends keyof RecipeBasicsDraft>(key: K, value: RecipeBasicsDraft[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
function input(key: Exclude<keyof RecipeBasicsDraft, 'difficulty'>, event: Event) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    update(key, event.target.value);
  }
}
function difficulty(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const value = event.target.value;
  if (value === '' || value === 'easy' || value === 'medium' || value === 'hard')
    update('difficulty', value);
}
const minutes = [
  { key: 'prepMinutes', label: '准备分钟' },
  { key: 'cookMinutes', label: '烹饪分钟' },
] as const;
</script>

<template>
  <h2 class="section-chip">基本信息</h2>
  <label class="form-field" for="title">
    <span>菜名 <b>*</b></span>
    <input
      id="title"
      :value="modelValue.title"
      maxlength="50"
      autocomplete="off"
      required
      :aria-invalid="Boolean(errors.title || titleError)"
      @input="input('title', $event)"
    />
    <small v-if="errors.title || titleError" class="field-error">{{
      errors.title || titleError
    }}</small>
  </label>
  <label class="form-field" for="description">
    <span>介绍</span>
    <textarea
      id="description"
      :value="modelValue.description"
      rows="3"
      maxlength="500"
      :aria-invalid="Boolean(errors.description)"
      @input="input('description', $event)"
    />
    <small v-if="errors.description" class="field-error">{{ errors.description }}</small>
  </label>
  <div class="form-grid three-fields">
    <label class="form-field" for="servings">
      <span>原份数 <b>*</b></span>
      <input
        id="servings"
        :value="modelValue.servings"
        type="number"
        min="1"
        max="100"
        step="1"
        inputmode="numeric"
        required
        :aria-invalid="Boolean(errors.servings)"
        @input="input('servings', $event)"
      />
      <small v-if="errors.servings" class="field-error">{{ errors.servings }}</small>
    </label>
    <label v-for="minute in minutes" :key="minute.key" class="form-field" :for="minute.key">
      <span>{{ minute.label }}</span>
      <input
        :id="minute.key"
        :value="modelValue[minute.key]"
        type="number"
        min="0"
        max="1440"
        step="1"
        inputmode="numeric"
        :aria-invalid="Boolean(errors[minute.key])"
        @input="input(minute.key, $event)"
      />
      <small v-if="errors[minute.key]" class="field-error">{{ errors[minute.key] }}</small>
    </label>
  </div>
  <p class="muted">请按原份数填写用量；修改原份数不会自动调整已填写用量。</p>
  <label class="form-field" for="difficulty">
    <span>难度</span>
    <select id="difficulty" :value="modelValue.difficulty" @change="difficulty">
      <option value="">不指定</option>
      <option value="easy">简单</option>
      <option value="medium">中等</option>
      <option value="hard">复杂</option>
    </select>
  </label>
</template>
