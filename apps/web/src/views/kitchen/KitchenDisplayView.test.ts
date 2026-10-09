import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KitchenStateResponseSchema } from '@sku-cook/shared';
import KitchenDisplayView from './KitchenDisplayView.vue';
import { completeKitchenMenu, getKitchenState, setKitchenActiveRecipe } from '../../api/kitchen';

vi.mock('../../api/kitchen', () => ({
  completeKitchenMenu: vi.fn(),
  getKitchenState: vi.fn(),
  setKitchenActiveRecipe: vi.fn(),
}));
vi.mock('../../composables/useWakeLock', () => ({
  useWakeLock: (_hasMenu: { value: boolean }, unavailable: { value: boolean }) => {
    unavailable.value = true;
  },
}));

const wakeLockNoticeStorageKey = 'sku-cook-ai:kitchen-wake-lock-notice-dismissed';
const recipe = {
  id: 101,
  title: '番茄炒蛋',
  description: null,
  servings: 2,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: null,
  tags: [],
  ingredients: [
    { name: '鸡蛋', amount: '3', unit: '个', note: null, group: null, scaleWithServings: true },
  ],
  steps: [{ order: 1, text: '炒熟。' }],
  tips: null,
  source: null,
  createdAt: '2026-10-08T05:00:00.000Z',
  updatedAt: '2026-10-08T05:00:00.000Z',
};

const queuedState = KitchenStateResponseSchema.parse({
  session: {
    recipeIds: [101],
    items: [{ recipeId: 101, targetServings: 3 }],
    activeRecipeId: 101,
    revision: 7,
    updatedAt: '2026-10-08T05:00:00.000Z',
    recipes: [recipe],
  },
  pollIntervalSeconds: 10,
});

const emptyState = KitchenStateResponseSchema.parse({
  session: {
    recipeIds: [],
    items: [],
    activeRecipeId: null,
    revision: 8,
    updatedAt: '2026-10-08T05:01:00.000Z',
    recipes: [],
  },
  pollIntervalSeconds: 10,
});

const firstRecipe = {
  ...recipe,
  title: '第一道菜',
  steps: [
    { order: 1, text: '第一道菜步骤一' },
    { order: 2, text: '第一道菜步骤二' },
  ],
};
const secondRecipe = {
  ...recipe,
  id: 102,
  title: '第二道菜',
  steps: [
    { order: 1, text: '第二道菜步骤一' },
    { order: 2, text: '第二道菜步骤二' },
    { order: 3, text: '第二道菜步骤三' },
  ],
};

function multiRecipeState(activeRecipeId: number, revision: number) {
  return KitchenStateResponseSchema.parse({
    session: {
      recipeIds: [101, 102],
      items: [
        { recipeId: 101, targetServings: 2 },
        { recipeId: 102, targetServings: 3 },
      ],
      activeRecipeId,
      revision,
      updatedAt: '2026-10-08T05:00:00.000Z',
      recipes: [firstRecipe, secondRecipe],
    },
    pollIntervalSeconds: 10,
  });
}

describe('KitchenDisplayView A15 completion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.removeItem(wakeLockNoticeStorageKey);
    window.sessionStorage.clear();
    vi.mocked(setKitchenActiveRecipe).mockResolvedValue(queuedState);
  });

  it('sends the observed revision and only celebrates after the API confirms completion', async () => {
    vi.mocked(getKitchenState).mockResolvedValueOnce(queuedState);
    vi.mocked(completeKitchenMenu).mockResolvedValueOnce(emptyState);
    const wrapper = mount(KitchenDisplayView);
    await flushPromises();

    await wrapper.get('.kitchen-primary').trigger('click');
    await flushPromises();

    expect(completeKitchenMenu).toHaveBeenCalledWith({ expectedRevision: 7 });
    expect(wrapper.text()).toContain('今天的菜做完了');
    wrapper.unmount();
  });

  it('keeps the uncertain-result warning visible if a follow-up read is empty', async () => {
    vi.mocked(getKitchenState).mockResolvedValueOnce(queuedState).mockResolvedValueOnce(emptyState);
    vi.mocked(completeKitchenMenu).mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { isAxiosError: true }),
    );
    const wrapper = mount(KitchenDisplayView);
    await flushPromises();

    await wrapper.get('.kitchen-primary').trigger('click');
    await flushPromises();

    expect(completeKitchenMenu).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      '完成结果暂未确认，请查看做饭历史；不会自动重复提交。',
    );
    expect(wrapper.text()).not.toContain('今天的菜做完了');
    wrapper.unmount();
  });

  it('shows the complete active recipe in one vertically scrollable view', async () => {
    vi.mocked(getKitchenState).mockResolvedValueOnce(multiRecipeState(102, 7));
    const wrapper = mount(KitchenDisplayView);
    await flushPromises();

    expect(wrapper.get('.kitchen-recipe-heading h1').text()).toBe('第二道菜');
    expect(wrapper.text()).toContain('第二道菜步骤一');
    expect(wrapper.text()).toContain('第二道菜步骤二');
    expect(wrapper.text()).toContain('第二道菜步骤三');
    expect(wrapper.findAll('.kitchen-column ol li')).toHaveLength(3);
    expect(wrapper.text()).not.toContain('第 1 / 3 页');
    expect(wrapper.get('.kitchen-primary').text()).toBe('完成');
    await flushPromises();
    wrapper.unmount();
  });

  it('restores the reading position after leaving and reopening the kitchen screen', async () => {
    const originalScrollY = window.scrollY;
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.mocked(getKitchenState).mockResolvedValue(queuedState);

    const firstVisit = mount(KitchenDisplayView);
    await flushPromises();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 360 });
    firstVisit.unmount();

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    const secondVisit = mount(KitchenDisplayView);
    await flushPromises();

    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 360,
      behavior: 'instant',
    });
    secondVisit.unmount();
    scrollTo.mockRestore();
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: originalScrollY,
    });
  });

  it('remembers dismissal of the wake-lock notice on later visits', async () => {
    vi.mocked(getKitchenState).mockResolvedValue(queuedState);
    const firstVisit = mount(KitchenDisplayView);
    await flushPromises();
    expect(firstVisit.find('.wake-lock-note').exists()).toBe(true);

    await firstVisit.get('.wake-lock-note .text-button').trigger('click');
    expect(window.localStorage.getItem(wakeLockNoticeStorageKey)).toBe('true');
    firstVisit.unmount();

    const secondVisit = mount(KitchenDisplayView);
    await flushPromises();
    expect(secondVisit.find('.wake-lock-note').exists()).toBe(false);
    secondVisit.unmount();
  });
});
