import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeSchema } from '@sku-cook/shared';
import RecipeDetailView from './RecipeDetailView.vue';
import { getRecipe } from '../../api/recipes';

vi.mock('../../api/recipes', () => ({
  deleteRecipe: vi.fn(),
  getRecipe: vi.fn(),
}));
vi.mock('../../api/cooking-history', () => ({
  recordCookingHistory: vi.fn(),
}));
vi.mock('../../components/kitchen/KitchenMenuPanel.vue', () => ({
  default: { template: '<div />' },
}));

const recipe = RecipeSchema.parse({
  id: 42,
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

async function mountDetail() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recipes/:id', component: RecipeDetailView },
      { path: '/recipes/:id/edit', component: { template: '<div />' } },
    ],
  });
  await router.push('/recipes/42');
  await router.isReady();
  const wrapper = mount(RouterView, {
    global: {
      plugins: [router],
      stubs: {
        PageHeader: { template: '<header><slot name="right" /></header>' },
        Teleport: true,
        RouterLink: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('RecipeDetailView individual JSON export', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getRecipe).mockResolvedValue(recipe);
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
    const wrapper = await mountDetail();

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
});
