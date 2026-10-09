<script setup lang="ts">
import { computed, ref } from 'vue';
import AutocompleteInput from './AutocompleteInput.vue';

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    query: string;
    suggestions: string[];
    loading: boolean;
    error: string;
    loadError: string;
    popupBoundary?: HTMLElement | null;
  }>(),
  { popupBoundary: null },
);
const emit = defineEmits<{
  'update:modelValue': [value: string[]];
  'update:query': [value: string];
}>();
const limitError = ref('');
const filtered = computed(() =>
  props.suggestions.filter(
    (tag) =>
      !props.modelValue.includes(tag) &&
      tag.toLowerCase().includes(props.query.trim().toLowerCase()),
  ),
);
function add(value: string, clearQuery = false) {
  const tag = value.trim();
  if (tag && !props.modelValue.includes(tag)) {
    if (props.modelValue.length >= 20) {
      limitError.value = '标签最多添加20项。';
      return;
    }
    emit('update:modelValue', [...props.modelValue, tag]);
  }
  limitError.value = '';
  if (clearQuery) emit('update:query', '');
}
</script>

<template>
  <div class="form-field">
    <span>标签</span>
    <div class="tag-line">
      <button
        v-for="tag in modelValue"
        :key="tag"
        class="tag-pill removable-tag"
        type="button"
        :aria-label="`移除标签${tag}`"
        @click="
          emit(
            'update:modelValue',
            modelValue.filter((item) => item !== tag),
          )
        "
      >
        {{ tag }} ×
      </button>
    </div>
    <div class="tag-input-row">
      <AutocompleteInput
        id="tagInput"
        class="tag-autocomplete"
        :model-value="query"
        :suggestions="filtered"
        label="标签"
        placeholder="输入标签（如：汤、快手菜）"
        :maxlength="20"
        :loading="loading"
        :keep-open-on-select="true"
        :suggestions-disabled="modelValue.length >= 20"
        :popup-boundary="popupBoundary"
        :empty-message="query.trim() ? '没有匹配的已有标签，可直接添加。' : '暂无已有标签。'"
        @update:model-value="emit('update:query', $event)"
        @select="add($event)"
        @enter="add(query, true)"
      />
      <button
        class="button button-primary"
        type="button"
        :disabled="modelValue.length >= 20"
        @click="add(query, true)"
      >
        添加
      </button>
    </div>
    <small class="muted">最多20个标签，每个不超过20字。</small>
    <small v-if="error || limitError" class="field-error">{{ error || limitError }}</small>
    <p v-if="loadError" class="muted">{{ loadError }}</p>
  </div>
</template>

<style scoped>
.tag-autocomplete {
  flex: 1;
}
</style>
