import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { KitchenStateResponseSchema, RecipeSchema } from '@sku-cook/shared';
import { getKitchenState, replaceKitchenMenu } from '../../api/kitchen';
import { deleteRecipe, getRecipe, setRecipeLiked } from '../../api/recipes';
import { recordCookingHistory } from '../../api/cooking-history';
import RecipeDetailView from './RecipeDetailView.vue';
import ConfirmDialog from '../../components/common/ConfirmDialog.vue';
import ShoppingPanel from '../../components/kitchen/ShoppingPanel.vue';

vi.mock('../../api/recipes', () => ({
  deleteRecipe: vi.fn(),
  getRecipe: vi.fn(),
  setRecipeLiked: vi.fn(),
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
        ConfirmDialog: true,
        ShoppingPanel: true,
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

  it('采购入口携带当前目标份数，不改变厨房或菜谱', async () => {
    const { wrapper } = await mountDetailView();
    await wrapper.get('[aria-label="增加目标份数"]').trigger('click');
    await wrapper.get('.shopping-action .button-secondary').trigger('click');
    expect(
      wrapper
        .findAllComponents(ShoppingPanel)
        .find((panel) => panel.props('show'))
        ?.props(),
    ).toMatchObject({
      show: true,
      selections: [{ recipeId: 11, targetServings: 3 }],
    });
    expect(replaceKitchenMenu).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('shows the personal heart meaning and updates the detail marker from a saved response', async () => {
    vi.mocked(setRecipeLiked).mockResolvedValue({ id: 11, isLiked: true });
    const { wrapper } = await mountDetailView();
    expect(wrapper.text()).toContain('喜欢吃，也做得好吃');
    await wrapper.get('.recipe-like-button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.recipe-like-button').attributes('aria-pressed')).toBe('true');
    expect(setRecipeLiked).toHaveBeenCalledExactlyOnceWith(11, true);
    wrapper.unmount();
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

  it('uses the shared deletion dialog, cancels safely, and prevents duplicate deletes', async () => {
    const { wrapper, router } = await mountDetailView();
    await wrapper.get('.compact-button').trigger('click');
    expect(wrapper.get('.more-menu-heading').text()).toContain('菜谱操作');
    expect(wrapper.get('.more-menu-heading button[aria-label="关闭"]').text()).toBe('×');
    await wrapper.get('.menu-action.danger-text').trigger('click');
    const dialog = wrapper.getComponent(ConfirmDialog);
    expect(dialog.props('options')?.message).toContain('已有做饭历史会保留');
    expect(deleteRecipe).not.toHaveBeenCalled();
    dialog.vm.$emit('close', false);
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/recipes/11');
    expect(deleteRecipe).not.toHaveBeenCalled();
    await wrapper.get('.menu-action.danger-text').trigger('click');
    await wrapper.get('.menu-action.danger-text').trigger('click');
    expect(
      wrapper
        .findAllComponents(ConfirmDialog)
        .filter((component) => component.props('options') !== null),
    ).toHaveLength(1);
    dialog.vm.$emit('close', true);
    await flushPromises();
    expect(deleteRecipe).toHaveBeenCalledExactlyOnceWith(11);
    expect(router.currentRoute.value.path).toBe('/recipes');
    wrapper.unmount();
  });

  it('freezes target servings during confirmation and sends the confirmed value', async () => {
    const { wrapper } = await mountDetailView();
    await wrapper.get('.compact-button').trigger('click');
    const recordButton = wrapper
      .findAll('.menu-action')
      .find((button) => button.text() === '记录做过')!;
    await recordButton.trigger('click');
    expect(recordCookingHistory).not.toHaveBeenCalled();
    const dialog = wrapper.getComponent(ConfirmDialog);
    expect(dialog.props('options')?.message).toContain('2人份');
    expect(
      wrapper
        .findAll('.servings-control button')
        .every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true);
    dialog.vm.$emit('close', true);
    await flushPromises();
    expect(recordCookingHistory).toHaveBeenCalledExactlyOnceWith({
      recipeId: 11,
      targetServings: 2,
    });
    wrapper.unmount();
  });

  it('closes the kitchen success dialog and stays on the originating recipe detail', async () => {
    const { router, wrapper } = await mountDetailView();
    await sendRecipeToKitchen(wrapper);

    expect(wrapper.get('.panel-success').text()).toContain('已发送到厨房');
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
    expect(wrapper.get('.panel-success').text()).toContain('已发送到厨房');

    await wrapper.get('.kitchen-panel .panel-actions .button-primary').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/recipes');
    expect(wrapper.text()).toContain('菜谱一览');
    expect(wrapper.find('.kitchen-panel').exists()).toBe(false);
    wrapper.unmount();
  });
});
