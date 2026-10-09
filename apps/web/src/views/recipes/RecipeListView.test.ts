import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeListView from './RecipeListView.vue';
import { getRecipeTags, getRecipes } from '../../api/recipes';

vi.mock('../../api/recipes', () => ({
  getRecipes: vi.fn(),
  getRecipeTags: vi.fn(),
  getRandomRecipe: vi.fn(),
}));
vi.mock('../../components/kitchen/KitchenMenuPanel.vue', () => ({
  default: { template: '<div />' },
}));

let observerCallback: IntersectionObserverCallback | undefined;
let observerInstance: IntersectionObserver | undefined;

class TestIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '200px';
  readonly thresholds: ReadonlyArray<number> = [0];

  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
    observerInstance = {
      root: null,
      rootMargin: '200px',
      thresholds: [0],
      disconnect() {},
      observe() {},
      unobserve() {},
      takeRecords() {
        return [];
      },
    };
  }

  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function summary(id: number) {
  return {
    id,
    title: `菜谱${id}`,
    description: null,
    servings: 2,
    prepMinutes: null,
    cookMinutes: null,
    difficulty: null,
    tags: [],
    updatedAt: '2026-10-08T05:00:00.000Z',
  };
}

describe('RecipeListView selection behavior', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getRecipes).mockResolvedValue({
      items: Array.from({ length: 11 }, (_, index) => summary(index + 1)),
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
    vi.mocked(getRecipeTags).mockResolvedValue({ tags: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    observerCallback = undefined;
    observerInstance = undefined;
  });

  it('allows up to ten recipes and explains the eleventh selection', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/recipes', component: RecipeListView },
        { path: '/recipes/:id', component: { template: '<div />' } },
      ],
    });
    await router.push('/recipes');
    await router.isReady();
    const wrapper = mount(RecipeListView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    });
    await flushPromises();

    await wrapper.get('.select-button').trigger('click');
    const rows = wrapper.findAll('.recipe-card-main');
    for (const row of rows.slice(0, 10)) await row.trigger('click');
    expect(wrapper.text()).toContain('已选 10 道');

    await rows[10]?.trigger('click');
    expect(wrapper.text()).toContain('一次最多选择10道菜');
    expect(wrapper.text()).toContain('已选 10 道');
  });

  it('ignores repeated observer callbacks without orphaning the in-flight page request', async () => {
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
    let resolvePage: (value: Awaited<ReturnType<typeof getRecipes>>) => void = () => {
      throw new Error('Page request has not started');
    };
    const nextPage = new Promise<Awaited<ReturnType<typeof getRecipes>>>((resolve) => {
      resolvePage = resolve;
    });
    vi.mocked(getRecipes)
      .mockResolvedValueOnce({
        items: Array.from({ length: 20 }, (_, index) => summary(index + 1)),
        page: 1,
        pageSize: 20,
        hasMore: true,
      })
      .mockReturnValueOnce(nextPage);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/recipes', component: RecipeListView }],
    });
    await router.push('/recipes');
    await router.isReady();
    const wrapper = mount(RecipeListView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    });
    await flushPromises();

    const entry = {
      boundingClientRect: new DOMRect(),
      intersectionRatio: 1,
      intersectionRect: new DOMRect(),
      isIntersecting: true,
      rootBounds: null,
      target: document.createElement('div'),
      time: 0,
    } satisfies IntersectionObserverEntry;
    if (observerCallback && observerInstance) {
      observerCallback([entry], observerInstance);
      observerCallback([entry], observerInstance);
    }
    await flushPromises();
    expect(getRecipes).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('正在加载更多…');

    resolvePage({
      items: [summary(21)],
      page: 2,
      pageSize: 20,
      hasMore: false,
    });
    await flushPromises();

    expect(wrapper.text()).toContain('菜谱21');
    expect(wrapper.text()).toContain('已经到底了');
    expect(wrapper.text()).not.toContain('正在加载更多…');
    wrapper.unmount();
  });

  it('shows identical list and tag load errors once and retries both requests', async () => {
    const serverError = {
      isAxiosError: true,
      response: { status: 500 },
    };
    vi.mocked(getRecipes).mockRejectedValue(serverError);
    vi.mocked(getRecipeTags).mockRejectedValue(serverError);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/recipes', component: RecipeListView }],
    });
    await router.push('/recipes');
    await router.isReady();
    const wrapper = mount(RecipeListView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    });
    await flushPromises();

    expect(wrapper.text().match(/服务暂时出错，请稍后重试。/g)).toHaveLength(1);
    expect(wrapper.text()).not.toContain('重试标签');

    await wrapper.get('.list-error button').trigger('click');
    await flushPromises();
    expect(getRecipes).toHaveBeenCalledTimes(2);
    expect(getRecipeTags).toHaveBeenCalledTimes(2);
    expect(wrapper.text().match(/服务暂时出错，请稍后重试。/g)).toHaveLength(1);
    wrapper.unmount();
  });

  it('keeps a visible loading state until the first recipe request fails', async () => {
    let rejectList: (cause: unknown) => void = () => {
      throw new Error('Recipe request has not started');
    };
    const pendingList = new Promise<Awaited<ReturnType<typeof getRecipes>>>((_, reject) => {
      rejectList = reject;
    });
    vi.mocked(getRecipes).mockReturnValueOnce(pendingList);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/recipes', component: RecipeListView }],
    });
    await router.push('/recipes');
    await router.isReady();
    const wrapper = mount(RecipeListView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    });
    await flushPromises();

    expect(wrapper.get('.list-loading-state').text()).toContain('正在加载菜谱');
    expect(wrapper.find('.list-error').exists()).toBe(false);

    rejectList({ isAxiosError: true, code: 'ERR_NETWORK' });
    await flushPromises();

    expect(wrapper.find('.list-loading-state').exists()).toBe(false);
    expect(wrapper.get('.list-error').text()).toContain('无法读取菜谱');
    expect(wrapper.find('.recipe-grid').exists()).toBe(false);
    wrapper.unmount();
  });
});
