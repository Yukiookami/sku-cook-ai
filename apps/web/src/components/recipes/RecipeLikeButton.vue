<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import type { RecipeLikeResponse } from '@sku-cook/shared';
import { setRecipeLiked } from '../../api/recipes';
import { apiErrorMessage } from '../../api/errors';

const props = defineProps<{ recipeId: number; isLiked: boolean; disabled?: boolean }>();
const emit = defineEmits<{ updated: [result: RecipeLikeResponse] }>();
const pending = ref(false);
const error = ref('');
let sequence = 0;
watch(
  () => props.recipeId,
  () => {
    sequence += 1;
    pending.value = false;
    error.value = '';
  },
);
onBeforeUnmount(() => {
  sequence += 1;
});

async function toggle() {
  if (pending.value || props.disabled) return;
  const request = ++sequence;
  const id = props.recipeId;
  pending.value = true;
  error.value = '';
  try {
    const result = await setRecipeLiked(id, !props.isLiked);
    if (request === sequence) emit('updated', result);
  } catch (cause) {
    if (request === sequence)
      error.value = apiErrorMessage(cause, '爱心保存结果暂未确认，请刷新菜谱核对后再操作。');
  } finally {
    if (request === sequence) pending.value = false;
  }
}
</script>

<template>
  <div class="recipe-like-control">
    <button
      class="recipe-like-button"
      :class="{ 'recipe-liked': isLiked }"
      type="button"
      :aria-pressed="isLiked"
      :aria-label="isLiked ? '取消爱心标记' : '点爱心：喜欢吃，也做得好吃'"
      title="喜欢吃，也做得好吃"
      :disabled="pending || disabled"
      @click.stop="toggle"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 21s-9-5.5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12Z"
          :fill="isLiked ? 'currentColor' : 'none'"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linejoin="round"
        />
      </svg>
      <span>{{ pending ? '保存中…' : isLiked ? '已点爱心' : '点爱心' }}</span>
    </button>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
  </div>
</template>
