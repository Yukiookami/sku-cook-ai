<script setup lang="ts">
const props = defineProps<{
  modelValue: { text: string }[];
  errors: Record<string, string>;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: { text: string }[]] }>();
function update(index: number, event: Event) {
  if (!(event.target instanceof HTMLTextAreaElement)) return;
  const text = event.target.value;
  emit(
    'update:modelValue',
    props.modelValue.map((step, i) => (i === index ? { text } : step)),
  );
}
function move(index: number, direction: number) {
  const target = index + direction;
  if (target < 0 || target >= props.modelValue.length) return;
  const next = [...props.modelValue];
  const [step] = next.splice(index, 1);
  if (step) next.splice(target, 0, step);
  emit('update:modelValue', next);
}
function remove(index: number) {
  emit(
    'update:modelValue',
    props.modelValue.length > 1 ? props.modelValue.filter((_, i) => i !== index) : [{ text: '' }],
  );
}
</script>

<template>
  <section class="paper-card form-section">
    <h2 class="section-chip">步骤 *</h2>
    <p v-if="errors.steps" class="field-error">{{ errors.steps }}</p>
    <article v-for="(step, index) in modelValue" :key="index" class="step-editor">
      <span class="step-number">{{ String(index + 1).padStart(2, '0') }}</span>
      <label class="form-field" :for="`step-${index}`">
        <span class="sr-only">步骤 {{ index + 1 }}</span>
        <textarea
          :id="`step-${index}`"
          :value="step.text"
          rows="4"
          maxlength="5000"
          required
          :aria-invalid="Boolean(errors[String(index)])"
          placeholder="写下具体做法"
          @input="update(index, $event)"
        />
        <small v-if="errors[String(index)]" class="field-error">{{ errors[String(index)] }}</small>
      </label>
      <div class="step-actions">
        <button
          class="button button-secondary"
          type="button"
          :disabled="index === 0"
          @click="move(index, -1)"
        >
          ↑ 上移
        </button>
        <button
          class="button button-secondary"
          type="button"
          :disabled="index === modelValue.length - 1"
          @click="move(index, 1)"
        >
          ↓ 下移
        </button>
        <button class="button button-danger" type="button" @click="remove(index)">删除</button>
      </div>
    </article>
    <p class="muted">步骤最多100项，每步不超过5000字。</p>
    <button
      class="button button-secondary full-width"
      type="button"
      :disabled="modelValue.length >= 100"
      @click="emit('update:modelValue', [...modelValue, { text: '' }])"
    >
      ＋ 添加步骤
    </button>
  </section>
</template>
