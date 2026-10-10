import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeImportView from './RecipeImportView.vue';
import { exportRecipes, importRecipes, validateRecipeImport } from '../../api/recipes';

vi.mock('../../api/recipes', () => ({
  exportRecipes: vi.fn(),
  importRecipes: vi.fn(),
  validateRecipeImport: vi.fn(),
}));

const validImport = JSON.stringify({
  version: 1,
  recipes: [
    {
      title: '番茄炒蛋',
      ingredients: [{ name: '鸡蛋' }],
      steps: [{ order: 1, text: '炒熟。' }],
    },
  ],
});

const differentImport = JSON.stringify({
  version: 1,
  recipes: [
    {
      title: '冬瓜汤',
      ingredients: [{ name: '冬瓜' }],
      steps: [{ order: 1, text: '煮熟。' }],
    },
  ],
});

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Deferred promise has not been initialized');
  };
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/recipes/import', component: RecipeImportView }],
  });
  return router.push('/recipes/import').then(async () => {
    await router.isReady();
    return mount(RecipeImportView, {
      global: { plugins: [router], stubs: { RouterLink: true } },
    });
  });
}

describe('RecipeImportView', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('shows all server validation issues with 1-based recipe indices', async () => {
    vi.mocked(validateRecipeImport).mockRejectedValueOnce(
      Object.assign(new Error('validation failed'), {
        isAxiosError: true,
        response: {
          status: 422,
          data: {
            error: {
              code: 'IMPORT_VALIDATION_FAILED',
              message: '校验未通过，未导入任何菜谱',
              issues: [
                { path: ['recipes', 1, 'title'], message: '已有同名菜谱' },
                { path: ['recipes', 1, 'steps', 0, 'text'], message: '请填写步骤描述' },
              ],
            },
          },
        },
      }),
    );
    const wrapper = await mountView();
    expect(wrapper.get('h1').text()).toBe('菜谱导入 / 导出');
    await wrapper.get('.json-input').setValue(validImport);
    await wrapper.get('.fixed-action button').trigger('click');
    await flushPromises();

    expect(validateRecipeImport).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('第2道菜 · title：已有同名菜谱');
    expect(wrapper.text()).toContain('第2道菜 · steps · 0 · text：请填写步骤描述');
    expect(importRecipes).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('downloads the complete import-compatible JSON export and reports its recipe count', async () => {
    vi.mocked(exportRecipes).mockResolvedValueOnce({
      version: 1,
      recipes: [
        {
          title: '番茄炒蛋',
          servings: 2,
          tags: [],
          ingredients: [{ name: '鸡蛋', scaleWithServings: true }],
          steps: [{ order: 1, text: '炒熟。' }],
        },
      ],
    });
    const createObjectURL = vi.fn(() => 'blob:recipes');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const wrapper = await mountView();

    await wrapper.get('button.full-width').trigger('click');
    await flushPromises();

    expect(exportRecipes).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('已导出 1 道菜谱');
    wrapper.unmount();
  });

  it('shows the measured export download percentage while the request is active', async () => {
    const pending = deferred<{
      version: 1;
      recipes: [];
    }>();
    vi.mocked(exportRecipes).mockImplementationOnce((onProgress) => {
      onProgress?.(42);
      return pending.promise;
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:recipes'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const wrapper = await mountView();

    await wrapper.get('button.full-width').trigger('click');
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('42');

    pending.resolve({ version: 1, recipes: [] });
    await flushPromises();
    wrapper.unmount();
  });

  it('shows upload percentage during import validation and server-side processing afterward', async () => {
    const pending = deferred<{ valid: true; count: number; issues: [] }>();
    vi.mocked(validateRecipeImport).mockImplementationOnce((_input, onProgress) => {
      onProgress?.(100);
      return pending.promise;
    });
    const wrapper = await mountView();
    await wrapper.get('.json-input').setValue(validImport);
    await wrapper.get('.fixed-action button').trigger('click');

    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBeUndefined();
    expect(wrapper.text()).toContain('服务端正在校验');

    pending.resolve({ valid: true, count: 1, issues: [] });
    await flushPromises();
    wrapper.unmount();
  });

  it('shows the measured upload percentage while the validated batch is being imported', async () => {
    const pending = deferred<{ importedCount: number; recipeIds: number[] }>();
    vi.mocked(validateRecipeImport).mockResolvedValueOnce({
      valid: true,
      count: 1,
      issues: [],
    });
    vi.mocked(importRecipes).mockImplementationOnce((_input, onProgress) => {
      onProgress?.(57);
      return pending.promise;
    });
    const wrapper = await mountView();
    await wrapper.get('.json-input').setValue(validImport);
    await wrapper.get('.fixed-action button').trigger('click');
    await flushPromises();
    await wrapper.get('.fixed-action button').trigger('click');

    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('57');

    pending.resolve({ importedCount: 1, recipeIds: [103] });
    await flushPromises();
    wrapper.unmount();
  });

  it('shows a clear error if exporting fails', async () => {
    vi.mocked(exportRecipes).mockRejectedValueOnce(new Error('offline'));
    const wrapper = await mountView();

    await wrapper.get('button.full-width').trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('导出失败');
    wrapper.unmount();
  });

  it('imports the same validated JSON with shared defaults after A08 passes', async () => {
    vi.mocked(validateRecipeImport).mockResolvedValueOnce({
      valid: true,
      count: 1,
      issues: [],
    });
    vi.mocked(importRecipes).mockResolvedValueOnce({ importedCount: 1, recipeIds: [101] });
    const wrapper = await mountView();
    await wrapper.get('.json-input').setValue(validImport);
    await wrapper.get('.fixed-action button').trigger('click');
    await flushPromises();
    await wrapper.get('.fixed-action button').trigger('click');
    await flushPromises();

    expect(vi.mocked(validateRecipeImport).mock.calls[0]?.[0]).toEqual({
      version: 1,
      recipes: [
        {
          title: '番茄炒蛋',
          ingredients: [{ name: '鸡蛋' }],
          steps: [{ order: 1, text: '炒熟。' }],
        },
      ],
    });
    expect(vi.mocked(importRecipes).mock.calls[0]?.[0]).toEqual({
      version: 1,
      recipes: [
        {
          title: '番茄炒蛋',
          servings: 1,
          tags: [],
          ingredients: [{ name: '鸡蛋', scaleWithServings: true }],
          steps: [{ order: 1, text: '炒熟。' }],
        },
      ],
    });
    expect(wrapper.text()).toContain('已导入 1 道菜谱');
    wrapper.unmount();
  });

  it('does not let a delayed validation mark a newly selected file as validated', async () => {
    const oldValidation = deferred<{ valid: true; count: number; issues: [] }>();
    vi.mocked(validateRecipeImport)
      .mockReturnValueOnce(oldValidation.promise)
      .mockResolvedValueOnce({ valid: true, count: 1, issues: [] });
    vi.mocked(importRecipes).mockResolvedValueOnce({ importedCount: 1, recipeIds: [102] });
    const wrapper = await mountView();
    await wrapper.get('.json-input').setValue(validImport);
    await wrapper.get('.fixed-action button').trigger('click');
    expect(wrapper.get('.fixed-action button').attributes('disabled')).toBeDefined();

    await wrapper.get('[role="tab"]').trigger('click');
    const file = new File([differentImport], 'new-recipes.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: vi.fn().mockResolvedValue(differentImport) });
    const fileInput = wrapper.get('input[type="file"]');
    Object.defineProperty(fileInput.element, 'files', {
      configurable: true,
      value: [file],
    });
    await fileInput.trigger('change');
    await flushPromises();

    oldValidation.resolve({ valid: true, count: 1, issues: [] });
    await flushPromises();
    expect(wrapper.text()).toContain('new-recipes.json');
    expect(wrapper.get('.fixed-action button').text()).toContain('校验 JSON');
    expect(importRecipes).not.toHaveBeenCalled();

    await wrapper.get('.fixed-action button').trigger('click');
    await flushPromises();
    await wrapper.get('.fixed-action button').trigger('click');
    await flushPromises();
    expect(vi.mocked(importRecipes).mock.calls[0]?.[0]).toEqual({
      version: 1,
      recipes: [
        {
          title: '冬瓜汤',
          servings: 1,
          tags: [],
          ingredients: [{ name: '冬瓜', scaleWithServings: true }],
          steps: [{ order: 1, text: '煮熟。' }],
        },
      ],
    });
    wrapper.unmount();
  });

  it('releases the validating state when editing or switching modes invalidates A08', async () => {
    const oldValidation = deferred<{ valid: true; count: number; issues: [] }>();
    const modeValidation = deferred<{ valid: true; count: number; issues: [] }>();
    vi.mocked(validateRecipeImport)
      .mockReturnValueOnce(oldValidation.promise)
      .mockReturnValueOnce(modeValidation.promise);
    const wrapper = await mountView();
    await wrapper.get('.json-input').setValue(validImport);
    await wrapper.get('.fixed-action button').trigger('click');
    await wrapper.get('.json-input').setValue(differentImport);
    expect(wrapper.get('.fixed-action button').attributes('disabled')).toBeUndefined();

    await wrapper.get('.fixed-action button').trigger('click');
    await wrapper.get('[role="tab"]').trigger('click');
    expect(wrapper.find('input[type="file"]').exists()).toBe(true);
    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');
    await wrapper.get('.json-input').setValue(validImport);
    expect(wrapper.get('.fixed-action button').attributes('disabled')).toBeUndefined();

    oldValidation.resolve({ valid: true, count: 1, issues: [] });
    modeValidation.resolve({ valid: true, count: 1, issues: [] });
    await flushPromises();
    expect(wrapper.get('.fixed-action button').text()).toContain('校验 JSON');
    wrapper.unmount();
  });
});
