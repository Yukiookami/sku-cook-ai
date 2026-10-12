<script setup lang="ts" generic="T extends string">
import { computed } from 'vue';

type SegmentedOption<Value extends string> = { label: string; value: Value };

const props = defineProps<{
  modelValue: T;
  options: readonly [SegmentedOption<T>, SegmentedOption<T>];
  label: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: T] }>();
const activeIndex = computed(() =>
  Math.max(
    0,
    props.options.findIndex(({ value }) => value === props.modelValue),
  ),
);
</script>

<template>
  <div class="segmented-switch" role="group" :aria-label="label">
    <span
      class="segmented-switch-indicator"
      :class="{ 'is-second': activeIndex === 1 }"
      aria-hidden="true"
    />
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="modelValue === option.value"
      :disabled="disabled ?? false"
      :class="{ active: modelValue === option.value }"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented-switch {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff8dc;
}

.segmented-switch-indicator {
  position: absolute;
  z-index: 0;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 12px) / 2);
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 4px rgb(51 46 40 / 12%);
  transition: transform 220ms ease;
}

.segmented-switch-indicator.is-second {
  transform: translateX(calc(100% + 4px));
}

.segmented-switch button {
  position: relative;
  z-index: 1;
  min-height: 44px;
  border: 0;
  border-radius: 10px;
  color: var(--muted);
  background: transparent;
  font: inherit;
  font-weight: 700;
}

.segmented-switch button.active {
  color: var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  .segmented-switch-indicator {
    transition: none;
  }
}
</style>
