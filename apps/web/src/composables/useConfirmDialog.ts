import { onScopeDispose, ref } from 'vue';

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

export function useConfirmDialog() {
  const dialog = ref<ConfirmDialogOptions | null>(null);
  let pending: Promise<boolean> | undefined;
  let resolve: ((confirmed: boolean) => void) | undefined;

  function settle(confirmed: boolean) {
    dialog.value = null;
    resolve?.(confirmed);
    resolve = undefined;
    pending = undefined;
  }

  function confirm(options: ConfirmDialogOptions): Promise<boolean> {
    if (pending) return pending;
    dialog.value = options;
    pending = new Promise<boolean>((done) => {
      resolve = done;
    });
    return pending;
  }

  onScopeDispose(() => settle(false));
  return { dialog, confirm, settle };
}
