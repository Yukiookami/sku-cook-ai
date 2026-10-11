<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Dialog as VanDialog } from 'vant';
import 'vant/lib/dialog/style';
import type { ConfirmDialogOptions } from '../../composables/useConfirmDialog';

const props = defineProps<{ options: ConfirmDialogOptions | null }>();
const emit = defineEmits<{ close: [confirmed: boolean] }>();
const content = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;

function focusCancel() {
  content.value
    ?.closest('.van-dialog')
    ?.querySelector<HTMLButtonElement>('.van-dialog__cancel')
    ?.focus();
}

watch(
  () => props.options,
  (options) => {
    if (options) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  },
  { flush: 'pre' },
);

function onKeydown(event: KeyboardEvent) {
  if (!props.options) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    emit('close', false);
  } else if (event.key === 'Tab') {
    const buttons = content.value
      ?.closest('.van-dialog')
      ?.querySelectorAll<HTMLButtonElement>('button');
    if (!buttons?.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}

function restoreFocus() {
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  previousFocus = null;
}
onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  restoreFocus();
});
</script>

<template>
  <VanDialog
    :show="options !== null"
    :title="options?.title"
    :confirm-button-text="options?.confirmText ?? '确认'"
    :cancel-button-text="options?.cancelText ?? '取消'"
    :class-name="['memo-confirm-dialog', { 'memo-confirm-dialog-danger': options?.danger }]"
    overlay-class="memo-confirm-overlay"
    teleport="body"
    width="min(calc(100vw - 40px), 420px)"
    :aria-label="options?.title"
    :z-index="3000"
    :duration="0"
    show-cancel-button
    :close-on-click-overlay="false"
    :close-on-popstate="false"
    :keyboard-enabled="false"
    @confirm="emit('close', true)"
    @cancel="emit('close', false)"
    @opened="focusCancel"
    @closed="restoreFocus"
  >
    <p ref="content" class="memo-confirm-message">{{ options?.message }}</p>
  </VanDialog>
</template>
