import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomeView from './HomeView.vue';
import { getHealth } from '../api/health';

vi.mock('../api/health', () => ({ getHealth: vi.fn() }));

describe('HomeView', () => {
  beforeEach(() => vi.resetAllMocks());

  it('shows the successful API connection', async () => {
    vi.mocked(getHealth).mockResolvedValue({ status: 'ok', service: 'sku-cook-ai-api' });
    const wrapper = mount(HomeView);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('连接成功');
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined();
  });

  it('shows a readable error and allows retry', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(getHealth).mockRejectedValue(new Error('Network unavailable'));
    const wrapper = mount(HomeView);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('无法连接后端');
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
