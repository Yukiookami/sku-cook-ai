import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeSchema } from '@sku-cook/shared';
import RecipeCreateView from './RecipeCreateView.vue';
import { createRecipe } from '../../api/recipes';

vi.mock('../../api/recipes', () => ({
  createRecipe: vi.fn(),
}));
vi.mock('../../components/recipes/RecipeForm.vue', () => ({
  default: {
    emits: ['submit', 'dirtyChange'],
    template:
      '<button data-test="save" @click="$emit(\'dirtyChange\', true); $emit(\'submit\', {})">保存</button>',
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
  beforeEach(() => vi.resetAllMocks());

  it('does not show the unsaved-changes prompt after a successful save', async () => {
    vi.mocked(createRecipe).mockResolvedValue(recipe());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
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
    expect(confirm).not.toHaveBeenCalled();
    wrapper.unmount();
    confirm.mockRestore();
  });
});
