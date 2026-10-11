import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { KitchenStateResponseSchema, RecipeSchema } from '@sku-cook/shared';
import { getKitchenState, replaceKitchenMenu } from '../../api/kitchen';
import { getRecipe } from '../../api/recipes';
import RecipeDetailView from './RecipeDetailView.vue';

vi.mock('../../api/recipes', () => ({
  deleteRecipe: vi.fn(),
  getRecipe: vi.fn(),
}));
vi.mock('../../api/kitchen', () => ({
  clearKitchenMenu: vi.fn(),
  getKitchenState: vi.fn(),
  replaceKitchenMenu: vi.fn(),
}));
vi.mock('../../api/cooking-history', () => ({
  recordCookingHistory: vi.fn(),
}));

const recipe = RecipeSchema.parse({
  id: 11,
  title: '番茄炒蛋',
  description: null,
  servings: 2,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: null,
  tags: ['家常菜'],
  ingredients: [
    {
      name: '鸡蛋',
      amount: '3',
      unit: '个',
      note: null,
      group: null,
      scaleWithServings: true,
    },
  ],
  steps: [{ order: 1, text: '炒熟。' }],
  tips: null,
  source: null,
  createdAt: '2026-10-08T05:00:00.000Z',
  updatedAt: '2026-10-08T05:00:00.000Z',
});

const emptyKitchenState = KitchenStateResponseSchema.parse({
  session: {
    recipeIds: [],
    items: [],
    activeRecipeId: null,
    revision: 7,
    updatedAt: null,
    recipes: [],
  },
  pollIntervalSeconds: 10,
});

const addedKitchenState = KitchenStateResponseSchema.parse({
  session: {
    recipeIds: [11],
    items: [{ recipeId: 11, targetServings: 2 }],
    activeRecipeId: 11,
    revision: 8,
    updatedAt: '2026-10-08T05:00:00.000Z',
    recipes: [recipe],
  },
  pollIntervalSeconds: 10,
});

async function mountDetailView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recipes/:id', component: RecipeDetailView },
      { path: '/recipes/:id/edit', component: { template: '<div />' } },
      { path: '/recipes', component: { template: '<main>菜谱一览</main>' } },
    ],
  });
  await router.push('/recipes/11');
  await router.isReady();
  const wrapper = mount(RouterView, {
    global: {
      plugins: [router],
      stubs: {
        PageHeader: { template: '<header><slot name="right" /></header>' },
        Teleport: true,
      },
    },
  });
  await flushPromises();
  return { router, wrapper };
}

async function sendRecipeToKitchen(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('.fixed-action .button-primary').trigger('click');
  await flushPromises();
  await wrapper.get('.kitchen-panel .panel-actions .button-primary').trigger('click');
  await flushPromises();
}

describe('RecipeDetailView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getRecipe).mockResolvedValue(recipe);
    vi.mocked(getKitchenState).mockResolvedValue(emptyKitchenState);
    vi.mocked(replaceKitchenMenu).mockResolvedValue(addedKitchenState);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloads only the current recipe as an importable JSON file', async () => {
    const createObjectURL = vi.fn((blob: Blob) => {
      expect(blob).toBeInstanceOf(Blob);
      return 'blob:recipe';
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const downloadedFiles: string[] = [];
    const clickAnchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedFiles.push(this.download);
    });
    const { wrapper } = await mountDetailView();

    await wrapper.get('.compact-button').trigger('click');
    await wrapper.get('button.menu-action').trigger('click');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'application/json;charset=utf-8' }),
    );
    expect(downloadedFiles).toEqual(['番茄炒蛋.json']);
    expect(wrapper.text()).toContain('JSON文件包含1道菜谱');
    expect(clickAnchor).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('closes the kitchen success dialog and stays on the originating recipe detail', async () => {
    const { router, wrapper } = await mountDetailView();
    await sendRecipeToKitchen(wrapper);

    expect(wrapper.get('.panel-success').text()).toContain('添加成功');
    expect(replaceKitchenMenu).toHaveBeenCalledWith({
      items: [{ recipeId: 11, targetServings: 2 }],
      expectedRevision: 7,
    });
    await wrapper.get('.kitchen-panel .panel-actions .button-secondary').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/recipes/11');
    expect(wrapper.text()).toContain('番茄炒蛋');
    expect(wrapper.find('.kitchen-panel').exists()).toBe(false);
    wrapper.unmount();
  });

  it('closes the kitchen success dialog and navigates to the recipe list', async () => {
    const { router, wrapper } = await mountDetailView();
    await sendRecipeToKitchen(wrapper);
    expect(wrapper.get('.panel-success').text()).toContain('添加成功');

    await wrapper.get('.kitchen-panel .panel-actions .button-primary').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/recipes');
    expect(wrapper.text()).toContain('菜谱一览');
    expect(wrapper.find('.kitchen-panel').exists()).toBe(false);
    wrapper.unmount();
  });
});
