import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeSchema } from '@sku-cook/shared';
import RecipeCreateView from './RecipeCreateView.vue';
import RecipeEditView from './RecipeEditView.vue';
import { createRecipe, getRecipe } from '../../api/recipes';

vi.mock('../../api/recipes', () => ({
  createRecipe: vi.fn(),
  getRecipe: vi.fn(async () => recipe()),
  updateRecipe: vi.fn(),
}));
vi.mock('../../components/recipes/RecipeForm.vue', () => ({
  default: {
    emits: ['submit', 'dirtyChange'],
    template:
      '<div><button data-test="dirty" @click="$emit(\'dirtyChange\', true)">改动</button><button data-test="save" @click="$emit(\'dirtyChange\', true); $emit(\'submit\', {})">保存</button></div>',
  },
}));

function recipe() {
  return RecipeSchema.parse({
    id: 42,
    title: '土豆菜',
    description: null,
    servings: 1,
    prepMinutes: null,
    cookMinutes: null,
    difficulty: null,
    tags: [],
    ingredients: [
      {
        name: '土豆',
        amount: null,
        unit: null,
        note: null,
        group: null,
        scaleWithServings: true,
      },
    ],
    steps: [{ order: 1, text: '做好。' }],
    tips: null,
    source: null,
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  });
}

describe('RecipeCreateView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getRecipe).mockResolvedValue(recipe());
  });

  it('does not show the unsaved-changes prompt after a successful save', async () => {
    vi.mocked(createRecipe).mockResolvedValue(recipe());
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/recipes/new', component: RecipeCreateView },
        { path: '/recipes/:id', component: { template: '<p>详情</p>' } },
      ],
    });
    await router.push('/recipes/new');
    await router.isReady();
    const wrapper = mount(RouterView, {
      global: { plugins: [router], stubs: { PageHeader: true } },
    });

    await wrapper.get('[data-test="save"]').trigger('click');
    await flushPromises();

    expect(createRecipe).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.fullPath).toBe('/recipes/42');
    expect(document.querySelector('.memo-confirm-dialog')).toBeNull();
    wrapper.unmount();
  });

  it.each([
    ['/recipes/new', RecipeCreateView],
    ['/recipes/42/edit', RecipeEditView],
  ] as const)(
    'confirms navigation only once from %s and keeps edits after cancellation',
    async (path, component) => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: component === RecipeEditView ? '/recipes/:id/edit' : path, component },
          { path: '/recipes', component: { template: '<p>菜谱一览</p>' } },
        ],
      });
      await router.push(path);
      const wrapper = mount(RouterView, { global: { plugins: [router] } });
      await flushPromises();
      await wrapper.get('[data-test="dirty"]').trigger('click');
      const canceledNavigation = router.push('/recipes');
      await flushPromises();
      expect(document.querySelectorAll('.memo-confirm-dialog')).toHaveLength(1);
      (document.querySelector('.van-dialog__cancel') as HTMLButtonElement).click();
      await canceledNavigation;
      expect(router.currentRoute.value.path).toBe(path);
      expect(wrapper.find('[data-test="dirty"]').exists()).toBe(true);
      const confirmedNavigation = router.push('/recipes');
      await flushPromises();
      (document.querySelector('.van-dialog__confirm') as HTMLButtonElement).click();
      await confirmedNavigation;
      expect(router.currentRoute.value.path).toBe('/recipes');
      wrapper.unmount();
    },
  );
});
