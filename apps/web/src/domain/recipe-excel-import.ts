import type ExcelJS from 'exceljs';
import { RECIPE_IMPORT_MAX_BYTES, RECIPE_IMPORT_MAX_RECIPES } from '@sku-cook/shared';

export const RECIPE_EXCEL_HEADERS = [
  '菜名（必填）',
  '简介',
  '原份数',
  '准备时间（分钟）',
  '烹饪时间（分钟）',
  '难度（简单/中等/复杂）',
  '标签（每行一个）',
  '食材（每行：名称，数量，单位，备注，分组，随份数换算）',
  '步骤（每行一步）',
  '小贴士',
  '来源',
] as const;

export const RECIPE_EXCEL_EXAMPLE_TITLE = '【示例，请勿删除】番茄炒蛋';

const RECIPE_EXCEL_EXAMPLE_ROW = [
  RECIPE_EXCEL_EXAMPLE_TITLE,
  '十分钟家常菜',
  2,
  5,
  10,
  '简单',
  '家常菜\n快手',
  '鸡蛋，3，个，打散，，是\n番茄，2，个，切块，，是\n盐，适量，，，，否',
  '鸡蛋打散后炒熟。\n番茄炒软，与鸡蛋翻匀。\n加盐调味后出锅。',
  '鸡蛋先炒至凝固，口感更嫩。',
  '家常菜谱',
] as const;

const INGREDIENT_FIELDS = ['数量', '单位', '备注', '分组', '随份数换算'] as const;
const LEGACY_RECIPE_EXCEL_HEADERS = RECIPE_EXCEL_HEADERS.map((header, index) =>
  index === 7 ? '食材（每行：名称|数量|单位|备注|分组|随份数换算）' : header,
);
const RECIPE_EXCEL_MAX_WORKSHEET_ROWS = 10_001;

export type RecipeExcelRow = {
  excelRow: number;
  recipe: unknown;
};

export type RecipeExcelIssue = {
  excelRow: number;
  field: string;
  message: string;
};

export type RecipeExcelParseResult = {
  rows: RecipeExcelRow[];
  issues: RecipeExcelIssue[];
};

export class RecipeExcelFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeExcelFormatError';
  }
}

export class RecipeExcelLibraryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RecipeExcelLibraryError';
  }
}

async function loadExcelJS() {
  try {
    return (await import('exceljs')).default;
  } catch (cause) {
    throw new RecipeExcelLibraryError('Excel解析组件未能加载，请检查网络后刷新页面重试。', {
      cause,
    });
  }
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText
      .map((part) => part.text)
      .join('')
      .trim();
  }
  throw new RecipeExcelFormatError('只支持普通文字或数字单元格，请移除公式或特殊内容。');
}

function optionalNumber(value: string): number | string | undefined {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) return value;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : value;
}

function withOptionalNumber(target: Record<string, unknown>, key: string, value: string): void {
  const parsed = optionalNumber(value);
  if (parsed !== undefined) target[key] = parsed;
}

function parseDifficulty(value: string): string | undefined {
  if (!value) return undefined;
  if (value === '简单') return 'easy';
  if (value === '中等') return 'medium';
  if (value === '复杂') return 'hard';
  return value;
}

function parseScaleWithServings(value: string): boolean | string | undefined {
  if (!value) return undefined;
  if (value === '是' || value.toLowerCase() === 'true') return true;
  if (value === '否' || value.toLowerCase() === 'false') return false;
  return value;
}

function parseIngredients(value: string, excelRow: number, issues: RecipeExcelIssue[]) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const delimiter = line.includes('，') ? '，' : '|';
      const parts = line.split(delimiter).map((part) => part.trim());
      if (parts.length > INGREDIENT_FIELDS.length + 1) {
        issues.push({
          excelRow,
          field: `食材第${index + 1}行`,
          message: '最多填写6段内容，请用中文逗号分隔。',
        });
      }
      return {
        name: parts[0] ?? '',
        ...(parts[1] ? { amount: parts[1] } : {}),
        ...(parts[2] ? { unit: parts[2] } : {}),
        ...(parts[3] ? { note: parts[3] } : {}),
        ...(parts[4] ? { group: parts[4] } : {}),
        ...(parts[5] ? { scaleWithServings: parseScaleWithServings(parts[5]) } : {}),
      };
    });
}

function isBlankRow(row: ExcelJS.Row): boolean {
  for (let column = 1; column <= RECIPE_EXCEL_HEADERS.length; column += 1) {
    if (row.getCell(column).value !== null && row.getCell(column).value !== undefined) return false;
  }
  return true;
}

export async function parseRecipeExcel(data: ArrayBuffer): Promise<RecipeExcelParseResult> {
  const ExcelJSRuntime = await loadExcelJS();
  const workbook = new ExcelJSRuntime.Workbook();
  await workbook.xlsx.load(data);

  if (workbook.worksheets.length !== 1) {
    throw new RecipeExcelFormatError('模板必须只有一个工作表，请下载并使用本页提供的模板。');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new RecipeExcelFormatError('Excel 文件中没有可读取的工作表。');
  }
  if (worksheet.name !== '菜谱导入模板') {
    throw new RecipeExcelFormatError('工作表名称需为“菜谱导入模板”，请使用本页下载的模板。');
  }

  const header = worksheet.getRow(1);
  const extraHeadersAreBlank = Array.from(
    { length: Math.max(0, header.cellCount - RECIPE_EXCEL_HEADERS.length) },
    (_, index) => header.getCell(RECIPE_EXCEL_HEADERS.length + index + 1),
  ).every((cell) => cell.value === null || cell.value === undefined);
  const headersMatch =
    extraHeadersAreBlank &&
    [RECIPE_EXCEL_HEADERS, LEGACY_RECIPE_EXCEL_HEADERS].some((expectedHeaders) =>
      expectedHeaders.every((expected, index) => cellText(header.getCell(index + 1)) === expected),
    );
  if (!headersMatch) {
    throw new RecipeExcelFormatError('表头与固定模板不一致，请下载最新模板后再填写。');
  }

  if (worksheet.rowCount > RECIPE_EXCEL_MAX_WORKSHEET_ROWS) {
    throw new RecipeExcelFormatError('工作表行数过多，请删除多余空行后重试。');
  }

  const rows: RecipeExcelRow[] = [];
  const issues: RecipeExcelIssue[] = [];

  for (let excelRow = 2; excelRow <= worksheet.rowCount; excelRow += 1) {
    const row = worksheet.getRow(excelRow);
    if (excelRow === 2) continue;
    if (isBlankRow(row)) continue;
    if (rows.length >= RECIPE_IMPORT_MAX_RECIPES) {
      throw new RecipeExcelFormatError(
        `模板最多支持${RECIPE_IMPORT_MAX_RECIPES}道菜，请删除多余菜谱。`,
      );
    }

    const values: string[] = [];
    for (let column = 1; column <= RECIPE_EXCEL_HEADERS.length; column += 1) {
      try {
        values.push(cellText(row.getCell(column)));
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : '单元格内容无法读取，请检查后重试。';
        issues.push({
          excelRow,
          field: RECIPE_EXCEL_HEADERS[column - 1] ?? '未知列',
          message,
        });
        values.push('');
      }
    }

    for (let column = RECIPE_EXCEL_HEADERS.length + 1; column <= row.cellCount; column += 1) {
      if (row.getCell(column).value !== null && row.getCell(column).value !== undefined) {
        issues.push({
          excelRow,
          field: '额外列',
          message: '模板仅支持规定的11列，请删除多余列内容。',
        });
        break;
      }
    }

    const [
      title,
      description,
      servings,
      prepMinutes,
      cookMinutes,
      difficulty,
      tags,
      ingredients,
      steps,
      tips,
      source,
    ] = values;

    const recipe: Record<string, unknown> = {
      title,
      ...(description ? { description } : {}),
      ...(difficulty ? { difficulty: parseDifficulty(difficulty) } : {}),
      tags: (tags ?? '')
        .split(/\r?\n/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      ingredients: parseIngredients(ingredients ?? '', excelRow, issues),
      steps: (steps ?? '')
        .split(/\r?\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text, index) => ({ order: index + 1, text })),
      ...(tips ? { tips } : {}),
      ...(source ? { source } : {}),
    };
    withOptionalNumber(recipe, 'servings', servings ?? '');
    withOptionalNumber(recipe, 'prepMinutes', prepMinutes ?? '');
    withOptionalNumber(recipe, 'cookMinutes', cookMinutes ?? '');
    rows.push({ excelRow, recipe });
  }

  if (rows.length === 0) {
    throw new RecipeExcelFormatError('模板中没有可导入的菜谱数据；示例行不会导入，请填写其他行。');
  }

  return { rows, issues };
}

export async function createRecipeExcelTemplate(): Promise<ArrayBuffer> {
  const ExcelJSRuntime = await loadExcelJS();
  const workbook = new ExcelJSRuntime.Workbook();
  const worksheet = workbook.addWorksheet('菜谱导入模板');
  worksheet.addRow([...RECIPE_EXCEL_HEADERS]);
  worksheet.addRow([...RECIPE_EXCEL_EXAMPLE_ROW]);
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: RECIPE_EXCEL_HEADERS.length },
  };
  worksheet.columns = [
    { width: 22 },
    { width: 28 },
    { width: 12 },
    { width: 16 },
    { width: 16 },
    { width: 22 },
    { width: 22 },
    { width: 58 },
    { width: 45 },
    { width: 36 },
    { width: 28 },
  ];
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FF332E28' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF4C2' },
  };
  const exampleRow = worksheet.getRow(2);
  exampleRow.font = { italic: true, color: { argb: 'FF716452' } };

  const output = await workbook.xlsx.writeBuffer();
  return output;
}

export const RECIPE_EXCEL_MAX_BYTES = RECIPE_IMPORT_MAX_BYTES;
