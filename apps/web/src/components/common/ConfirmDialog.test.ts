import { defineComponent } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ConfirmDialog from './ConfirmDialog.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

const Host = defineComponent({
  components: { ConfirmDialog },
  setup: useConfirmDialog,
  template: '<ConfirmDialog :options="dialog" @close="settle" />',
});

describe('Memo confirmation dialog', () => {
  it('renders safe text and explicit dangerous actions, with cancellation resolving false', async () => {
    const wrapper = mount(Host);
    const result = wrapper.vm.confirm({
      title: '删除菜谱',
      message: '删除「<b>番茄炒蛋</b>」？',
      confirmText: '确认删除',
      danger: true,
    });
    await flushPromises();
    const dialog = document.querySelector('.memo-confirm-dialog');
    expect(dialog?.classList.contains('memo-confirm-dialog-danger')).toBe(true);
    expect(dialog?.textContent).toContain('<b>番茄炒蛋</b>');
    expect(dialog?.querySelector('b')).toBeNull();
    expect(dialog?.querySelector('.van-dialog__confirm')?.textContent).toBe('确认删除');
    (dialog?.querySelector('.van-dialog__cancel') as HTMLButtonElement).click();
    expect(await result).toBe(false);
    wrapper.unmount();
  });

  it('shares an outstanding confirmation and settles it once before accepting another', async () => {
    const wrapper = mount(Host);
    const options = { title: '记录做过', message: '按当前份数记录？' };
    const first = wrapper.vm.confirm(options);
    expect(wrapper.vm.confirm(options)).toBe(first);
    await flushPromises();
    expect(document.querySelectorAll('.memo-confirm-dialog')).toHaveLength(1);
    (document.querySelector('.van-dialog__confirm') as HTMLButtonElement).click();
    expect(await first).toBe(true);
    const second = wrapper.vm.confirm(options);
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(await second).toBe(false);
    wrapper.unmount();
  });

  it('cancels a pending operation when its owning page unmounts', async () => {
    const wrapper = mount(Host);
    const result = wrapper.vm.confirm({ title: '确认修改', message: '确定吗？' });
    await flushPromises();
    wrapper.unmount();
    expect(await result).toBe(false);
    expect(document.querySelector('.memo-confirm-dialog')).toBeNull();
  });
});
