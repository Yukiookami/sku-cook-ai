import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CookingHistoryView from './CookingHistoryView.vue';
import { getCookingHistory } from '../../api/cooking-history';

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
});
