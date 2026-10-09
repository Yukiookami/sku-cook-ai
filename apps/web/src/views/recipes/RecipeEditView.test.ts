import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeSchema } from '@sku-cook/shared';
import RecipeEditView from './RecipeEditView.vue';
import { getRecipe, getRecipeTags } from '../../api/recipes';

vi.mock('../../api/recipes', () => ({
  getRecipe: vi.fn(),
  getRecipeTags: vi.fn(),
  updateRecipe: vi.fn(),
}));
vi.mock('../../components/recipes/RecipeForm.vue', () => ({
  default: {
    props: ['initialRecipe'],
    template: '<div data-test="loaded-recipe">{{ initialRecipe.title }}</div>',
  },
}));

function recipe(id: number, title: string) {
  return RecipeSchema.parse({
    id,
    title,
    description: null,
    servings: 2,
    prepMinutes: null,
    cookMinutes: null,
    difficulty: null,
    tags: [],
    ingredients: [
      {
        name: '鸡蛋',
        amount: '2',
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
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Deferred promise has not been initialized');
  };
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('RecipeEditView loading sequence', () => {
  beforeEach(() => vi.resetAllMocks());

  it('does not let an older recipe GET overwrite the latest route id', async () => {
    const first = deferred<ReturnType<typeof recipe>>();
    const second = deferred<ReturnType<typeof recipe>>();
    vi.mocked(getRecipe).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    vi.mocked(getRecipeTags).mockResolvedValue({ tags: [] });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/recipes/:id/edit', component: RecipeEditView }],
    });
    await router.push('/recipes/1/edit');
    await router.isReady();
    const wrapper = mount(RouterView, {
      global: { plugins: [router], stubs: { PageHeader: true, RouterLink: true } },
    });
    await flushPromises();

    await router.push('/recipes/2/edit');
    await flushPromises();
    second.resolve(recipe(2, '第二道菜'));
    await flushPromises();
    first.resolve(recipe(1, '第一道菜'));
    await flushPromises();

    expect(getRecipe).toHaveBeenNthCalledWith(1, 1);
    expect(getRecipe).toHaveBeenNthCalledWith(2, 2);
    expect(wrapper.get('[data-test="loaded-recipe"]').text()).toBe('第二道菜');
    wrapper.unmount();
  });
});
