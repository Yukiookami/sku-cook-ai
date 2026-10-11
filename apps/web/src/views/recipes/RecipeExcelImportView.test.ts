import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeExcelImportView from './RecipeExcelImportView.vue';
import { importRecipes, validateRecipeImport } from '../../api/recipes';
import { parseRecipeExcel } from '../../domain/recipe-excel-import';

vi.mock('../../api/recipes', () => ({
  importRecipes: vi.fn(),
  validateRecipeImport: vi.fn(),
}));

vi.mock('../../domain/recipe-excel-import', () => ({
  createRecipeExcelTemplate: vi.fn(),
  parseRecipeExcel: vi.fn(),
  RecipeExcelFormatError: class RecipeExcelFormatError extends Error {},
  RecipeExcelLibraryError: class RecipeExcelLibraryError extends Error {},
  RECIPE_EXCEL_MAX_BYTES: 10 * 1024 * 1024,
}));

const parsedWorkbook = {
  rows: [
    {
      excelRow: 2,
      recipe: {
        title: '番茄炒蛋',
        ingredients: [{ name: '鸡蛋' }],
        steps: [{ order: 1, text: '炒熟。' }],
      },
    },
  ],
  issues: [],
};

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recipes/import/excel', component: RecipeExcelImportView },
      { path: '/recipes/import', component: { template: '<main>JSON导入</main>' } },
      { path: '/recipes', component: { template: '<main>菜谱列表</main>' } },
      { path: '/account/profile', component: { template: '<main>用户中心</main>' } },
    ],
  });
  await router.push('/recipes/import/excel');
  await router.isReady();
  return mount(RecipeExcelImportView, { global: { plugins: [router] } });
}

async function chooseFile(wrapper: Awaited<ReturnType<typeof mountView>>) {
  vi.mocked(parseRecipeExcel).mockResolvedValueOnce(parsedWorkbook);
  const file = new File(['workbook'], 'recipes.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  Object.defineProperty(file, 'arrayBuffer', {
    value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  });
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });
  await input.trigger('change');
  await flushPromises();
  return file;
}

describe('RecipeExcelImportView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(parseRecipeExcel).mockResolvedValue(parsedWorkbook);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('describes the fixed workbook format and offers a JSON import route', async () => {
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('下载 Excel 模板');
    expect(wrapper.text()).toContain('食材每行一项');
    expect(wrapper.text()).toContain('示例菜谱，请勿删除或修改');
    expect(wrapper.text()).toContain('改用 JSON 导入 / 导出');
    wrapper.unmount();
  });

  it('validates and imports the normalized workbook through the existing A08/A09 calls', async () => {
    vi.mocked(validateRecipeImport).mockResolvedValueOnce({
      valid: true,
      count: 1,
      issues: [],
    });
    vi.mocked(importRecipes).mockResolvedValueOnce({ importedCount: 1, recipeIds: [101] });
    const wrapper = await mountView();
    await chooseFile(wrapper);

    expect(wrapper.text()).toContain('已读取 1 道菜谱');
    await wrapper.get('.fixed-action button').trigger('click');
    await flushPromises();
    expect(validateRecipeImport).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('尚未写入');

    await wrapper.get('.fixed-action button').trigger('click');
    await flushPromises();

    expect(importRecipes).toHaveBeenCalledOnce();
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

  it('maps server issues back to worksheet rows and prevents import before validation', async () => {
    vi.mocked(validateRecipeImport).mockRejectedValueOnce(
      Object.assign(new Error('validation failed'), {
        isAxiosError: true,
        response: {
          status: 422,
          data: {
            error: {
              code: 'IMPORT_VALIDATION_FAILED',
              message: '校验未通过，未导入任何菜谱',
              issues: [{ path: ['recipes', 0, 'title'], message: '已有同名菜谱' }],
            },
          },
        },
      }),
    );
    const wrapper = await mountView();
    await chooseFile(wrapper);
    await wrapper.get('.fixed-action button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Excel第2行 · 菜名');
    expect(importRecipes).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('blocks validation when workbook parsing reports format issues', async () => {
    vi.mocked(parseRecipeExcel).mockResolvedValueOnce({
      rows: parsedWorkbook.rows,
      issues: [{ excelRow: 2, field: '食材第1行', message: '内容格式错误' }],
    });
    const wrapper = await mountView();
    await chooseFile(wrapper);

    expect(wrapper.text()).toContain('第2行 · 食材第1行');
    expect(wrapper.get('.fixed-action button').attributes('disabled')).toBeDefined();
    expect(validateRecipeImport).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
