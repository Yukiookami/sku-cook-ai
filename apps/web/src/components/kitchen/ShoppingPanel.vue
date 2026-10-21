<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import axios from 'axios';
import { Calendar } from 'vant';
import 'vant/lib/calendar/style';
import {
  CookShoppingBatchInputSchema,
  type CookShoppingBatchInput,
  type ShoppingBatch,
  type ShoppingPreview,
  type ShoppingPreviewInput,
} from '@sku-cook/shared';
import {
  listShoppingBatches,
  previewShopping,
  saveShoppingBatch,
  sendShoppingBatch,
} from '../../api/shopping';
import { apiErrorMessage } from '../../api/errors';
import { currentAccount } from '../../auth/session';
import ConfirmDialog from '../common/ConfirmDialog.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

const props = defineProps<{ show: boolean; selections: ShoppingPreviewInput['items'] }>();
const emit = defineEmits<{ close: [] }>();
const preview = ref<ShoppingPreview | null>(null);
const previewReady = ref(false);
const excluded = ref(new Set<string>());
const title = ref('做菜采购清单');
const plannedDate = ref('');
const frozen = ref<CookShoppingBatchInput | null>(null);
const batch = ref<ShoppingBatch | null>(null);
const recent = ref<ShoppingBatch[]>([]);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const storageError = ref('');
const { dialog, confirm, settle } = useConfirmDialog();
const panel = ref<HTMLElement | null>(null);
const scroller = ref<HTMLElement | null>(null);
const success = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const dateTrigger = ref<HTMLButtonElement | null>(null);
const dateDialog = ref<HTMLDialogElement | null>(null);
const datePickerOpen = ref(false);
const dateDraft = ref('');
let previousFocus: HTMLElement | null = null;
let sequence = 0;
const storageKey = computed(
  () => `sku-cook-ai:shopping-draft:${currentAccount.value?.id ?? 'anonymous'}`,
);
const selectedItems = computed(
  () => preview.value?.items.filter((item) => !excluded.value.has(item.itemId)) ?? [],
);
const receipt = computed(() => batch.value?.receipt ?? null);
const locked = computed(() => busy.value || Boolean(dialog.value));
const editable = computed(() => !frozen.value && !loading.value && !locked.value);
const canSend = computed(
  () =>
    !locked.value &&
    !loading.value &&
    batch.value?.status !== 'conflict' &&
    !receipt.value &&
    Boolean(
      frozen.value || (previewReady.value && title.value.trim() && selectedItems.value.length),
    ),
);

function close() {
  if (!locked.value) emit('close');
}
async function openDatePicker() {
  if (!editable.value) return;
  dateDraft.value = plannedDate.value;
  datePickerOpen.value = true;
  await nextTick();
  dateDialog.value?.showModal();
}
function closeDatePicker() {
  dateDialog.value?.close();
  datePickerOpen.value = false;
  dateTrigger.value?.focus({ preventScroll: true });
}
function selectDate(value: Date | Date[]) {
  if (value instanceof Date) dateDraft.value = dateKey(value);
}
function confirmDate() {
  if (!editable.value) return;
  plannedDate.value = dateDraft.value;
  closeDatePicker();
}
function clearDate() {
  if (!editable.value) return;
  plannedDate.value = '';
}
function calendarDate(value: string) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}
function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
function restoreFocus() {
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  previousFocus = null;
}
function trapFocus(event: KeyboardEvent) {
  if (datePickerOpen.value) return;
  const controls = panel.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), a[href]',
  );
  const first = controls?.[0];
  const last = controls?.[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function message(cause: unknown, fallback: string) {
  if (axios.isAxiosError(cause)) {
    const code = cause.response?.data?.error?.code;
    if (code === 'SHOPPING_NOT_CONFIGURED')
      return '采购集成尚未启用，请在两端服务端配置专用凭据和绑定账号。';
    if (code === 'SHOPPING_FORBIDDEN') return '当前账号没有采购发送权限，请使用服务端绑定的账号。';
    if (code === 'IDEMPOTENCY_CONFLICT')
      return '同一批次被用于不同内容，请核对原采购；不会自动换 ID 重发。';
    if (code === 'SHOPPING_SEND_IN_PROGRESS')
      return '原采购批次正在发送，请稍后重试原批次，不要新建采购。';
  }
  return apiErrorMessage(cause, fallback);
}
function restorePayload(payload: CookShoppingBatchInput) {
  frozen.value = payload;
  title.value = payload.title;
  plannedDate.value = payload.plannedDate ?? '';
  preview.value = { recipes: payload.recipes, items: payload.items };
  excluded.value = new Set();
}
function persist() {
  if (!frozen.value) return;
  try {
    sessionStorage.setItem(storageKey.value, JSON.stringify(frozen.value));
  } catch (cause) {
    console.warn('无法保存本机采购恢复草稿', cause);
    storageError.value =
      '本机无法保存恢复草稿，请保留此窗口；服务端已保存的批次可在最近采购中找回。';
  }
}
async function load() {
  const request = ++sequence;
  previewReady.value = false;
  loading.value = true;
  error.value = '';
  try {
    const records = await listShoppingBatches();
    if (request !== sequence) return;
    recent.value = records;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(storageKey.value);
    } catch (cause) {
      console.warn('无法读取本机采购恢复草稿', cause);
      storageError.value = '无法读取本机草稿，请从最近采购恢复已保存的批次。';
    }
    if (saved) {
      try {
        restorePayload(CookShoppingBatchInputSchema.parse(JSON.parse(saved)));
      } catch (cause) {
        console.warn('采购恢复草稿格式无效', cause);
        error.value = '本机采购草稿已损坏，请从最近采购恢复；不会自动创建替代采购。';
        return;
      }
      batch.value =
        records.find((record) => record.payload.batchId === frozen.value?.batchId) ?? null;
    } else if (!frozen.value && props.selections.length) {
      const result = await previewShopping({ items: props.selections });
      if (request !== sequence) return;
      preview.value = result;
      previewReady.value = true;
    }
  } catch (cause) {
    if (request === sequence)
      error.value = message(cause, '无法读取采购预览或已保存批次，请检查网络后重试。');
  } finally {
    if (request === sequence) loading.value = false;
  }
}
function resume(record: ShoppingBatch) {
  if (locked.value || loading.value) return;
  restorePayload(record.payload);
  batch.value = record;
  error.value = '';
  persist();
  if (scroller.value) scroller.value.scrollTop = 0;
}
async function startNew() {
  if (
    busy.value ||
    !(await confirm({
      title: '开始一份新采购',
      message:
        '这是独立的新采购，会生成新批次。原采购可能已经送达，不会被撤销；若只是发送失败，请重试原批次。',
      confirmText: '明确新建采购',
    }))
  )
    return;
  try {
    sessionStorage.removeItem(storageKey.value);
  } catch (cause) {
    console.warn('无法清除本机采购恢复草稿', cause);
    error.value = '本机草稿无法清理，暂不能开始新采购。';
    return;
  }
  frozen.value = null;
  batch.value = null;
  preview.value = null;
  excluded.value = new Set();
  title.value = '做菜采购清单';
  plannedDate.value = '';
  await load();
}
async function send() {
  if (!canSend.value) return;
  busy.value = true;
  error.value = '';
  try {
    if (!frozen.value) {
      const parsed = CookShoppingBatchInputSchema.safeParse({
        batchId: crypto.randomUUID(),
        schemaVersion: 1,
        title: title.value,
        plannedDate: plannedDate.value || null,
        recipes: preview.value?.recipes,
        items: selectedItems.value,
      });
      if (!parsed.success) {
        error.value = '请检查标题、采购日期与食材内容，至少选择一项食材。';
        return;
      }
      frozen.value = parsed.data;
      persist();
    }
    batch.value = await saveShoppingBatch(frozen.value);
    if (batch.value.status !== 'succeeded' && batch.value.status !== 'conflict') {
      batch.value = await sendShoppingBatch(frozen.value.batchId);
    }
    error.value = batch.value.message ?? '';
    recent.value = [
      batch.value,
      ...recent.value.filter((record) => record.payload.batchId !== batch.value?.payload.batchId),
    ].slice(0, 20);
  } catch (cause) {
    error.value = message(
      cause,
      '发送结果暂未确认，可能已经送达。已保留原批次与快照，请重试原批次，不要重复新建采购。',
    );
  } finally {
    busy.value = false;
  }
}
watch(
  [receipt, error],
  () => {
    if (!props.show || (!receipt.value && !error.value)) return;
    if (scroller.value) scroller.value.scrollTop = 0;
    if (receipt.value) success.value?.focus({ preventScroll: true });
  },
  { flush: 'post' },
);
watch(
  () => props.show,
  async (show) => {
    if (show) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      void load();
      await nextTick();
      if (props.show) closeButton.value?.focus();
    } else {
      dateDialog.value?.close();
      datePickerOpen.value = false;
      sequence += 1;
      restoreFocus();
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  sequence += 1;
  dateDialog.value?.close();
  restoreFocus();
});
</script>

<template>
  <ConfirmDialog :options="dialog" @close="settle" />
  <Teleport to="body">
    <div v-if="show" class="panel-scrim shopping-scrim" @click.self="close">
      <section
        ref="panel"
        class="kitchen-panel shopping-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-title"
        @keydown.esc.stop.prevent="close"
        @keydown.tab="trapFocus"
      >
        <header class="panel-heading">
          <h2 id="shopping-title">发送采购清单</h2>
          <button
            ref="closeButton"
            class="icon-button"
            type="button"
            aria-label="关闭采购预览"
            :disabled="locked"
            @click="close"
          >
            ×
          </button>
        </header>
        <div ref="scroller" class="panel-scroll">
          <p v-if="loading" role="status">正在读取采购预览…</p>
          <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
          <p v-if="storageError" class="inline-error" role="alert">{{ storageError }}</p>
          <button
            v-if="error && !locked"
            class="text-button"
            type="button"
            :disabled="loading"
            @click="load"
          >
            重新读取原批次
          </button>
          <section
            v-if="receipt"
            ref="success"
            class="paper-card panel-success"
            role="status"
            tabindex="-1"
          >
            <strong>采购清单已发送</strong>
          </section>
          <template v-if="preview">
            <fieldset :disabled="!editable" class="shopping-fields">
              <label>
                <span>采购标题</span>
                <input v-model="title" maxlength="200" aria-label="采购标题" />
              </label>
              <div class="shopping-date-field">
                <label for="shopping-date">采购日期（可不选）</label>
                <div class="shopping-date-controls">
                  <button
                    id="shopping-date"
                    ref="dateTrigger"
                    class="shopping-date-trigger"
                    type="button"
                    aria-haspopup="dialog"
                    :aria-expanded="datePickerOpen"
                    :disabled="!editable"
                    @click="openDatePicker"
                  >
                    <span>{{ plannedDate || '选择日期' }}</span>
                    <span aria-hidden="true">▦</span>
                  </button>
                  <button
                    v-if="plannedDate"
                    class="shopping-date-clear"
                    type="button"
                    aria-label="清除采购日期"
                    :disabled="!editable"
                    @click="clearDate"
                  >
                    清除
                  </button>
                </div>
              </div>
            </fieldset>
            <section class="paper-card">
              <h3>菜谱与目标份数</h3>
              <p v-for="recipe in preview.recipes" :key="recipe.recipeId">
                {{ recipe.title }} · {{ recipe.servings }}
              </p>
            </section>
            <section class="paper-card">
              <h3>食材（{{ selectedItems.length }} 项）</h3>
              <p v-if="!preview.items.length">所选菜谱没有食材，不能发送空采购。</p>
              <article v-for="item in preview.items" :key="item.itemId" class="shopping-item">
                <label>
                  <input
                    type="checkbox"
                    :checked="!excluded.has(item.itemId)"
                    :disabled="!editable"
                    :aria-label="`采购${item.name}`"
                    @change="
                      excluded.has(item.itemId)
                        ? excluded.delete(item.itemId)
                        : excluded.add(item.itemId)
                    "
                  />
                  <span>{{ item.name }}</span>
                </label>
                <div class="shopping-quantity">
                  <input
                    v-model="item.quantityText"
                    :disabled="!editable"
                    maxlength="200"
                    :aria-label="`${item.name}采购数量`"
                  />
                  <span>{{ item.unit }}</span>
                </div>
                <p v-for="(source, index) in item.sources" :key="index" class="muted">
                  {{
                    preview.recipes.find((recipe) => recipe.recipeId === source.recipeId)?.title
                  }}：{{ source.originalText }}
                </p>
              </article>
            </section>
          </template>
          <section v-if="recent.length" class="paper-card">
            <h3>最近采购（最多 20 批）</h3>
            <button
              v-for="record in recent"
              :key="record.payload.batchId"
              class="button button-secondary shopping-recent"
              type="button"
              :disabled="locked || loading"
              @click="resume(record)"
            >
              {{ record.payload.title }} ·
              {{
                record.status === 'succeeded'
                  ? '已发送'
                  : record.status === 'conflict'
                    ? '批次冲突'
                    : '待核对 / 可重试'
              }}
            </button>
          </section>
        </div>
        <footer class="panel-actions">
          <button
            class="button button-secondary"
            type="button"
            :disabled="busy || Boolean(dialog)"
            @click="emit('close')"
          >
            关闭
          </button>
          <button
            v-if="!receipt"
            class="button button-primary"
            type="button"
            :disabled="!canSend"
            :aria-busy="busy"
            @click="send"
          >
            {{ busy ? '正在发送…' : frozen ? '重试原采购批次' : '确认并发送采购' }}
          </button>
          <button
            v-if="frozen && selections.length"
            class="text-button"
            type="button"
            :disabled="locked || loading"
            @click="startNew"
          >
            修改并明确新建采购
          </button>
        </footer>
        <dialog
          v-if="datePickerOpen"
          ref="dateDialog"
          class="shopping-date-dialog"
          aria-labelledby="shopping-date-title"
          @keydown.esc.stop.prevent="closeDatePicker"
          @cancel.prevent="closeDatePicker"
        >
          <header class="shopping-date-heading">
            <h3 id="shopping-date-title">选择采购日期</h3>
            <button
              class="icon-button"
              type="button"
              aria-label="关闭日期选择"
              @click="closeDatePicker"
            >
              ×
            </button>
          </header>
          <Calendar
            :poppable="false"
            :show-confirm="false"
            :show-title="false"
            :show-mark="false"
            :row-height="44"
            switch-mode="year-month"
            :default-date="calendarDate(dateDraft)"
            :first-day-of-week="1"
            color="#ffe28a"
            @select="selectDate"
          />
          <div class="shopping-date-actions">
            <button class="button button-secondary" type="button" @click="closeDatePicker">
              取消
            </button>
            <button class="button button-primary" type="button" @click="confirmDate">确定</button>
          </div>
        </dialog>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.shopping-scrim {
  z-index: 1200;
}
.shopping-panel {
  width: min(100%, 640px);
  min-width: 0;
  overflow-x: hidden;
}
.shopping-scrim {
  overscroll-behavior-x: none;
}
.shopping-panel .panel-scroll {
  min-width: 0;
  overflow-x: hidden;
  overscroll-behavior-x: contain;
  touch-action: pan-y;
}
.shopping-fields {
  border: 0;
  padding: 0;
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
}
.shopping-fields label {
  display: grid;
  min-width: 0;
  gap: 8px;
}
.shopping-fields input,
.shopping-quantity input {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 8px;
  border: 1px solid #eadcc4;
  border-radius: 10px;
  background: white;
  color: #332e28;
  font: inherit;
  font-size: 16px;
}
.shopping-date-field {
  display: grid;
  min-width: 0;
  gap: 8px;
}
.shopping-date-controls {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}
.shopping-date-trigger {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px;
  border: 1px solid #eadcc4;
  border-radius: 10px;
  background: white;
  text-align: left;
}
.shopping-date-trigger span:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
.shopping-date-clear {
  min-width: 44px;
  min-height: 44px;
  padding: 4px 8px;
  border: 0;
  background: transparent;
  color: #6d4c1d;
}
.shopping-date-dialog {
  width: min(calc(100% - 24px), 420px);
  max-height: min(
    calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 32px),
    620px
  );
  padding: 0;
  overflow-x: hidden;
  overscroll-behavior: contain;
  border: 0;
  border-radius: 24px;
  background: #fffdf8;
  color: #332e28;
  box-shadow: 0 20px 70px rgb(70 50 20 / 24%);
  --van-calendar-selected-day-color: #332e28;
  --van-calendar-background: #fffdf8;
}
.shopping-date-dialog::backdrop {
  background: rgb(35 27 18 / 44%);
}
.shopping-date-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
}
.shopping-date-heading h3 {
  min-width: 0;
  margin: 0;
  font-size: 17px;
  overflow-wrap: anywhere;
}
.shopping-date-dialog .van-calendar {
  height: 360px;
  max-height: 55dvh;
}
.shopping-date-dialog .van-calendar__selected-day {
  width: min(100%, 44px) !important;
}
.shopping-date-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 16px;
}
.shopping-date-actions button {
  min-width: 0;
}
.shopping-item {
  min-width: 0;
  padding: 16px 0;
  border-bottom: 1px dashed #eadcc4;
}
.shopping-item p {
  overflow-wrap: anywhere;
}
.shopping-item > label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-weight: 600;
}
.shopping-item input[type='checkbox'] {
  width: 24px;
  height: 24px;
  accent-color: #a47a35;
}
.shopping-quantity {
  display: flex;
  align-items: center;
  gap: 12px;
}
.shopping-quantity input {
  max-width: 200px;
}
.shopping-recent {
  width: 100%;
  margin: 8px 0;
  white-space: normal;
}
.panel-actions {
  flex-wrap: wrap;
}
</style>
