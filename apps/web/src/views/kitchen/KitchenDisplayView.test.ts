import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    { order: 2, text: '第二道菜步骤二\n这一行继续说明步骤细节，文字换行后仍完整显示。' },
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

function mountKitchenView() {
  return mount(KitchenDisplayView);
}

describe('KitchenDisplayView A15 completion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.removeItem(wakeLockNoticeStorageKey);
    window.sessionStorage.clear();
    vi.mocked(setKitchenActiveRecipe).mockResolvedValue(queuedState);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps polling while idle and displays a menu sent after the second polling interval', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.mocked(getKitchenState)
      .mockResolvedValueOnce(emptyState)
      .mockResolvedValueOnce(emptyState)
      .mockResolvedValueOnce(queuedState)
      .mockResolvedValue(queuedState);
    const wrapper = mountKitchenView();
    await flushPromises();
    expect(wrapper.text()).toContain('厨房当前没有菜单');

    await vi.advanceTimersByTimeAsync(10000);
    await flushPromises();
    expect(getKitchenState).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('厨房当前没有菜单');

    await vi.advanceTimersByTimeAsync(10000);
    await flushPromises();
    expect(getKitchenState).toHaveBeenCalledTimes(3);
    expect(wrapper.get('.kitchen-recipe-heading h1').text()).toBe('番茄炒蛋');
    expect(wrapper.text()).toContain('炒熟。');

    await vi.advanceTimersByTimeAsync(10000);
    await flushPromises();
    expect(getKitchenState).toHaveBeenCalledTimes(4);
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(10000);
    expect(getKitchenState).toHaveBeenCalledTimes(4);
  });

  it('waits for each response and recovers polling after a failed read', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    let resolveRead: ((value: typeof emptyState) => void) | undefined;
    vi.mocked(getKitchenState)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
      )
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValue(queuedState);
    const wrapper = mountKitchenView();
    await vi.advanceTimersByTimeAsync(30000);
    expect(getKitchenState).toHaveBeenCalledTimes(1);

    resolveRead?.(emptyState);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(10000);
    await flushPromises();
    expect(getKitchenState).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('连接中断，显示上次内容');

    await vi.advanceTimersByTimeAsync(10000);
    await flushPromises();
    expect(getKitchenState).toHaveBeenCalledTimes(3);
    expect(wrapper.get('.kitchen-recipe-heading h1').text()).toBe('番茄炒蛋');
    wrapper.unmount();
  });

  it('pauses polling while hidden and immediately reads on returning to the foreground', async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.mocked(getKitchenState).mockResolvedValue(emptyState);
    const wrapper = mountKitchenView();
    await flushPromises();
    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(30000);
    expect(getKitchenState).toHaveBeenCalledTimes(1);

    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    expect(getKitchenState).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(getKitchenState).toHaveBeenCalledTimes(3);
    wrapper.unmount();
  });

  it('does not restart polling when an in-flight read resolves after unmount', async () => {
    vi.useFakeTimers();
    let resolveRead: ((value: typeof emptyState) => void) | undefined;
    vi.mocked(getKitchenState).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    );
    const wrapper = mountKitchenView();
    wrapper.unmount();
    resolveRead?.(emptyState);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(30000);
    expect(getKitchenState).toHaveBeenCalledTimes(1);
  });

  it('sends the observed revision and only celebrates after the API confirms completion', async () => {
    vi.mocked(getKitchenState).mockResolvedValueOnce(queuedState);
    vi.mocked(completeKitchenMenu).mockResolvedValueOnce(emptyState);
    const wrapper = mountKitchenView();
    await flushPromises();

    expect(wrapper.find('.account-menu').exists()).toBe(false);
    expect(wrapper.find('[aria-label="账号菜单"]').exists()).toBe(false);
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
    const wrapper = mountKitchenView();
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
    const wrapper = mountKitchenView();
    await flushPromises();

    expect(wrapper.get('.kitchen-recipe-heading h1').text()).toBe('第二道菜');
    expect(wrapper.text()).toContain('第二道菜步骤一');
    expect(wrapper.text()).toContain('第二道菜步骤二');
    expect(wrapper.text()).toContain('第二道菜步骤三');
    expect(wrapper.findAll('.kitchen-column ol li')).toHaveLength(3);
    expect(wrapper.findAll('.kitchen-step-row')).toHaveLength(3);
    expect(wrapper.findAll('.kitchen-step-text')[1]?.element.textContent).toBe(
      '第二道菜步骤二\n这一行继续说明步骤细节，文字换行后仍完整显示。',
    );
    expect(wrapper.text()).not.toContain('第 1 / 3 页');
    expect(wrapper.get('.kitchen-primary').text()).toBe('完成');
    await flushPromises();
    wrapper.unmount();
  });

  it('restores the reading position after leaving and reopening the kitchen screen', async () => {
    const originalScrollY = window.scrollY;
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.mocked(getKitchenState).mockResolvedValue(queuedState);

    const firstVisit = mountKitchenView();
    await flushPromises();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 360 });
    firstVisit.unmount();

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    const secondVisit = mountKitchenView();
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
    const firstVisit = mountKitchenView();
    await flushPromises();
    expect(firstVisit.find('.wake-lock-note').exists()).toBe(true);

    await firstVisit.get('.wake-lock-note .text-button').trigger('click');
    expect(window.localStorage.getItem(wakeLockNoticeStorageKey)).toBe('true');
    firstVisit.unmount();

    const secondVisit = mountKitchenView();
    await flushPromises();
    expect(secondVisit.find('.wake-lock-note').exists()).toBe(false);
    secondVisit.unmount();
  });
});
