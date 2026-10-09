<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    id: string;
    modelValue: string;
    suggestions: string[];
    label: string;
    placeholder?: string;
    maxlength?: number;
    invalid?: boolean;
    loading?: boolean;
    emptyMessage?: string;
    keepOpenOnSelect?: boolean;
    suggestionsDisabled?: boolean;
    popupBoundary?: HTMLElement | null;
  }>(),
  {
    placeholder: '',
    maxlength: undefined,
    invalid: false,
    loading: false,
    emptyMessage: '',
    keepOpenOnSelect: false,
    suggestionsDisabled: false,
    popupBoundary: null,
  },
);
const emit = defineEmits<{
  'update:modelValue': [value: string];
  select: [value: string];
  enter: [];
}>();
const input = ref<HTMLInputElement | null>(null);
const dropdown = ref<HTMLElement | null>(null);
const open = ref(false);
const active = ref(-1);
const above = ref(false);
const maxHeight = ref(240);
const visible = computed(
  () => open.value && Boolean(props.suggestions.length || props.loading || props.emptyMessage),
);
const listId = computed(() => `${props.id}-suggestions`);
const activeId = computed(() =>
  visible.value && active.value >= 0 ? `${props.id}-option-${active.value}` : undefined,
);

function position() {
  if (!input.value) return;
  const bounds = input.value.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const bottom = top + (viewport?.height ?? window.innerHeight);
  const boundary = props.popupBoundary?.getBoundingClientRect().top ?? bottom;
  const below = Math.max(0, Math.min(bottom, boundary) - bounds.bottom - 8);
  const availableAbove = Math.max(0, bounds.top - top - 8);
  above.value = below < 180 && availableAbove > below;
  maxHeight.value = Math.max(0, Math.min(240, above.value ? availableAbove : below));
}
function activate() {
  open.value = true;
  active.value = -1;
  position();
}
function update(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return;
  emit('update:modelValue', event.target.value);
  activate();
}
function close(event: FocusEvent) {
  if (
    event.currentTarget instanceof HTMLElement &&
    event.relatedTarget instanceof Node &&
    event.currentTarget.contains(event.relatedTarget)
  )
    return;
  open.value = false;
  active.value = -1;
}
function select(value: string) {
  if (props.suggestionsDisabled) return;
  emit('select', value);
  open.value = props.keepOpenOnSelect;
  active.value = -1;
}
async function keydown(event: KeyboardEvent) {
  if (event.isComposing) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    open.value = false;
    active.value = -1;
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!props.suggestions.length || props.suggestionsDisabled) return;
    event.preventDefault();
    if (!open.value) activate();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    active.value =
      active.value < 0
        ? direction > 0
          ? 0
          : props.suggestions.length - 1
        : Math.max(0, Math.min(props.suggestions.length - 1, active.value + direction));
    await nextTick();
    dropdown.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const value =
      visible.value && !props.keepOpenOnSelect
        ? props.suggestions[active.value < 0 ? 0 : active.value]
        : props.suggestions[active.value];
    if (value && !props.suggestionsDisabled) select(value);
    else emit('enter');
  }
}
watch(
  () => props.suggestions,
  () => {
    active.value = -1;
  },
);
</script>

<template>
  <div class="autocomplete-input" @focusout="close">
    <input
      :id="id"
      ref="input"
      :value="modelValue"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :aria-label="label"
      :aria-invalid="invalid"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="visible"
      :aria-controls="visible ? listId : undefined"
      :aria-activedescendant="activeId"
      autocomplete="off"
      @focus="activate"
      @input="update"
      @keydown="keydown"
    />
    <div
      v-if="visible"
      :id="listId"
      ref="dropdown"
      class="autocomplete-suggestions"
      :class="{ above }"
      :style="{ maxHeight: `${maxHeight}px` }"
      role="listbox"
      :aria-label="`${label}建议`"
    >
      <p v-if="loading" class="autocomplete-empty" role="status">正在加载…</p>
      <template v-else-if="suggestions.length">
        <div
          v-for="(suggestion, index) in suggestions"
          :id="`${id}-option-${index}`"
          :key="suggestion"
          class="autocomplete-option"
          role="option"
          :aria-label="`选择 ${suggestion}`"
          :aria-selected="active === index"
          :aria-disabled="suggestionsDisabled"
          @pointerdown.prevent
          @mouseenter="active = index"
          @click="select(suggestion)"
        >
          {{ suggestion }}
        </div>
      </template>
      <p v-else class="autocomplete-empty">{{ emptyMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.autocomplete-input {
  position: relative;
  min-width: 0;
}
.autocomplete-input:focus-within {
  z-index: 7;
}
.autocomplete-suggestions {
  position: absolute;
  z-index: 5;
  top: 100%;
  right: 0;
  left: 0;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
  box-shadow: var(--shadow);
}
.above {
  top: auto;
  bottom: 100%;
}
.autocomplete-option {
  min-height: 44px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  font-weight: 400;
  cursor: pointer;
}
.autocomplete-option:last-child {
  border-bottom: 0;
}
.autocomplete-option:hover,
.autocomplete-option[aria-selected='true'] {
  background: var(--butter);
}
.autocomplete-option[aria-disabled='true'] {
  color: var(--muted);
  cursor: not-allowed;
}
.autocomplete-empty {
  margin: 0;
  padding: 12px;
  color: var(--muted);
  font-size: 14px;
}
</style>
