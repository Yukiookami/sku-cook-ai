<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import {
  TAKEOUT_IMPORT_MAX_BYTES,
  TAKEOUT_IMPORT_MAX_CANDIDATES,
  TakeoutCandidateInputSchema,
  TakeoutImportInputSchema,
  type ApiErrorIssue,
  type TakeoutCandidate,
  type TakeoutImportInput,
} from '@sku-cook/shared';
import ConfirmDialog from '../../components/common/ConfirmDialog.vue';
import PageHeader from '../../components/common/PageHeader.vue';
import SegmentedSwitch from '../../components/common/SegmentedSwitch.vue';
import { apiErrorIssues, apiErrorMessage } from '../../api/errors';
import {
  createTakeoutCandidate,
  deleteTakeoutCandidate,
  getTakeoutCandidates,
  importTakeoutCandidates,
  updateTakeoutCandidate,
} from '../../api/takeout';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { copyTextToClipboard } from '../../utils/clipboard';

const candidates = ref<TakeoutCandidate[]>([]);
const router = useRouter();
const loading = ref(false);
const loaded = ref(false);
const listError = ref('');
const saving = ref(false);
const saveError = ref('');
const saveStatus = ref('');
const saveFieldErrors = ref({ name: '', url: '' });
const name = ref('');
const url = ref('');
const editingId = ref<number | null>(null);
const saveNeedsReconcile = ref(false);
const deletingId = ref<number | null>(null);
const deleteError = ref('');
const deleteNeedsReconcile = ref(false);
const uncertainDeleteId = ref<number | null>(null);
const importError = ref('');
const importIssues = ref<string[]>([]);
const importStatus = ref('');
const exportError = ref('');
const exportStatus = ref('');
const exporting = ref(false);
const importing = ref(false);
const importNeedsReconcile = ref(false);
const importCanRetry = ref(false);
const importBaselineIds = ref<number[]>([]);
const pendingImport = ref<TakeoutImportInput | null>(null);
const importMode = ref<'file' | 'paste'>('file');
const importModes = [
  { label: '选择 JSON 文件', value: 'file' },
  { label: '粘贴 JSON', value: 'paste' },
] as const;
const pastedJson = ref('');
const pastedBytes = computed(() => new TextEncoder().encode(pastedJson.value).byteLength);
const exampleStatus = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const { dialog, confirm, settle } = useConfirmDialog();
let requestSequence = 0;
let writeSequence = 0;
let fileReadSequence = 0;

function issueText(issue: ApiErrorIssue): string {
  const [root, index, field] = issue.path;
  if (root === 'candidates' && typeof index === 'number') {
    const label = field === 'name' ? '名称' : field === 'url' ? '分享链接' : '内容';
    return `第${index + 1}项${label}：${issue.message}`;
  }
  return issue.message;
}

function localIssues(issues: ApiErrorIssue[]): string[] {
  return issues.map(issueText);
}

async function loadCandidates() {
  const sequence = ++requestSequence;
  loading.value = true;
  listError.value = '';
  try {
    const latestCandidates = await getTakeoutCandidates();
    if (sequence !== requestSequence) return;
    candidates.value = latestCandidates;
    loaded.value = true;
    if (saveNeedsReconcile.value) saveError.value = '';
    if (importNeedsReconcile.value && pendingImport.value) {
      const baselineIds = new Set(importBaselineIds.value);
      const newlyAdded = latestCandidates.filter(({ id }) => !baselineIds.has(id));
      const available = new Map<string, number>();
      for (const candidate of newlyAdded) {
        const key = JSON.stringify([candidate.name, candidate.url]);
        available.set(key, (available.get(key) ?? 0) + 1);
      }
      const allImported = pendingImport.value.candidates.every(({ name, url }) => {
        const key = JSON.stringify([name, url]);
        const count = available.get(key) ?? 0;
        if (count === 0) return false;
        available.set(key, count - 1);
        return true;
      });
      const anyImported = newlyAdded.some(({ name, url }) =>
        pendingImport.value?.candidates.some((item) => item.name === name && item.url === url),
      );

      if (allImported) {
        importStatus.value = `已在列表中确认导入 ${pendingImport.value.candidates.length} 项。`;
        pendingImport.value = null;
        importNeedsReconcile.value = false;
        importCanRetry.value = false;
        importError.value = '';
        importBaselineIds.value = [];
      } else if (!anyImported) {
        importNeedsReconcile.value = false;
        importCanRetry.value = true;
        importError.value = '重新读取后未发现本次新增项。确认列表无误后，可以再次确认导入。';
      } else {
        importError.value = '只找到部分匹配项。为避免重复导入，请检查下方列表后重新读取核对。';
      }
    }
    if (deleteNeedsReconcile.value) {
      deleteError.value = candidates.value.some(({ id }) => id === uncertainDeleteId.value)
        ? '重新读取后，该候选仍在列表中。确认后可再次删除。'
        : '';
      deleteNeedsReconcile.value = false;
      uncertainDeleteId.value = null;
    }
    saveNeedsReconcile.value = false;
  } catch (cause) {
    if (sequence === requestSequence) {
      listError.value = apiErrorMessage(cause, '无法读取外卖候选，请检查网络后重试。');
    }
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

function clearForm() {
  editingId.value = null;
  name.value = '';
  url.value = '';
  saveError.value = '';
  saveFieldErrors.value = { name: '', url: '' };
}

function editCandidate(candidate: TakeoutCandidate) {
  editingId.value = candidate.id;
  name.value = candidate.name;
  url.value = candidate.url;
  saveError.value = '';
  saveFieldErrors.value = { name: '', url: '' };
  saveStatus.value = '';
}

async function saveCandidate() {
  if (saving.value || saveNeedsReconcile.value) return;
  const parsed = TakeoutCandidateInputSchema.safeParse({ name: name.value, url: url.value });
  if (!parsed.success) {
    const paths = new Set(parsed.error.issues.map((issue) => issue.path[0]));
    saveFieldErrors.value = {
      name: paths.has('name')
        ? name.value.trim()
          ? '名称不能超过 100 个字符。'
          : '请填写店铺或菜品名称。'
        : '',
      url: paths.has('url')
        ? url.value.trim()
          ? '请输入有效的 HTTP 或 HTTPS 分享链接。'
          : '请填写平台分享链接。'
        : '',
    };
    saveError.value = '';
    return;
  }
  saveFieldErrors.value = { name: '', url: '' };
  const sequence = ++writeSequence;
  saving.value = true;
  saveError.value = '';
  saveStatus.value = '';
  const wasEditing = editingId.value !== null;
  try {
    if (editingId.value === null) await createTakeoutCandidate(parsed.data);
    else await updateTakeoutCandidate(editingId.value, parsed.data);
    if (sequence !== writeSequence) return;
    clearForm();
    saveStatus.value = wasEditing ? '已保存修改。' : '已添加外卖候选。';
    await loadCandidates();
  } catch (cause) {
    if (sequence !== writeSequence) return;
    saveError.value = apiErrorMessage(cause, '保存失败，请检查网络后重试。');
    if (axios.isAxiosError(cause) && (!cause.response || cause.response.status >= 500)) {
      saveNeedsReconcile.value = true;
      saveError.value = '保存结果暂未确认，请重新读取候选列表核对后再保存。';
    }
  } finally {
    if (sequence === writeSequence) saving.value = false;
  }
}

async function removeCandidate(candidate: TakeoutCandidate) {
  if (deletingId.value !== null) return;
  if (
    !(await confirm({
      title: '删除外卖候选',
      message: `删除“${candidate.name}”？删除后不会影响外卖平台上的内容。`,
      confirmText: '确认删除',
      danger: true,
    }))
  )
    return;
  const sequence = ++writeSequence;
  deletingId.value = candidate.id;
  deleteError.value = '';
  try {
    await deleteTakeoutCandidate(candidate.id);
    if (sequence !== writeSequence) return;
    candidates.value = candidates.value.filter((item) => item.id !== candidate.id);
    if (editingId.value === candidate.id) clearForm();
  } catch (cause) {
    if (sequence !== writeSequence) return;
    deleteError.value = apiErrorMessage(cause, '删除失败，请重新读取后重试。');
    if (axios.isAxiosError(cause) && (!cause.response || cause.response.status >= 500)) {
      deleteError.value = '删除结果暂未确认，请重新读取候选列表核对。';
      deleteNeedsReconcile.value = true;
      uncertainDeleteId.value = candidate.id;
    }
  } finally {
    if (sequence === writeSequence) deletingId.value = null;
  }
}

function cancelImport() {
  fileReadSequence += 1;
  pendingImport.value = null;
  importNeedsReconcile.value = false;
  importCanRetry.value = false;
  importBaselineIds.value = [];
  pastedJson.value = '';
  importError.value = '';
  importIssues.value = [];
  importStatus.value = '';
  if (fileInput.value) fileInput.value.value = '';
}

function changeImportMode(mode: 'file' | 'paste') {
  if (importMode.value === mode || importing.value || importNeedsReconcile.value) return;
  fileReadSequence += 1;
  importMode.value = mode;
  pendingImport.value = null;
  importCanRetry.value = false;
  importIssues.value = [];
  importError.value = '';
  importStatus.value = '';
  pastedJson.value = '';
  exampleStatus.value = '';
  if (fileInput.value) fileInput.value.value = '';
}

function prepareImport(text: string, source: 'file' | 'paste') {
  pendingImport.value = null;
  importIssues.value = [];
  importError.value = '';
  importStatus.value = '';
  importCanRetry.value = false;
  if (new TextEncoder().encode(text).byteLength > TAKEOUT_IMPORT_MAX_BYTES) {
    importError.value =
      source === 'file' ? 'JSON 文件不能超过 10 MiB。' : '粘贴内容不能超过 10 MiB，请缩减后重试。';
    return;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    importError.value =
      source === 'file'
        ? '文件不是有效的 JSON，请检查语法后重试。'
        : '粘贴内容不是有效的 JSON，请检查语法后重试。';
    return;
  }
  const parsed = TakeoutImportInputSchema.safeParse(data);
  if (!parsed.success) {
    importIssues.value = localIssues(
      parsed.error.issues.map((issue) => ({
        path: issue.path.map((part) => (typeof part === 'number' ? part : String(part))),
        message: issue.message,
      })),
    );
    importError.value = 'JSON 校验未通过，尚未导入任何候选。';
    return;
  }
  const seen = new Map<string, number>();
  const duplicateIssues: ApiErrorIssue[] = [];
  parsed.data.candidates.forEach((candidate, index) => {
    if (!candidate.url) return;
    const previous = seen.get(candidate.url);
    if (previous === undefined) seen.set(candidate.url, index);
    else {
      duplicateIssues.push({
        path: ['candidates', index, 'url'],
        message: `与第${previous + 1}项的分享链接重复`,
      });
    }
  });
  if (duplicateIssues.length) {
    importIssues.value = localIssues(duplicateIssues);
    importError.value = 'JSON 中包含重复分享链接，尚未导入任何候选。';
    return;
  }
  pendingImport.value = parsed.data;
}

async function readImportFile(file: File, sequence: number) {
  pendingImport.value = null;
  importIssues.value = [];
  importError.value = '';
  importStatus.value = '';
  if (file.size > TAKEOUT_IMPORT_MAX_BYTES) {
    importError.value = 'JSON 文件不能超过 10 MiB。';
    return;
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    if (sequence === fileReadSequence) importError.value = '无法读取此文件，请重新选择。';
    return;
  }
  if (sequence !== fileReadSequence) return;
  prepareImport(text, 'file');
}

async function copyImportExample() {
  const example = JSON.stringify(
    {
      version: 1,
      candidates: [{ name: '店铺名称', url: 'https://example.com/share' }],
    },
    null,
    2,
  );
  try {
    await copyTextToClipboard(example);
    exampleStatus.value = 'JSON 格式示例已复制，可粘贴给 GPT 参考。';
  } catch {
    exampleStatus.value = '无法自动复制，请手动选中上方格式示例。';
  }
}

async function exportCandidates() {
  if (exporting.value || !loaded.value || candidates.value.length === 0) return;
  if (candidates.value.length > TAKEOUT_IMPORT_MAX_CANDIDATES) {
    exportError.value = `当前有 ${candidates.value.length} 项，超过 JSON 单次导入上限 ${TAKEOUT_IMPORT_MAX_CANDIDATES} 项，未导出。`;
    return;
  }

  exporting.value = true;
  exportError.value = '';
  exportStatus.value = '';
  try {
    const data = TakeoutImportInputSchema.parse({
      version: 1,
      candidates: candidates.value.map(({ name, url }) => ({ name, url })),
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `takeout-candidates-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    exportStatus.value = `已导出 ${data.candidates.length} 项，可在其他账号导入或作为备份保存。`;
  } catch (cause) {
    exportError.value = apiErrorMessage(cause, '导出失败，请检查浏览器后重试。');
  } finally {
    exporting.value = false;
  }
}

function onFileChange(event: Event) {
  const input = event.currentTarget;
  if (!(input instanceof HTMLInputElement)) return;
  const file = input.files?.[0];
  input.value = '';
  if (file) void readImportFile(file, ++fileReadSequence);
}

function back() {
  if (window.history.length > 1) router.back();
  else void router.push('/recipes');
}

async function submitImport() {
  if (!pendingImport.value || importing.value || importNeedsReconcile.value) return;
  const sequence = ++writeSequence;
  importing.value = true;
  importError.value = '';
  importIssues.value = [];
  importStatus.value = '';
  importCanRetry.value = false;
  importBaselineIds.value = candidates.value.map(({ id }) => id);
  try {
    const result = await importTakeoutCandidates(pendingImport.value);
    if (sequence !== writeSequence) return;
    pendingImport.value = null;
    importNeedsReconcile.value = false;
    importBaselineIds.value = [];
    importStatus.value = `成功导入 ${result.importedCount} 项外卖候选。`;
    await loadCandidates();
  } catch (cause) {
    if (sequence !== writeSequence) return;
    importError.value = apiErrorMessage(cause, '导入失败，请检查文件后重试。');
    importIssues.value = localIssues(apiErrorIssues(cause));
    if (axios.isAxiosError(cause) && (!cause.response || cause.response.status >= 500)) {
      importNeedsReconcile.value = true;
      importError.value = '导入结果暂未确认，请重新读取候选列表核对后再导入。';
    }
  } finally {
    if (sequence === writeSequence) importing.value = false;
  }
}

onMounted(() => void loadCandidates());
onBeforeUnmount(() => {
  requestSequence += 1;
  writeSequence += 1;
  fileReadSequence += 1;
});
</script>

<template>
  <main class="page takeout-page">
    <ConfirmDialog :options="dialog" @close="settle" />
    <PageHeader title="外卖候选" @back="back" />

    <p class="takeout-intro">保存店铺或菜品，分享链接可选；首页可以随机挑选今天点什么。</p>
    <p v-if="listError" class="inline-error" role="alert">
      {{ listError }}
      <button class="text-button" type="button" @click="loadCandidates">重新读取</button>
    </p>
    <p v-if="saveError" class="inline-error" role="alert">
      {{ saveError }}
      <button v-if="saveNeedsReconcile" class="text-button" type="button" @click="loadCandidates">
        重新读取候选
      </button>
    </p>
    <p v-if="deleteError" class="inline-error" role="alert">
      {{ deleteError }}
      <button class="text-button" type="button" @click="loadCandidates">重新读取</button>
    </p>
    <p v-if="saveStatus" class="inline-note" role="status">{{ saveStatus }}</p>

    <section class="paper-card takeout-form-card" aria-labelledby="candidate-form-title">
      <h2 id="candidate-form-title">{{ editingId === null ? '添加候选' : '编辑候选' }}</h2>
      <form class="takeout-form" novalidate @submit.prevent="saveCandidate">
        <label class="form-field">
          <span>店铺或菜品名称 <b aria-hidden="true">*</b></span>
          <input
            v-model="name"
            type="text"
            maxlength="100"
            required
            :aria-invalid="Boolean(saveFieldErrors.name)"
            :aria-describedby="saveFieldErrors.name ? 'candidate-name-error' : undefined"
            autocomplete="off"
            placeholder="例如：楼下的兰州牛肉面"
          />
          <small v-if="saveFieldErrors.name" id="candidate-name-error" class="field-error">
            {{ saveFieldErrors.name }}
          </small>
        </label>
        <label class="form-field">
          <span>平台分享链接 <span class="muted">（可选）</span></span>
          <input
            v-model="url"
            type="url"
            maxlength="2048"
            :aria-invalid="Boolean(saveFieldErrors.url)"
            :aria-describedby="saveFieldErrors.url ? 'candidate-url-error' : undefined"
            autocomplete="url"
            placeholder="如有链接，可粘贴 HTTP(S) 分享链接"
          />
          <small v-if="saveFieldErrors.url" id="candidate-url-error" class="field-error">
            {{ saveFieldErrors.url }}
          </small>
        </label>
        <p class="muted">没有可跳转链接也可以添加；仅在提供链接时才可打开外卖平台。</p>
        <p class="muted">不会抓取页面内容、下单或付款。</p>
        <div class="takeout-form-actions">
          <button
            class="button button-primary"
            type="submit"
            :disabled="saving || saveNeedsReconcile"
          >
            {{ saving ? '正在保存…' : editingId === null ? '添加候选' : '保存修改' }}
          </button>
          <button
            v-if="editingId !== null"
            class="button button-secondary"
            type="button"
            :disabled="saving"
            @click="clearForm"
          >
            取消编辑
          </button>
        </div>
      </form>
    </section>

    <section class="paper-card takeout-import-card" aria-labelledby="takeout-import-title">
      <h2 id="takeout-import-title">外卖候选 JSON 导入 / 导出</h2>
      <p class="muted">
        可选择 JSON 文件，也可粘贴 GPT 生成的 JSON。请让 GPT 只输出符合下方格式的
        JSON，并提供每家店铺或菜品的 HTTP(S) 分享链接；最多 1000 项、10 MiB，重复链接会整批拒绝。
      </p>
      <button
        class="button button-secondary takeout-export-button"
        type="button"
        :disabled="exporting || loading || !loaded || !candidates.length"
        @click="exportCandidates"
      >
        {{ exporting ? '正在导出…' : `导出已保存候选 JSON（${candidates.length}）` }}
      </button>
      <p v-if="exportError" class="inline-error" role="alert">{{ exportError }}</p>
      <p v-if="exportStatus" class="inline-note" role="status">{{ exportStatus }}</p>
      <pre class="takeout-json-example">
{"version":1,"candidates":[{"name":"店铺名称","url":"https://example.com/share"}]}</pre>
      <p class="muted">分享链接可填写空字符串，也可以省略 url 字段。</p>
      <button
        class="text-button takeout-copy-example"
        type="button"
        :disabled="importing || importNeedsReconcile"
        @click="copyImportExample"
      >
        复制 JSON 格式示例
      </button>
      <p v-if="exampleStatus" class="inline-note" role="status">{{ exampleStatus }}</p>
      <SegmentedSwitch
        :model-value="importMode"
        :options="importModes"
        label="选择导入方式"
        :disabled="importing || importNeedsReconcile"
        class="takeout-import-mode"
        @update:model-value="changeImportMode"
      />
      <template v-if="importMode === 'file'">
        <label class="button button-secondary takeout-file-button">
          选择 JSON 文件
          <input
            ref="fileInput"
            type="file"
            accept=".json,application/json"
            :disabled="importing || importNeedsReconcile"
            @change="onFileChange"
          />
        </label>
      </template>
      <label v-else class="form-field takeout-paste-field">
        <span>粘贴 GPT 生成的 JSON</span>
        <textarea
          v-model="pastedJson"
          class="json-input"
          rows="10"
          spellcheck="false"
          :disabled="importing"
          placeholder="将 GPT 生成的完整 JSON 粘贴到这里"
          @input="prepareImport(pastedJson, 'paste')"
        />
        <span class="muted"> {{ pastedBytes.toLocaleString() }} / 10,485,760 字节 </span>
      </label>
      <p v-if="pendingImport && !importNeedsReconcile" class="inline-note" role="status">
        已通过本地格式校验，将导入
        {{ pendingImport.candidates.length }} 项。确认后服务端会再次检查重复链接。
      </p>
      <p v-if="pendingImport && importNeedsReconcile" class="inline-note" role="status">
        已保留本次
        {{ pendingImport.candidates.length }} 项导入内容。请先重新读取核对结果，避免重复导入。
      </p>
      <ul v-if="importIssues.length" class="takeout-import-issues" aria-label="导入问题">
        <li v-for="(issue, index) in importIssues" :key="index">{{ issue }}</li>
      </ul>
      <p v-if="importError" class="inline-error" role="alert">{{ importError }}</p>
      <p v-if="importStatus" class="inline-note" role="status">{{ importStatus }}</p>
      <div v-if="pendingImport" class="takeout-form-actions">
        <button
          class="button button-primary"
          type="button"
          :disabled="importing || importNeedsReconcile"
          @click="submitImport"
        >
          {{
            importing
              ? '正在导入…'
              : importNeedsReconcile
                ? '等待核对…'
                : importCanRetry
                  ? '再次确认导入'
                  : '确认导入'
          }}
        </button>
        <button
          class="button button-secondary"
          type="button"
          :disabled="importing"
          @click="cancelImport"
        >
          取消
        </button>
      </div>
      <button
        v-if="importNeedsReconcile"
        class="text-button"
        type="button"
        :disabled="loading"
        @click="loadCandidates"
      >
        {{ loading ? '正在重新读取…' : '重新读取候选' }}
      </button>
    </section>

    <section aria-labelledby="takeout-list-title">
      <h2 id="takeout-list-title" class="takeout-list-heading">
        已保存候选 <span class="muted">（{{ candidates.length }}）</span>
      </h2>
      <p v-if="loading && !loaded" class="state-note" role="status">正在读取外卖候选…</p>
      <section v-else-if="loaded && !candidates.length" class="paper-card empty-state">
        <h3>还没有外卖候选</h3>
        <p class="muted">添加一家常点的店铺或一道想吃的菜，就能在首页随机推荐。</p>
      </section>
      <div v-else class="takeout-candidate-list">
        <article
          v-for="candidate in candidates"
          :key="candidate.id"
          class="paper-card takeout-candidate-card"
        >
          <h3>{{ candidate.name }}</h3>
          <a v-if="candidate.url" :href="candidate.url" target="_blank" rel="noopener noreferrer">
            打开平台链接 <span class="takeout-url">{{ candidate.url }}</span>
          </a>
          <p v-else class="muted">未设置平台链接</p>
          <div class="takeout-candidate-actions">
            <button
              class="button button-secondary"
              type="button"
              :disabled="saving || deletingId !== null"
              @click="editCandidate(candidate)"
            >
              编辑
            </button>
            <button
              class="button button-danger"
              type="button"
              :disabled="
                deletingId !== null || (deleteNeedsReconcile && uncertainDeleteId === candidate.id)
              "
              @click="removeCandidate(candidate)"
            >
              {{ deletingId === candidate.id ? '正在删除…' : '删除' }}
            </button>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
