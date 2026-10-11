<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import {
  RecipeImportInputSchema,
  RecipeImportValidationRequestSchema,
  RECIPE_IMPORT_MAX_BYTES,
  type RecipeImportInput,
} from '@sku-cook/shared';
import PageHeader from '../../components/common/PageHeader.vue';
import { apiErrorIssues, apiErrorMessage } from '../../api/errors';
import { importRecipes, validateRecipeImport } from '../../api/recipes';
import {
  createRecipeExcelTemplate,
  parseRecipeExcel,
  RecipeExcelFormatError,
  RecipeExcelLibraryError,
  RECIPE_EXCEL_MAX_BYTES,
  type RecipeExcelIssue,
  type RecipeExcelRow,
} from '../../domain/recipe-excel-import';

const router = useRouter();
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const rows = ref<RecipeExcelRow[]>([]);
const parseIssues = ref<RecipeExcelIssue[]>([]);
const serverIssues = ref<RecipeExcelIssue[]>([]);
const parsing = ref(false);
const validating = ref(false);
const importing = ref(false);
const downloadingTemplate = ref(false);
const validationPassed = ref(false);
const importedCount = ref<number | null>(null);
const validationCount = ref(0);
const error = ref('');
const importProgress = ref<{ message: string; percent: number | null } | null>(null);
const canValidate = computed(
  () =>
    rows.value.length > 0 &&
    parseIssues.value.length === 0 &&
    !parsing.value &&
    !validating.value &&
    !importing.value,
);
let fileSequence = 0;
let requestSequence = 0;
let validatedBody: RecipeImportInput | null = null;
let validatedFile: File | null = null;

function recipeTitle(row: RecipeExcelRow): string {
  if (typeof row.recipe !== 'object' || row.recipe === null || !('title' in row.recipe)) {
    return '（未填写菜名）';
  }
  const title = row.recipe.title;
  return typeof title === 'string' && title ? title : '（未填写菜名）';
}

const fieldNames: Record<string, string> = {
  title: '菜名',
  description: '简介',
  servings: '原份数',
  prepMinutes: '准备时间',
  cookMinutes: '烹饪时间',
  difficulty: '难度',
  tags: '标签',
  ingredients: '食材',
  steps: '步骤',
  tips: '小贴士',
  source: '来源',
  name: '名称',
  amount: '数量',
  unit: '单位',
  note: '备注',
  group: '分组',
  scaleWithServings: '随份数换算',
  order: '步骤序号',
  text: '步骤内容',
};

function fieldPath(path: PropertyKey[]): string {
  const parts = path.map(String);
  if (parts[0] !== 'recipes') return parts.map((part) => fieldNames[part] ?? part).join(' · ');

  const recipeIndex = Number(parts[1]);
  const row = Number.isInteger(recipeIndex) ? rows.value[recipeIndex]?.excelRow : undefined;
  const recipePrefix = row === undefined ? '菜谱' : `Excel第${row}行`;
  const detail = parts.slice(2);
  if (detail[0] === 'ingredients' && detail.length > 1) {
    const ingredientIndex = Number(detail[1]) + 1;
    const name = detail
      .slice(2)
      .map((part) => fieldNames[part] ?? part)
      .join(' · ');
    return `${recipePrefix} · 食材第${ingredientIndex}项${name ? ` · ${name}` : ''}`;
  }
  if (detail[0] === 'steps' && detail.length > 1) {
    const stepIndex = Number(detail[1]) + 1;
    const name = detail
      .slice(2)
      .map((part) => fieldNames[part] ?? part)
      .join(' · ');
    return `${recipePrefix} · 步骤第${stepIndex}项${name ? ` · ${name}` : ''}`;
  }
  const name = detail.map((part) => fieldNames[part] ?? part).join(' · ');
  return `${recipePrefix}${name ? ` · ${name}` : ''}`;
}

function clearValidation() {
  validationPassed.value = false;
  validationCount.value = 0;
  validatedBody = null;
  validatedFile = null;
  serverIssues.value = [];
  error.value = '';
  requestSequence += 1;
}

function reportImportProgress(label: string, percent: number | null) {
  importProgress.value =
    percent !== null && percent >= 100
      ? { message: `上传完成，服务端正在${label}…`, percent: null }
      : {
          message: percent === null ? `正在传输${label}…` : `正在上传${label}…`,
          percent,
        };
}

async function selectFile(event: Event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLInputElement)) return;
  const file = target.files?.[0];
  if (!file) return;
  target.value = '';

  clearValidation();
  rows.value = [];
  parseIssues.value = [];
  selectedFile.value = null;
  const sequence = ++fileSequence;
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    error.value = '仅支持使用本页固定模板填写的 .xlsx 文件。';
    return;
  }
  if (file.size > RECIPE_EXCEL_MAX_BYTES) {
    error.value = 'Excel 文件超过 10 MiB，请选择更小的文件。';
    return;
  }

  parsing.value = true;
  error.value = '';
  try {
    const result = await parseRecipeExcel(await file.arrayBuffer());
    if (sequence !== fileSequence) return;
    rows.value = result.rows;
    parseIssues.value = result.issues;
    selectedFile.value = file;
  } catch (cause) {
    if (sequence !== fileSequence) return;
    error.value =
      cause instanceof RecipeExcelFormatError || cause instanceof RecipeExcelLibraryError
        ? cause.message
        : 'Excel 文件无法解析，请确认文件未损坏且使用本页下载的 .xlsx 模板。';
  } finally {
    if (sequence === fileSequence) parsing.value = false;
  }
}

function removeFile() {
  fileSequence += 1;
  selectedFile.value = null;
  rows.value = [];
  parseIssues.value = [];
  clearValidation();
  if (fileInput.value) fileInput.value.value = '';
}

async function downloadTemplate() {
  if (downloadingTemplate.value) return;
  downloadingTemplate.value = true;
  error.value = '';
  try {
    const data = await createRecipeExcelTemplate();
    const url = URL.createObjectURL(
      new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = '菜谱导入模板.xlsx';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (cause) {
    error.value =
      cause instanceof RecipeExcelLibraryError ? cause.message : '模板生成失败，请刷新页面后重试。';
  } finally {
    downloadingTemplate.value = false;
  }
}

async function validate() {
  if (!canValidate.value || !selectedFile.value) return;
  clearValidation();
  const request = ++requestSequence;
  const fileSnapshot = selectedFile.value;
  validating.value = true;
  error.value = '';
  serverIssues.value = [];

  const body = { version: 1 as const, recipes: rows.value.map((row) => row.recipe) };
  const requestBody = RecipeImportValidationRequestSchema.safeParse(body);
  if (!requestBody.success) {
    serverIssues.value = requestBody.error.issues.map((issue) => ({
      excelRow: rows.value[Number(issue.path[1])]?.excelRow ?? 1,
      field: fieldPath(issue.path),
      message: issue.message,
    }));
    validating.value = false;
    return;
  }
  if (
    new TextEncoder().encode(JSON.stringify(requestBody.data)).byteLength > RECIPE_IMPORT_MAX_BYTES
  ) {
    error.value = '转换后的菜谱数据超过 10 MiB，请减少内容后再导入。';
    validating.value = false;
    return;
  }

  const input = RecipeImportInputSchema.safeParse(requestBody.data);
  if (
    input.success &&
    new TextEncoder().encode(JSON.stringify(input.data)).byteLength > RECIPE_IMPORT_MAX_BYTES
  ) {
    error.value = '规范化后的菜谱数据超过 10 MiB，请减少内容后再导入。';
    validating.value = false;
    return;
  }
  try {
    importProgress.value = { message: '正在上传 Excel 转换后的菜谱…', percent: 0 };
    const result = await validateRecipeImport(requestBody.data, (percent) =>
      reportImportProgress('校验', percent),
    );
    if (request !== requestSequence || selectedFile.value !== fileSnapshot) return;
    if (!input.success) {
      serverIssues.value = input.error.issues.map((issue) => {
        const recipeIndex = Number(issue.path[1]);
        return {
          excelRow: rows.value[recipeIndex]?.excelRow ?? 1,
          field: fieldPath(issue.path),
          message: issue.message,
        };
      });
      error.value = '菜谱字段校验未通过，请修正 Excel 内容后重新上传。';
      return;
    }
    validationPassed.value = true;
    validationCount.value = result.count;
    validatedBody = input.data;
    validatedFile = fileSnapshot;
  } catch (cause) {
    if (request !== requestSequence) return;
    serverIssues.value = apiErrorIssues(cause).map((issue) => {
      const recipeIndex = Number(issue.path[1]);
      return {
        excelRow: rows.value[recipeIndex]?.excelRow ?? 1,
        field: fieldPath(issue.path),
        message: issue.message,
      };
    });
    error.value = apiErrorMessage(cause, '服务端校验失败，请检查网络后重试。');
  } finally {
    if (request === requestSequence) {
      validating.value = false;
      importProgress.value = null;
    }
  }
}

async function importValidated() {
  if (
    !validationPassed.value ||
    importing.value ||
    !validatedBody ||
    selectedFile.value !== validatedFile
  ) {
    validationPassed.value = false;
    error.value = '导入文件已变化，请重新校验。';
    return;
  }

  importing.value = true;
  importProgress.value = { message: '正在上传菜谱数据…', percent: 0 };
  error.value = '';
  serverIssues.value = [];
  try {
    const result = await importRecipes(validatedBody, (percent) =>
      reportImportProgress('写入', percent),
    );
    importedCount.value = result.importedCount;
    validationPassed.value = false;
  } catch (cause) {
    serverIssues.value = apiErrorIssues(cause).map((issue) => {
      const recipeIndex = Number(issue.path[1]);
      return {
        excelRow: rows.value[recipeIndex]?.excelRow ?? 1,
        field: fieldPath(issue.path),
        message: issue.message,
      };
    });
    error.value =
      axios.isAxiosError(cause) && !cause.response
        ? '导入结果暂未确认，请先查看菜谱一览后再决定是否重试。'
        : apiErrorMessage(cause, '导入失败，未导入任何菜谱；请修正后重新校验。');
    validationPassed.value = false;
  } finally {
    importing.value = false;
    importProgress.value = null;
  }
}

function leave() {
  if (window.history.length > 1) router.back();
  else void router.push('/recipes/import');
}

onBeforeUnmount(() => {
  fileSequence += 1;
  requestSequence += 1;
});
</script>

<template>
  <main class="page excel-import-page">
    <PageHeader title="Excel 菜谱导入" @back="leave" />
    <section class="paper-card excel-import-intro">
      <p>使用固定模板批量录入菜谱。每行一道菜，校验通过后整批导入；任何一条有误都不会写入。</p>
      <button
        class="button button-secondary full-width"
        type="button"
        :disabled="downloadingTemplate || parsing || validating || importing"
        @click="downloadTemplate"
      >
        {{ downloadingTemplate ? '正在生成模板…' : '下载 Excel 模板' }}
      </button>
      <RouterLink class="excel-json-link" to="/recipes/import">改用 JSON 导入 / 导出</RouterLink>
    </section>

    <section class="paper-card excel-template-help">
      <h2>填写说明</h2>
      <ul>
        <li>
          第2行（第一条数据）是示例菜谱，请勿删除或修改，系统会自动跳过；真实菜谱从第3行开始，每行一道菜。
        </li>
        <li>标签和步骤分别在单元格内每行填写一个；步骤顺序按行自动编号。</li>
        <li>
          食材每行一项，按“名称，数量，单位，备注，分组，随份数换算”填写；留空字段也要保留逗号。
        </li>
        <li>食材后5段可省略；“随份数换算”可填“是/否”或 true/false，留空默认是。</li>
        <li>难度可填简单、中等、复杂；原份数留空默认1。只接受 .xlsx，最多1000道、10 MiB。</li>
      </ul>
    </section>

    <section class="paper-card excel-file-card">
      <h2>选择已填写的模板</h2>
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        aria-label="选择 Excel 菜谱文件"
        :disabled="parsing || validating || importing"
        @change="selectFile"
      />
      <button
        class="button button-secondary full-width"
        type="button"
        :disabled="parsing || validating || importing"
        @click="fileInput?.click()"
      >
        {{ selectedFile?.name ?? '选择 .xlsx 文件' }}
      </button>
      <p v-if="selectedFile" class="muted file-summary">
        {{ selectedFile.name }} · {{ selectedFile.size.toLocaleString() }} 字节
        <button
          class="text-button"
          type="button"
          :disabled="validating || importing"
          @click="removeFile"
        >
          移除
        </button>
      </p>
      <p v-if="parsing" class="validation-success" role="status">正在读取工作表…</p>
      <p v-else-if="rows.length" class="validation-success" role="status">
        已读取 {{ rows.length }} 道菜谱；每条对应 Excel 第 {{ rows[0]?.excelRow }} 行等数据行。
      </p>
      <ul v-if="rows.length" class="excel-preview">
        <li v-for="row in rows.slice(0, 5)" :key="row.excelRow">
          第{{ row.excelRow }}行 · {{ recipeTitle(row) }}
        </li>
        <li v-if="rows.length > 5">另有 {{ rows.length - 5 }} 道菜谱</li>
      </ul>
    </section>

    <section v-if="parseIssues.length" class="paper-card issue-list" role="alert">
      <h2>Excel 内容格式有误</h2>
      <ul>
        <li v-for="(issue, index) in parseIssues" :key="`${issue.excelRow}-${index}`">
          <strong>第{{ issue.excelRow }}行 · {{ issue.field }}：</strong>{{ issue.message }}
        </li>
      </ul>
    </section>
    <section v-if="serverIssues.length" class="paper-card issue-list" role="alert">
      <h2>请修正以下问题</h2>
      <ul>
        <li v-for="(issue, index) in serverIssues" :key="`${issue.excelRow}-${index}`">
          <strong>{{ issue.field }}：</strong>{{ issue.message }}
        </li>
      </ul>
    </section>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <div v-if="importProgress" class="paper-card transfer-progress" role="status">
      <p>{{ importProgress.message }}</p>
      <div
        class="progress-track"
        role="progressbar"
        aria-label="菜谱导入进度"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="importProgress.percent ?? undefined"
      >
        <span
          class="progress-fill"
          :class="{ indeterminate: importProgress.percent === null }"
          :style="{
            width: importProgress.percent === null ? '35%' : `${importProgress.percent}%`,
          }"
        />
      </div>
      <p v-if="importProgress.percent !== null" class="muted">{{ importProgress.percent }}%</p>
    </div>
    <p v-if="validationPassed" class="paper-card validation-success" role="status">
      校验通过，共 {{ validationCount }} 道，尚未写入。
    </p>

    <section v-if="importedCount !== null" class="paper-card import-success" role="status">
      <h2>已导入 {{ importedCount }} 道菜谱</h2>
      <div class="button-row">
        <RouterLink class="button button-primary" to="/recipes">查看菜谱一览</RouterLink>
        <button
          class="button button-secondary"
          type="button"
          @click="
            removeFile();
            importedCount = null;
          "
        >
          继续导入
        </button>
      </div>
    </section>
    <div v-else class="fixed-action">
      <button
        v-if="!validationPassed"
        class="button button-primary"
        type="button"
        :disabled="!canValidate"
        @click="validate"
      >
        {{ validating ? '服务端校验中…' : '校验 Excel 内容' }}
      </button>
      <button
        v-else
        class="button button-primary"
        type="button"
        :disabled="importing"
        @click="importValidated"
      >
        {{ importing ? '导入中…' : `导入 ${validationCount} 道菜谱` }}
      </button>
    </div>
    <div class="bottom-spacer" aria-hidden="true" />
  </main>
</template>

<style scoped>
.excel-import-intro,
.excel-template-help,
.excel-file-card {
  margin-bottom: 16px;
}

.excel-import-intro p {
  margin-bottom: 14px;
}

.excel-json-link {
  display: inline-block;
  min-height: 44px;
  margin-top: 8px;
  padding: 9px 4px;
}

.excel-template-help h2,
.excel-file-card h2 {
  margin-bottom: 10px;
  font-size: 18px;
}

.excel-template-help ul {
  margin: 0;
  padding-left: 22px;
}

.excel-template-help li + li {
  margin-top: 6px;
}

.file-summary {
  margin: 8px 0 0;
  overflow-wrap: anywhere;
}

.excel-preview {
  margin: 12px 0 0;
  padding-left: 20px;
}

.excel-preview li + li {
  margin-top: 4px;
}

.transfer-progress {
  margin-bottom: 16px;
}

.transfer-progress p {
  margin: 0 0 8px;
}

.progress-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #fff4c2;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #ffe28a;
  transition: width 160ms ease-out;
}

.progress-fill.indeterminate {
  animation: transfer-progress 1.2s ease-in-out infinite alternate;
}

@keyframes transfer-progress {
  from {
    transform: translateX(-30%);
  }

  to {
    transform: translateX(190%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill {
    transition: none;
  }

  .progress-fill.indeterminate {
    animation: none;
  }
}
</style>
