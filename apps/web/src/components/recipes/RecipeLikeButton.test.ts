import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeLikeButton from './RecipeLikeButton.vue';
import { setRecipeLiked } from '../../api/recipes';

vi.mock('../../api/recipes', () => ({ setRecipeLiked: vi.fn() }));
describe('personal recipe hearts', () => {
  beforeEach(() => vi.resetAllMocks());

  it('saves an explicit target and updates only after success; a second click unmarks it', async () => {
    vi.mocked(setRecipeLiked)
      .mockResolvedValueOnce({ id: 11, isLiked: true })
      .mockResolvedValueOnce({ id: 11, isLiked: false });
    const wrapper = mount(RecipeLikeButton, { props: { recipeId: 11, isLiked: false } });
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(setRecipeLiked).toHaveBeenCalledWith(11, true);
    expect(wrapper.emitted('updated')).toEqual([[{ id: 11, isLiked: true }]]);
    await wrapper.setProps({ isLiked: true });
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(setRecipeLiked).toHaveBeenLastCalledWith(11, false);
    wrapper.unmount();
  });

  it('prevents duplicate writes while pending and leaves state unchanged with an explicit error', async () => {
    let reject: (error: Error) => void = () => {};
    vi.mocked(setRecipeLiked).mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const wrapper = mount(RecipeLikeButton, { props: { recipeId: 11, isLiked: false } });
    await wrapper.get('button').trigger('click');
    await wrapper.get('button').trigger('click');
    expect(setRecipeLiked).toHaveBeenCalledTimes(1);
    reject(new Error('timeout'));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('刷新菜谱核对');
    expect(wrapper.emitted('updated')).toBeUndefined();
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false');
    wrapper.unmount();
  });

  it('ignores delayed responses after changing recipe or unmounting, and honors disabled selection mode', async () => {
    let complete: (result: { id: number; isLiked: boolean }) => void = () => {};
    vi.mocked(setRecipeLiked).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const wrapper = mount(RecipeLikeButton, { props: { recipeId: 11, isLiked: false } });
    await wrapper.get('button').trigger('click');
    await wrapper.setProps({ recipeId: 12, disabled: true });
    complete({ id: 11, isLiked: true });
    await flushPromises();
    expect(wrapper.emitted('updated')).toBeUndefined();
    await wrapper.get('button').trigger('click');
    expect(setRecipeLiked).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ disabled: false });
    await wrapper.get('button').trigger('click');
    wrapper.unmount();
    complete({ id: 12, isLiked: true });
    await flushPromises();
    expect(wrapper.emitted('updated')).toBeUndefined();
  });
});
