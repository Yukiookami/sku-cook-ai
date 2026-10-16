<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import axios from 'axios';
import type { RecipeSummary } from '@sku-cook/shared';
import { apiErrorMessage } from '../../api/errors';
import { clearKitchenMenu, getKitchenState, replaceKitchenMenu } from '../../api/kitchen';
import ConfirmDialog from '../common/ConfirmDialog.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

type Selection = { recipe: RecipeSummary; targetServings: number };
type DisplayMode = 'send' | 'view';

const props = defineProps<{
  show: boolean;
  mode: DisplayMode;
  selections: RecipeSummary[];
  initialTargets?: Record<number, number>;
}>();
const emit = defineEmits<{ close: []; sent: []; 'return-to-recipes': [] }>();

const loading = ref(false);
const saving = ref(false);
const { dialog, confirm, settle } = useConfirmDialog();
const sendSucceeded = ref(false);
const stateFresh = ref(false);
const conflictPending = ref(false);
const conflictNotice = ref('');
const error = ref('');
const sessionResult = ref<Awaited<ReturnType<typeof getKitchenState>> | null>(null);
const targets = ref(new Map<number, number>());
let requestSequence = 0;

const session = computed(() => sessionResult.value?.session ?? null);
const selected = computed<Selection[]>(() =>
  props.selections.map((recipe) => ({
    recipe,
    targetServings:
      targets.value.get(recipe.id) ?? props.initialTargets?.[recipe.id] ?? recipe.servings,
  })),
);
const hasCurrentMenu = computed(() => (session.value?.items.length ?? 0) > 0);

watch(
  () => props.show,
  (show) => {
    if (show) {
      sendSucceeded.value = false;
      conflictPending.value = false;
      conflictNotice.value = '';
      targets.value = new Map(
        props.selections.map((recipe) => [
          recipe.id,
          props.initialTargets?.[recipe.id] ?? recipe.servings,
        ]),
      );
      void readKitchen();
    } else {
      requestSequence += 1;
      loading.value = false;
      error.value = '';
    }
  },
);

watch(
  () => props.selections.map((recipe) => recipe.id).join(','),
  () => {
    if (!props.show) return;
    const next = new Map(targets.value);
    for (const recipe of props.selections) {
      if (!next.has(recipe.id)) {
        next.set(recipe.id, props.initialTargets?.[recipe.id] ?? recipe.servings);
      }
    }
    targets.value = next;
  },
);

function adjust(recipeId: number, difference: number) {
  const current = targets.value.get(recipeId);
  if (current === undefined) return;
  const next = current + difference;
  if (next < 1 || next > 100) return;
  targets.value = new Map(targets.value).set(recipeId, next);
}

function closePanel() {
  if (!saving.value) emit('close');
}

async function readKitchen() {
  const sequence = ++requestSequence;
  loading.value = true;
  stateFresh.value = false;
  error.value = '';
  try {
    const state = await getKitchenState();
    if (sequence === requestSequence) {
      sessionResult.value = state;
      stateFresh.value = true;
      if (conflictPending.value) {
        conflictNotice.value =
          '厨房菜单已变更，已读取最新菜单；请确认后再次发送，本次选择和份数已保留。';
      }
    }
  } catch (cause) {
    if (sequence === requestSequence) {
      error.value = apiErrorMessage(cause, '无法读取厨房菜单，请检查网络后重试。');
    }
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

async function sendMenu() {
  if (!session.value || !stateFresh.value || saving.value || !selected.value.length) return;
  saving.value = true;
  conflictPending.value = false;
  conflictNotice.value = '';
  error.value = '';
  try {
    const state = await replaceKitchenMenu({
      items: selected.value.map(({ recipe, targetServings }) => ({
        recipeId: recipe.id,
        targetServings,
      })),
      expectedRevision: session.value.revision,
    });
    sessionResult.value = state;
    sendSucceeded.value = true;
    emit('sent');
  } catch (cause) {
    stateFresh.value = false;
    if (axios.isAxiosError(cause) && cause.response?.status === 409) {
      conflictPending.value = true;
      await readKitchen();
    } else {
      error.value = apiErrorMessage(
        cause,
        '发送结果暂未确认，请先重新读取厨房菜单核对；不会自动重发，本次选择和份数已保留。',
      );
    }
  } finally {
    saving.value = false;
  }
}

function returnToRecipes() {
  emit('return-to-recipes');
}

async function emptyKitchen() {
  if (!session.value || !stateFresh.value || !hasCurrentMenu.value || saving.value) return;
  const revision = session.value.revision;
  saving.value = true;
  error.value = '';
  try {
    if (
      !(await confirm({
        title: '清空厨房菜单',
        message: '清空后厨房屏将回到待机，不会记录做过；菜谱和已有历史不会删除。',
        confirmText: '确认清空',
        danger: true,
      }))
    )
      return;
    sessionResult.value = await clearKitchenMenu({
      expectedRevision: revision,
    });
  } catch (cause) {
    const operationError = apiErrorMessage(cause, '清空结果暂未确认，请重新读取厨房菜单。');
    await readKitchen();
    error.value = operationError;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <ConfirmDialog :options="dialog" @close="settle" />
  <Teleport to="body">
    <div
      v-if="show"
      class="panel-scrim"
      :class="{ 'send-success-scrim': sendSucceeded }"
      @click.self="closePanel"
    >
      <section
        class="kitchen-panel"
        :class="{ 'send-success-dialog': sendSucceeded }"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
      >
        <div v-if="!sendSucceeded" class="panel-handle" aria-hidden="true" />
        <header class="panel-heading">
          <h2 id="panel-title">
            {{ sendSucceeded ? '发送成功' : mode === 'send' ? '发送到厨房' : '厨房当前菜单' }}
          </h2>
          <button
            v-if="!sendSucceeded"
            class="icon-button"
            type="button"
            aria-label="关闭"
            :disabled="saving"
            @click="closePanel"
          >
            ×
          </button>
        </header>
        <template v-if="sendSucceeded">
          <section class="panel-success" role="status">
            <span class="send-success-icon" aria-hidden="true">✓</span>
            <strong>已发送到厨房</strong>
            <p>已保存 {{ session?.items.length }} 道菜到厨房菜单。</p>
            <p>厨房屏保持打开并登录同一账号，将在下次读取时更新（通常 10 秒内）。</p>
          </section>
        </template>
        <template v-else>
          <div class="panel-scroll">
            <p v-if="error" class="inline-error" role="alert">
              {{ error }}
              <button
                class="text-button"
                type="button"
                :disabled="loading || saving"
                @click="readKitchen"
              >
                重新读取厨房菜单
              </button>
            </p>
            <p v-if="conflictNotice" class="inline-note" role="status">{{ conflictNotice }}</p>
            <p v-if="loading && !session" class="state-note" role="status">正在读取厨房菜单…</p>
            <template v-else>
              <section v-if="mode === 'send'" class="paper-card">
                <h3 class="section-chip">本次选择（{{ selected.length }}道）</h3>
                <p v-if="!selected.length" class="muted">请先从菜谱一览选择菜谱。</p>
                <div v-for="(item, index) in selected" :key="item.recipe.id" class="target-row">
                  <div class="target-heading">
                    <strong>{{ index + 1 }}. {{ item.recipe.title }}</strong>
                    <span class="muted">原 {{ item.recipe.servings }} 人份</span>
                  </div>
                  <div class="stepper" :aria-label="`${item.recipe.title}目标份数`">
                    <button
                      type="button"
                      :disabled="item.targetServings <= 1 || saving"
                      :aria-label="`${item.recipe.title}减少一份`"
                      @click="adjust(item.recipe.id, -1)"
                    >
                      −
                    </button>
                    <span>目标 {{ item.targetServings }} 人份</span>
                    <button
                      type="button"
                      :disabled="item.targetServings >= 100 || saving"
                      :aria-label="`${item.recipe.title}增加一份`"
                      @click="adjust(item.recipe.id, 1)"
                    >
                      ＋
                    </button>
                  </div>
                </div>
              </section>

              <section class="paper-card">
                <h3 class="section-chip">厨房当前菜单</h3>
                <p class="muted">这是打开弹层时读取的菜单快照，不代表厨房设备已收到或在线。</p>
                <p v-if="!session?.items.length" class="muted">厨房当前没有菜单。</p>
                <div
                  v-for="(recipe, index) in session?.recipes ?? []"
                  :key="recipe.id"
                  class="current-menu-row"
                >
                  <div>
                    <strong>{{ recipe.title }}</strong>
                    <p>{{ session?.items[index]?.targetServings }} 人份</p>
                  </div>
                  <span v-if="recipe.id === session?.activeRecipeId" class="current-label">
                    当前
                  </span>
                </div>
              </section>
              <p v-if="hasCurrentMenu && mode === 'send'" class="replace-note">
                将替换当前的 {{ session?.items.length }} 道菜，厨房屏将在下一次读取时更新。
              </p>
            </template>
          </div>
        </template>
        <footer class="panel-actions">
          <template v-if="sendSucceeded">
            <button class="button button-secondary" type="button" @click="closePanel">完成</button>
            <button class="button button-primary" type="button" @click="returnToRecipes">
              返回菜谱一览
            </button>
          </template>
          <template v-else>
            <button
              class="button button-secondary"
              type="button"
              :disabled="saving"
              @click="closePanel"
            >
              {{ mode === 'send' ? '取消' : '关闭' }}
            </button>
            <button
              v-if="mode === 'send'"
              class="button button-primary"
              type="button"
              :disabled="!session || !stateFresh || loading || saving || !selected.length"
              :aria-busy="saving"
              @click="sendMenu"
            >
              {{
                saving
                  ? '正在发送…'
                  : conflictPending
                    ? '确认并发送到厨房'
                    : hasCurrentMenu
                      ? '替换厨房菜单'
                      : '发送到厨房'
              }}
            </button>
            <button
              v-else-if="hasCurrentMenu"
              class="button button-danger"
              type="button"
              :disabled="saving || !stateFresh || loading"
              @click="emptyKitchen"
            >
              {{ saving ? '处理中…' : '清空厨房' }}
            </button>
          </template>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
