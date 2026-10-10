<script setup lang="ts">
import { computed, ref } from 'vue';
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
import { exportRecipes, importRecipes, validateRecipeImport } from '../../api/recipes';

type InputMode = 'file' | 'paste';
const router = useRouter();
const mode = ref<InputMode>('paste');
const text = ref('');
const fileName = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const showExample = ref(false);
const validating = ref(false);
const importing = ref(false);
const validationPassed = ref(false);
const validationCount = ref(0);
const importedCount = ref<number | null>(null);
const exporting = ref(false);
const exportStatus = ref('');
const exportProgress = ref<{ message: string; percent: number | null } | null>(null);
const importProgress = ref<{ message: string; percent: number | null } | null>(null);
const error = ref('');
const issues = ref<{ path: PropertyKey[]; message: string }[]>([]);
const inputBytes = computed(() => new TextEncoder().encode(text.value).byteLength);
const canValidate = computed(
  () => text.value.trim().length > 0 && !validating.value && !importing.value,
);
let requestSequence = 0;
let fileReadSequence = 0;
let validatedBody: RecipeImportInput | null = null;
let validatedText = '';

const example = `{
  "version": 1,
  "recipes": [
    {
      "title": "番茄炒蛋",
      "description": "十分钟家常菜",
      "servings": 2,
      "prepMinutes": 5,
      "cookMinutes": 10,
      "difficulty": "easy",
      "tags": ["家常菜", "快手"],
      "ingredients": [
        { "name": "鸡蛋", "amount": "3", "unit": "个" },
        { "name": "番茄", "amount": "2", "unit": "个", "note": "切块" },
        { "name": "盐", "amount": "适量" }
      ],
      "steps": [
        { "order": 1, "text": "鸡蛋打散。" },
        { "order": 2, "text": "番茄炒软后与鸡蛋翻匀。" }
      ],
      "tips": "按口味调整盐量。",
      "source": "家常菜谱"
    }
  ]
}`;

function changeMode(next: InputMode) {
  if (mode.value === next) return;
  invalidate();
  fileReadSequence += 1;
  mode.value = next;
  text.value = '';
  fileName.value = '';
  validationPassed.value = false;
  validationCount.value = 0;
  importedCount.value = null;
  if (fileInput.value) fileInput.value.value = '';
}

async function selectFile(event: Event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLInputElement)) return;
  const file = target.files?.[0];
  if (!file) return;
  invalidate();
  const sequence = ++fileReadSequence;
  text.value = '';
  fileName.value = '';
  if (!file.name.toLowerCase().endsWith('.json')) {
    error.value = '请选择扩展名为 .json 的文件。';
    return;
  }
  if (file.size > RECIPE_IMPORT_MAX_BYTES) {
    error.value = '文件超过 10 MiB，请选择更小的 JSON 文件。';
    return;
  }
  try {
    const content = await file.text();
    if (sequence !== fileReadSequence || mode.value !== 'file') return;
    text.value = content;
    fileName.value = file.name;
  } catch {
    if (sequence === fileReadSequence) error.value = '无法读取该文件，请重新选择。';
  }
}

async function exportAllRecipes() {
  if (exporting.value) return;
  exporting.value = true;
  exportProgress.value = { message: '正在下载备份 JSON…', percent: 0 };
  exportStatus.value = '';
  error.value = '';
  try {
    const data = await exportRecipes((percent) => {
      exportProgress.value =
        percent !== null && percent >= 100
          ? { message: '下载完成，正在准备文件…', percent: null }
          : { message: '正在下载备份 JSON…', percent };
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const revokeObjectURL = URL.revokeObjectURL.bind(URL);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recipes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => revokeObjectURL(url), 1000);
    exportStatus.value =
      data.recipes.length > 0
        ? `已导出 ${data.recipes.length} 道菜谱，可在另一台设备的菜谱导入 / 导出页恢复。`
        : '菜库为空，已导出空菜谱文件。';
  } catch (cause) {
    error.value = apiErrorMessage(cause, '导出失败，请检查网络后重试。');
  } finally {
    exporting.value = false;
    exportProgress.value = null;
  }
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

function invalidate() {
  validationPassed.value = false;
  validationCount.value = 0;
  validatedBody = null;
  validatedText = '';
  issues.value = [];
  error.value = '';
  validating.value = false;
  importProgress.value = null;
  requestSequence += 1;
}

function humanPath(path: PropertyKey[]): string {
  const parts = path.map(String);
  const recipeIndex = parts[0] === 'recipes' ? Number(parts[1]) : -1;
  const prefix =
    Number.isInteger(recipeIndex) && recipeIndex >= 0 ? `第${recipeIndex + 1}道菜 · ` : '';
  const field = parts.slice(parts[0] === 'recipes' ? 2 : 0).join(' · ');
  return `${prefix}${field || '整体'}`;
}

async function validate() {
  if (!canValidate.value) return;
  invalidate();
  const request = ++requestSequence;
  const snapshot = text.value;
  validating.value = true;
  error.value = '';
  issues.value = [];
  if (inputBytes.value > RECIPE_IMPORT_MAX_BYTES) {
    error.value = '粘贴内容超过 10 MiB，请缩减后再校验。';
    validating.value = false;
    return;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(snapshot);
  } catch {
    error.value = 'JSON 格式有误，请检查括号、引号及逗号。原文已保留。';
    validating.value = false;
    return;
  }

  const requestBody = RecipeImportValidationRequestSchema.safeParse(parsedJson);
  if (!requestBody.success) {
    error.value = '需要包含 version: 1 和 recipes 数组，请检查导入结构。';
    validating.value = false;
    return;
  }
  const input = RecipeImportInputSchema.safeParse(parsedJson);
  try {
    importProgress.value = { message: '正在上传校验数据…', percent: 0 };
    const result = await validateRecipeImport(requestBody.data, (percent) =>
      reportImportProgress('校验', percent),
    );
    if (request !== requestSequence || text.value !== snapshot) return;
    validationPassed.value = true;
    validationCount.value = result.count;
    validatedText = snapshot;
    validatedBody = input.success ? input.data : null;
  } catch (cause) {
    if (request !== requestSequence) return;
    const validationIssues = apiErrorIssues(cause);
    issues.value = validationIssues.map((issue) => ({
      path: [...issue.path],
      message: issue.message,
    }));
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
    validatedText !== text.value ||
    !validatedBody
  ) {
    validationPassed.value = false;
    error.value = '导入内容已变化，请重新校验。';
    return;
  }
  importing.value = true;
  importProgress.value = { message: '正在上传菜谱数据…', percent: 0 };
  error.value = '';
  issues.value = [];
  try {
    const result = await importRecipes(validatedBody, (percent) =>
      reportImportProgress('写入', percent),
    );
    importedCount.value = result.importedCount;
    validationPassed.value = false;
  } catch (cause) {
    issues.value = apiErrorIssues(cause).map((issue) => ({
      path: [...issue.path],
      message: issue.message,
    }));
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

async function copyExample() {
  try {
    await navigator.clipboard.writeText(example);
    error.value = '';
  } catch {
    error.value = '复制失败，请手动选中示例文本复制。';
  }
}

function leave() {
  if (window.history.length > 1) router.back();
  else void router.push('/recipes');
}
</script>

<template>
  <main class="page import-page">
    <PageHeader title="菜谱导入 / 导出" @back="leave" />
    <section class="paper-card import-intro">
      <p>
        JSON 菜谱迁移：导出当前完整菜库，或导入备份文件。单次最多 1000 道、10
        MiB；任意一条出错，整批不导入。
      </p>
      <button
        class="button button-secondary full-width"
        type="button"
        :disabled="exporting || importing || validating"
        @click="exportAllRecipes"
      >
        {{ exporting ? '导出中…' : '导出全部菜谱 JSON' }}
      </button>
      <div v-if="exporting && exportProgress" class="transfer-progress" role="status">
        <p>{{ exportProgress.message }}</p>
        <div
          class="progress-track"
          role="progressbar"
          aria-label="菜谱导出进度"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="exportProgress.percent ?? undefined"
        >
          <span
            class="progress-fill"
            :class="{ indeterminate: exportProgress.percent === null }"
            :style="{
              width: exportProgress.percent === null ? '35%' : `${exportProgress.percent}%`,
            }"
          />
        </div>
        <p v-if="exportProgress.percent !== null" class="muted">{{ exportProgress.percent }}%</p>
      </div>
      <p v-if="exportStatus" class="validation-success" role="status">{{ exportStatus }}</p>
    </section>
    <div v-if="importedCount !== null" class="paper-card import-success" role="status">
      <h2>已导入 {{ importedCount }} 道菜谱</h2>
      <p>菜谱列表会重新读取最新内容。</p>
      <div class="button-row">
        <RouterLink class="button button-primary" to="/recipes">查看菜谱一览</RouterLink>
        <button
          class="button button-secondary"
          type="button"
          @click="
            importedCount = null;
            text = '';
            invalidate();
          "
        >
          继续导入
        </button>
      </div>
    </div>
    <template v-else>
      <section class="paper-card import-input-card">
        <div class="mode-switch" role="tablist" aria-label="选择导入方式">
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'file'"
            :class="{ active: mode === 'file' }"
            :disabled="importing"
            @click="changeMode('file')"
          >
            选择 JSON 文件
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'paste'"
            :class="{ active: mode === 'paste' }"
            :disabled="importing"
            @click="changeMode('paste')"
          >
            粘贴 JSON
          </button>
        </div>
        <template v-if="mode === 'file'">
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            accept=".json,application/json"
            aria-label="选择 JSON 文件"
            :disabled="importing"
            @change="selectFile"
          />
          <button
            class="button button-secondary full-width"
            type="button"
            :disabled="importing"
            @click="fileInput?.click()"
          >
            {{ fileName || '选择 JSON 文件' }}
          </button>
          <p v-if="fileName" class="muted">
            {{ fileName }} · {{ inputBytes.toLocaleString() }} 字节
            <button
              class="text-button"
              type="button"
              :disabled="importing"
              @click="
                text = '';
                fileName = '';
                invalidate();
              "
            >
              移除
            </button>
          </p>
        </template>
        <label v-else class="form-field">
          <span class="sr-only">粘贴 JSON 内容</span>
          <textarea
            v-model="text"
            class="json-input"
            rows="12"
            spellcheck="false"
            :disabled="importing"
            placeholder="请粘贴完整的 JSON 文本"
            @input="invalidate"
          />
          <span class="muted">{{ inputBytes.toLocaleString() }} / 10,485,760 字节</span>
        </label>
        <div class="example-row">
          <p class="muted">完整示例包含食材和步骤；结构片段不能直接导入。</p>
          <button class="button button-secondary" type="button" @click="showExample = !showExample">
            {{ showExample ? '收起示例' : '查看示例' }}
          </button>
        </div>
        <div v-if="showExample" class="example-content">
          <pre>{{ example }}</pre>
          <button class="text-button" type="button" @click="copyExample">复制示例</button>
        </div>
        <div v-if="importProgress" class="transfer-progress" role="status">
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
        <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
        <div v-if="issues.length" class="issue-list" role="alert">
          <h2>请修正以下问题</h2>
          <ul>
            <li v-for="(issue, index) in issues" :key="`${index}-${humanPath(issue.path)}`">
              <strong>{{ humanPath(issue.path) }}：</strong>{{ issue.message }}
            </li>
          </ul>
        </div>
        <p v-if="validationPassed" class="validation-success" role="status">
          校验通过，共 {{ validationCount }} 道，尚未写入。
        </p>
      </section>
      <div class="fixed-action">
        <button
          v-if="!validationPassed"
          class="button button-primary"
          type="button"
          :disabled="!canValidate"
          @click="validate"
        >
          {{ validating ? '校验中…' : '校验 JSON' }}
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
    </template>
    <div class="bottom-spacer" aria-hidden="true" />
  </main>
</template>

<style scoped>
.transfer-progress {
  margin-top: 12px;
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
