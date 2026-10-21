import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeListView from './RecipeListView.vue';
import { getRecipeTags, getRecipes, setRecipeLiked } from '../../api/recipes';
import { getRandomTakeoutCandidate } from '../../api/takeout';
import ShoppingPanel from '../../components/kitchen/ShoppingPanel.vue';

vi.mock('../../api/recipes', () => ({
  getRecipes: vi.fn(),
  getRecipeTags: vi.fn(),
  getRandomRecipe: vi.fn(),
  setRecipeLiked: vi.fn(),
}));
vi.mock('../../api/takeout', () => ({
  getRandomTakeoutCandidate: vi.fn(),
}));
vi.mock('../../components/kitchen/KitchenMenuPanel.vue', () => ({
  default: {
    props: ['show'],
    emits: ['close', 'sent', 'return-to-recipes'],
    template:
      '<div v-if="show" class="test-kitchen-panel"><button type="button" @click="$emit(\'sent\'); $emit(\'return-to-recipes\')">返回菜谱一览</button></div>',
  },
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
    isLiked: false,
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
    localStorage.removeItem('sku-cook-ai:recommendation-mode');
    vi.mocked(getRecipes).mockResolvedValue({
      items: Array.from({ length: 11 }, (_, index) => summary(index + 1)),
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
    vi.mocked(getRecipeTags).mockResolvedValue({ tags: [] });
    vi.mocked(getRandomTakeoutCandidate).mockResolvedValue({
      candidate: {
        id: 44,
        name: '店铺44',
        url: 'https://food.example.com/share/44',
        createdAt: '2026-10-12T00:00:00.000Z',
        updatedAt: '2026-10-12T00:00:00.000Z',
      },
      reason: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.removeItem('recipe-list-scroll');
    localStorage.removeItem('sku-cook-ai:recommendation-mode');
    observerCallback = undefined;
    observerInstance = undefined;
  });

  it('从新增菜单选择手动创建或JSON导入', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/recipes', component: RecipeListView },
        { path: '/recipes/new', component: { template: '<main>手动新建菜谱</main>' } },
        { path: '/recipes/import', component: { template: '<main>JSON导入菜谱</main>' } },
      ],
    });
    await router.push('/recipes');
    const wrapper = mount(RecipeListView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    });
    await flushPromises();

    await wrapper.get('.header-buttons button').trigger('click');
    expect(wrapper.get('.add-menu').text()).toContain('手动新增菜谱');
    expect(wrapper.get('.add-menu').text()).toContain('从 JSON 导入菜谱');
    await wrapper.get('.add-menu .menu-action').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/recipes/new');
    expect(wrapper.find('.add-menu').exists()).toBe(false);

    await wrapper.get('.header-buttons button').trigger('click');
    await wrapper.findAll('.add-menu .menu-action')[1]?.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/recipes/import');
    expect(wrapper.find('.add-menu').exists()).toBe(false);
    wrapper.unmount();
  });

  it('多选采购默认原份数，更多菜单可无选择恢复发送记录', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/recipes', component: RecipeListView }],
    });
    await router.push('/recipes');
    const wrapper = mount(RecipeListView, {
      global: { plugins: [router], stubs: { ShoppingPanel: true, Teleport: true } },
    });
    await flushPromises();
    await wrapper.get('.select-button').trigger('click');
    await wrapper.get('.recipe-card .recipe-card-main').trigger('click');
    await wrapper.get('.selection-bar .button-secondary').trigger('click');
    expect(wrapper.getComponent(ShoppingPanel).props()).toMatchObject({
      show: true,
      selections: [{ recipeId: 1, targetServings: 2 }],
    });
    wrapper.getComponent(ShoppingPanel).vm.$emit('close');
    await wrapper
      .findAll('.header-buttons button')
      .find((button) => button.text() === '更多')
      ?.trigger('click');
    const restore = wrapper
      .findAll('button')
      .find((button) => button.text() === '采购发送记录 / 重试');
    expect(restore).toBeDefined();
    await restore?.trigger('click');
    expect(wrapper.getComponent(ShoppingPanel).props()).toMatchObject({
      show: true,
      selections: [],
    });
    wrapper.unmount();
  });

  it('marks a heart without opening the recipe and disables it while selecting dishes', async () => {
    vi.mocked(setRecipeLiked).mockResolvedValue({ id: 1, isLiked: true });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/recipes', component: RecipeListView }],
    });
    await router.push('/recipes');
    const wrapper = mount(RecipeListView, { global: { plugins: [router] } });
    await flushPromises();
    const heart = wrapper.get('.recipe-card .recipe-like-button');
    await heart.trigger('click');
    await flushPromises();
    expect(heart.attributes('aria-pressed')).toBe('true');
    expect(setRecipeLiked).toHaveBeenCalledExactlyOnceWith(1, true);
    expect(router.currentRoute.value.path).toBe('/recipes');
    const select = wrapper.findAll('button').find((button) => button.text() === '选菜')!;
    await select.trigger('click');
    expect(heart.attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('keeps account actions inside More without a nested dropdown', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/recipes', component: RecipeListView },
        { path: '/account/profile', component: { template: '<p>用户中心</p>' } },
      ],
    });
    await router.push('/recipes');
    const wrapper = mount(RecipeListView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    });
    await flushPromises();
    expect(wrapper.find('.home-header .account-menu').exists()).toBe(false);
    const more = wrapper
      .findAll('.header-buttons button')
      .find((button) => button.text() === '更多');
    expect(more).toBeDefined();
    await more!.trigger('click');
    const menu = wrapper.get('.more-menu');
    expect(menu.find('details').exists()).toBe(false);
    expect(menu.text()).toContain('退出并切换账号');
    await menu.get('.more-menu-heading button[aria-label="关闭"]').trigger('click');
    expect(wrapper.find('.more-menu').exists()).toBe(false);
    await more!.trigger('click');
    await wrapper.get('.more-menu a[href="/account/profile"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/account/profile');
    expect(wrapper.find('.more-menu').exists()).toBe(false);
    wrapper.unmount();
  });

  it('switches to an independent takeout pool, excludes the current item, and opens safely', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/recipes', component: RecipeListView },
        { path: '/takeout', component: { template: '<p>候选管理</p>' } },
      ],
    });
    await router.push('/recipes');
    await router.isReady();
    const wrapper = mount(RecipeListView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    });
    await flushPromises();

    expect(wrapper.get('.home-header h1').text()).toBe('吃什么饭');
    expect(wrapper.get('#recommend-title').text()).toBe('今天吃什么？');
    await wrapper.get('.recommendation-mode-switch button:last-of-type').trigger('click');
    expect(wrapper.get('.home-header h1').text()).toBe('点什么饭');
    expect(wrapper.get('#recommend-title').text()).toBe('今天点什么？');
    expect(localStorage.getItem('sku-cook-ai:recommendation-mode')).toBe('takeout');
    expect(
      wrapper.get('.recommendation-mode-switch .segmented-switch-indicator').classes(),
    ).toContain('is-second');
    await wrapper.get('.recommendation-mode-switch button:first-of-type').trigger('click');
    expect(wrapper.get('.home-header h1').text()).toBe('吃什么饭');
    expect(wrapper.get('#recommend-title').text()).toBe('今天吃什么？');
    expect(
      wrapper.get('.recommendation-mode-switch .segmented-switch-indicator').classes(),
    ).not.toContain('is-second');
    await wrapper.get('.recommendation-mode-switch button:last-of-type').trigger('click');
    await wrapper.get('.recommend-actions .button-primary').trigger('click');
    await flushPromises();
    expect(getRandomTakeoutCandidate).toHaveBeenCalledExactlyOnceWith({});
    expect(wrapper.get('.recommend-title').text()).toBe('店铺44');
    const platformLink = wrapper.get('.recommend-actions a');
    expect(platformLink.attributes('href')).toBe('https://food.example.com/share/44');
    expect(platformLink.attributes('target')).toBe('_blank');
    expect(platformLink.attributes('rel')).toBe('noopener noreferrer');

    vi.mocked(getRandomTakeoutCandidate).mockResolvedValueOnce({
      candidate: {
        id: 45,
        name: '店铺45',
        url: 'https://food.example.com/share/45',
        createdAt: '2026-10-12T00:00:00.000Z',
        updatedAt: '2026-10-12T00:00:00.000Z',
      },
      reason: null,
    });
    await wrapper.get('.recommend-actions .button-secondary').trigger('click');
    await flushPromises();
    expect(getRandomTakeoutCandidate).toHaveBeenLastCalledWith({ excludeCandidateId: 44 });
    expect(wrapper.get('.recommend-title').text()).toBe('店铺45');

    vi.mocked(getRandomTakeoutCandidate).mockResolvedValueOnce({
      candidate: {
        id: 46,
        name: '仅支持电话点餐',
        url: '',
        createdAt: '2026-10-12T00:00:00.000Z',
        updatedAt: '2026-10-12T00:00:00.000Z',
      },
      reason: null,
    });
    await wrapper.get('.recommend-actions .button-secondary').trigger('click');
    await flushPromises();
    expect(wrapper.get('.recommend-title').text()).toBe('仅支持电话点餐');
    expect(wrapper.get('.recommend-actions').text()).toContain('换一个');
    expect(wrapper.find('.recommend-actions a').exists()).toBe(false);
    expect(wrapper.text()).toContain('此候选没有可打开的平台链接。');
    wrapper.unmount();
  });

  it('restores the selected recommendation mode after the app is reopened', async () => {
    localStorage.setItem('sku-cook-ai:recommendation-mode', 'takeout');
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/recipes', component: RecipeListView }],
    });
    await router.push('/recipes');
    await router.isReady();
    const wrapper = mount(RecipeListView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.get('.home-header h1').text()).toBe('点什么饭');
    expect(wrapper.get('#recommend-title').text()).toBe('今天点什么？');
    expect(
      wrapper.get('.recommendation-mode-switch .segmented-switch-indicator').classes(),
    ).toContain('is-second');
    wrapper.unmount();
  });

  it('offers the candidate manager when the takeout pool is empty', async () => {
    vi.mocked(getRandomTakeoutCandidate).mockResolvedValue({
      candidate: null,
      reason: 'EMPTY_LIBRARY',
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/recipes', component: RecipeListView },
        { path: '/takeout', component: { template: '<p>候选管理</p>' } },
      ],
    });
    await router.push('/recipes');
    await router.isReady();
    const wrapper = mount(RecipeListView, { global: { plugins: [router] } });
    await flushPromises();
    await wrapper.get('.recommendation-mode-switch button:last-of-type').trigger('click');
    await wrapper.get('.recommend-actions .button-primary').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('还没有外卖候选');
    expect(wrapper.text()).not.toContain('添加外卖候选');
    const manage = wrapper.findAll('button').find((button) => button.text() === '管理外卖候选');
    expect(manage).toBeDefined();
    await manage!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/takeout');
    wrapper.unmount();
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

  it('returns from a successful kitchen send to the recipe list and closes the panel', async () => {
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

    await wrapper.get('.select-button').trigger('click');
    await wrapper.get('.recipe-card-main').trigger('click');
    await wrapper.get('.selection-bar .button-primary').trigger('click');
    expect(wrapper.find('.test-kitchen-panel').exists()).toBe(true);

    await wrapper.get('.test-kitchen-panel button').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/recipes');
    expect(wrapper.find('.test-kitchen-panel').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('已选 1 道');
    wrapper.unmount();
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
    expect(
      Boolean(
        wrapper
          .get('.recommendation-card')
          .element.compareDocumentPosition(wrapper.get('.list-loading-state').element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(wrapper.find('.list-error').exists()).toBe(false);

    rejectList({ isAxiosError: true, code: 'ERR_NETWORK' });
    await flushPromises();

    expect(wrapper.find('.list-loading-state').exists()).toBe(false);
    expect(wrapper.get('.list-error').text()).toContain('无法读取菜谱');
    expect(wrapper.find('.recipe-grid').exists()).toBe(false);
    wrapper.unmount();
  });

  it('ignores and clears stale scroll restoration data on a fresh app entry', async () => {
    sessionStorage.setItem('recipe-list-scroll', '640');
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/recipes', component: RecipeListView }],
    });
    await router.push('/recipes');
    await router.isReady();
    const wrapper = mount(RecipeListView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(scrollTo).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('recipe-list-scroll')).toBeNull();
    wrapper.unmount();
  });
});
