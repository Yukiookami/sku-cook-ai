import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CookingHistoryView from './CookingHistoryView.vue';
import { deleteCookingHistory, getCookingHistory } from '../../api/cooking-history';
import ConfirmDialog from '../../components/common/ConfirmDialog.vue';

vi.mock('../../api/cooking-history', () => ({
  deleteCookingHistory: vi.fn(),
  getCookingHistory: vi.fn(),
}));

describe('CookingHistoryView initial read recovery', () => {
  beforeEach(() => vi.resetAllMocks());

  it('shows a retry after the first page request fails and recovers on click', async () => {
    vi.mocked(getCookingHistory)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ items: [], page: 1, pageSize: 20, hasMore: false });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/cooking-history', component: CookingHistoryView }],
    });
    await router.push('/cooking-history');
    await router.isReady();
    const wrapper = mount(CookingHistoryView, {
      global: { plugins: [router], stubs: { PageHeader: true, RouterLink: true } },
    });
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('无法读取做饭历史');
    const retry = wrapper.get('[role="alert"] button');
    expect(retry.text()).toBe('重新读取');
    await retry.trigger('click');
    await flushPromises();

    expect(getCookingHistory).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('还没有做饭记录');
    wrapper.unmount();
  });

  it('cancels deletion without writing and keeps records if confirmed deletion fails', async () => {
    vi.mocked(getCookingHistory).mockResolvedValue({
      items: [
        {
          id: 7,
          cookedAt: '2026-10-11T08:00:00.000Z',
          source: 'manual',
          items: [{ recipeId: 11, title: '番茄炒蛋', targetServings: 2 }],
        },
      ],
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
    vi.mocked(deleteCookingHistory).mockRejectedValue(new Error('network unavailable'));
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/cooking-history', component: CookingHistoryView }],
    });
    await router.push('/cooking-history');
    const wrapper = mount(CookingHistoryView, {
      global: {
        plugins: [router],
        stubs: { PageHeader: true, RouterLink: true, ConfirmDialog: true },
      },
    });
    await flushPromises();
    const remove = wrapper.findAll('button').find((button) => button.text() === '删除这次记录')!;
    await remove.trigger('click');
    const dialog = wrapper.getComponent(ConfirmDialog);
    expect(dialog.props('options')?.danger).toBe(true);
    expect(dialog.props('options')?.message).toContain('菜谱和厨房菜单不会改变');
    dialog.vm.$emit('close', false);
    await flushPromises();
    expect(deleteCookingHistory).not.toHaveBeenCalled();
    await remove.trigger('click');
    await remove.trigger('click');
    dialog.vm.$emit('close', true);
    await flushPromises();
    expect(deleteCookingHistory).toHaveBeenCalledExactlyOnceWith(7);
    expect(wrapper.text()).toContain('番茄炒蛋');
    expect(wrapper.text()).toContain('删除结果暂未确认');
    wrapper.unmount();
  });
});
