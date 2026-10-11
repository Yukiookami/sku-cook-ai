import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  createRecipeExcelTemplate,
  parseRecipeExcel,
  RECIPE_EXCEL_EXAMPLE_TITLE,
  RecipeExcelFormatError,
  RECIPE_EXCEL_HEADERS,
} from './recipe-excel-import';

async function workbookBuffer(
  rows: (string | number | boolean | null)[][],
  sheetNames = ['菜谱导入模板'],
  headers: readonly string[] = RECIPE_EXCEL_HEADERS,
  exampleRow: (string | number | boolean | null)[] = [
    RECIPE_EXCEL_EXAMPLE_TITLE,
    '十分钟家常菜',
    2,
    5,
    10,
    '简单',
    '家常菜\n快手',
    '鸡蛋，3，个，打散，，是',
    '鸡蛋打散后炒熟。',
  ],
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheetName of sheetNames) {
    const worksheet = workbook.addWorksheet(sheetName);
    if (sheetName === sheetNames[0]) {
      worksheet.addRow([...headers]);
      worksheet.addRow(exampleRow);
      for (const row of rows) worksheet.addRow(row);
    }
  }
  return workbook.xlsx.writeBuffer();
}

describe('parseRecipeExcel', () => {
  it('creates a single-sheet template with a complete example recipe row', async () => {
    const output = await createRecipeExcelTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(output);
    const worksheet = workbook.worksheets[0];

    expect(workbook.worksheets).toHaveLength(1);
    expect(worksheet?.name).toBe('菜谱导入模板');
    expect(
      RECIPE_EXCEL_HEADERS.map((_, index) => worksheet?.getRow(1).getCell(index + 1).value),
    ).toEqual([...RECIPE_EXCEL_HEADERS]);
    expect(worksheet?.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(worksheet?.autoFilter).toBe('A1:K1');
    expect(RECIPE_EXCEL_EXAMPLE_TITLE).toBe('【示例，请勿删除】番茄炒蛋');
    expect(worksheet?.getRow(2).getCell(1).value).toBe(RECIPE_EXCEL_EXAMPLE_TITLE);
    expect(worksheet?.getRow(2).getCell(8).value).toContain('鸡蛋，3，个');
    expect(worksheet?.getRow(2).getCell(9).value).toContain('鸡蛋打散后炒熟');
  });

  it('always skips the first data row as the example and preserves real worksheet row numbers', async () => {
    const result = await parseRecipeExcel(
      await workbookBuffer(
        [['清炒青菜', '', '', '', '', '', '', '青菜', '炒熟。']],
        ['菜谱导入模板'],
        RECIPE_EXCEL_HEADERS,
        ['番茄炒蛋（示例被误改）'],
      ),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.excelRow).toBe(3);
    expect(result.rows[0]?.recipe).toMatchObject({ title: '清炒青菜' });
  });

  it('does not allow importing a workbook containing only the first data row example', async () => {
    await expect(parseRecipeExcel(await workbookBuffer([]))).rejects.toThrow('示例行不会导入');
  });

  it('maps a recipe row and its multiline fields into the shared import shape', async () => {
    const result = await parseRecipeExcel(
      await workbookBuffer([
        [
          '番茄炒蛋',
          '家常菜',
          2,
          5,
          10,
          '简单',
          '家常菜\n快手',
          '鸡蛋，3，个，打散，，是\n盐，适量，，，，否',
          '鸡蛋炒熟\n番茄炒软后翻匀',
          '按口味调盐',
          '家传',
        ],
      ]),
    );

    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      {
        excelRow: 3,
        recipe: {
          title: '番茄炒蛋',
          description: '家常菜',
          servings: 2,
          prepMinutes: 5,
          cookMinutes: 10,
          difficulty: 'easy',
          tags: ['家常菜', '快手'],
          ingredients: [
            {
              name: '鸡蛋',
              amount: '3',
              unit: '个',
              note: '打散',
              scaleWithServings: true,
            },
            { name: '盐', amount: '适量', scaleWithServings: false },
          ],
          steps: [
            { order: 1, text: '鸡蛋炒熟' },
            { order: 2, text: '番茄炒软后翻匀' },
          ],
          tips: '按口味调盐',
          source: '家传',
        },
      },
    ]);
  });

  it('defaults servings and ingredient scaling when their cells are blank', async () => {
    const result = await parseRecipeExcel(
      await workbookBuffer([['清炒青菜', '', '', '', '', '', '', '青菜', '炒熟']]),
    );

    expect(result.rows[0]?.recipe).toMatchObject({
      title: '清炒青菜',
      ingredients: [{ name: '青菜' }],
      steps: [{ order: 1, text: '炒熟' }],
    });
    expect(result.rows[0]?.recipe).not.toHaveProperty('servings');
  });

  it('reports malformed ingredient lines with their worksheet row', async () => {
    const result = await parseRecipeExcel(
      await workbookBuffer([
        ['炒饭', '', 1, '', '', '', '', '米饭，适量，碗，，，，extra', '炒熟'],
      ]),
    );

    expect(result.issues).toEqual([
      {
        excelRow: 3,
        field: '食材第1行',
        message: '最多填写6段内容，请用中文逗号分隔。',
      },
    ]);
  });

  it('continues to read ingredients from already downloaded pipe-delimited templates', async () => {
    const legacyHeaders: string[] = [...RECIPE_EXCEL_HEADERS];
    legacyHeaders[7] = '食材（每行：名称|数量|单位|备注|分组|随份数换算）';
    const result = await parseRecipeExcel(
      await workbookBuffer(
        [['清炒青菜', '', '', '', '', '', '', '青菜|适量|把', '炒熟']],
        ['菜谱导入模板'],
        legacyHeaders,
      ),
    );

    expect(result.rows[0]?.recipe).toMatchObject({
      ingredients: [{ name: '青菜', amount: '适量', unit: '把' }],
    });
  });

  it('accepts 1000 recipes and rejects the 1001st data row', async () => {
    const makeRows = (count: number) =>
      Array.from({ length: count }, (_, index) => [
        `菜谱${index + 1}`,
        '',
        '',
        '',
        '',
        '',
        '',
        '食材',
        '步骤',
      ]);

    const maximum = await parseRecipeExcel(await workbookBuffer(makeRows(1000)));
    expect(maximum.rows).toHaveLength(1000);
    await expect(parseRecipeExcel(await workbookBuffer(makeRows(1001)))).rejects.toThrow(
      '模板最多支持1000道菜',
    );
  });

  it('rejects a workbook that does not use the fixed single-sheet template', async () => {
    await expect(
      parseRecipeExcel(await workbookBuffer([['炒饭']], ['菜谱导入模板', '其他'])),
    ).rejects.toBeInstanceOf(RecipeExcelFormatError);
    await expect(parseRecipeExcel(await workbookBuffer([['炒饭']], ['其他']))).rejects.toThrow(
      '工作表名称需为“菜谱导入模板”',
    );
    await expect(
      parseRecipeExcel(await workbookBuffer([['炒饭']], ['菜谱导入模板'], ['错误表头'])),
    ).rejects.toThrow('表头与固定模板不一致');
  });
});
