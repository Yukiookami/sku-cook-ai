<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import { apiErrorMessage } from '../../api/errors';
import { completeKitchenMenu, getKitchenState, setKitchenActiveRecipe } from '../../api/kitchen';
import { useWakeLock } from '../../composables/useWakeLock';
import { scaleIngredientAmount } from '@sku-cook/shared';

type KitchenLine = { label: string; text: string };
const wakeLockNoticeStorageKey = 'sku-cook-ai:kitchen-wake-lock-notice-dismissed';
function kitchenScrollStorageKey(recipeId: number) {
  return `sku-cook-ai:kitchen-scroll:${recipeId}`;
}
const stateResult = ref<Awaited<ReturnType<typeof getKitchenState>> | null>(null);
const initialLoading = ref(true);
const loadError = ref('');
const actionError = ref('');
const actionPending = ref(false);
const menuExpanded = ref(false);
const wakeLockUnavailable = ref(false);
const wakeLockNoticeDismissed = ref(
  window.localStorage.getItem(wakeLockNoticeStorageKey) === 'true',
);
const isCelebrating = ref(false);
const viewport = ref({ width: window.innerWidth, height: window.innerHeight });
const activeSession = computed(() => stateResult.value?.session ?? null);
const hasMenu = computed(() => (activeSession.value?.items.length ?? 0) > 0);
const landscape = computed(() => viewport.value.width > viewport.value.height);
const recipes = computed(() => activeSession.value?.recipes ?? []);
const activeRecipe = computed(
  () => recipes.value.find((recipe) => recipe.id === activeSession.value?.activeRecipeId) ?? null,
);
const activeItem = computed(
  () => activeSession.value?.items.find((item) => item.recipeId === activeRecipe.value?.id) ?? null,
);
const activeRecipeIndex = computed(
  () => activeSession.value?.recipeIds.indexOf(activeRecipe.value?.id ?? -1) ?? -1,
);
const hasPreviousRecipe = computed(() => activeRecipeIndex.value > 0);
const nextRecipeId = computed(() => activeSession.value?.recipeIds[activeRecipeIndex.value + 1]);
const nextRecipe = computed(
  () => recipes.value.find((recipe) => recipe.id === nextRecipeId.value) ?? null,
);
const isLastRecipe = computed(
  () =>
    activeRecipeIndex.value >= 0 &&
    activeRecipeIndex.value === (activeSession.value?.recipeIds.length ?? 0) - 1,
);
const ingredientLines = computed<KitchenLine[]>(() => {
  const recipe = activeRecipe.value;
  const menuItem = activeItem.value;
  if (!recipe || !menuItem) return [];
  return recipe.ingredients.map((item, index) => {
    const scaled = scaleIngredientAmount(
      item.amount,
      item.scaleWithServings,
      recipe.servings,
      menuItem.targetServings,
    );
    const quantity = [scaled.text, item.unit].filter(Boolean).join(' ');
    const note = item.note?.trim() ?? '';
    const quantityLabel = scaled.approximate
      ? `约 ${quantity}`
      : scaled.unconverted
        ? `${quantity}（未换算）`
        : scaled.preserved
          ? `${quantity}（原量）`
          : quantity;
    return {
      label: `${String(index + 1).padStart(2, '0')}.`,
      text: [item.name, quantityLabel, note].filter(Boolean).join(' · '),
    };
  });
});
const stepLines = computed<KitchenLine[]>(
  () =>
    activeRecipe.value?.steps.map((step) => ({
      label: `步骤 ${String(step.order).padStart(2, '0')}`,
      text: step.text,
    })) ?? [],
);
const tips = computed(() => (activeRecipe.value?.tips ? [activeRecipe.value.tips] : []));
const notes = computed(() =>
  [activeRecipe.value?.description, activeRecipe.value?.source].filter((value): value is string =>
    Boolean(value),
  ),
);
const previousDisabled = computed(
  () => actionPending.value || (Boolean(loadError.value) && hasPreviousRecipe.value),
);
const nextDisabled = computed(() => actionPending.value || Boolean(loadError.value));
const displayTime = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
let requestSequence = 0;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let completeTimer: ReturnType<typeof setTimeout> | undefined;
let pollIntervalSeconds = 10;
let viewDisposed = false;
let scrollRestoreSequence = 0;

useWakeLock(hasMenu, wakeLockUnavailable);

function cancelPoll() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = undefined;
}

function schedulePoll() {
  cancelPoll();
  if (document.visibilityState !== 'visible') return;
  pollTimer = setTimeout(() => void readState(false), pollIntervalSeconds * 1000);
}

function applyState(result: Awaited<ReturnType<typeof getKitchenState>>) {
  const currentRecipeId = activeRecipe.value?.id;
  if (currentRecipeId !== undefined && currentRecipeId !== result.session.activeRecipeId) {
    window.sessionStorage.setItem(kitchenScrollStorageKey(currentRecipeId), String(window.scrollY));
  }
  if (result.session.recipeIds.length > 0) {
    isCelebrating.value = false;
    if (completeTimer) clearTimeout(completeTimer);
  }
  stateResult.value = result;
  pollIntervalSeconds = result.pollIntervalSeconds;
}

async function readState(scheduleNext: boolean) {
  const request = ++requestSequence;
  try {
    const result = await getKitchenState();
    if (request !== requestSequence) return;
    loadError.value = '';
    applyState(result);
  } catch (cause) {
    if (request !== requestSequence) return;
    loadError.value = apiErrorMessage(cause, '无法读取厨房菜单，请检查网络后重试。');
  } finally {
    initialLoading.value = false;
    if (scheduleNext) schedulePoll();
  }
}

async function refresh() {
  cancelPoll();
  await readState(true);
}

async function chooseRecipe(recipeId: number): Promise<boolean> {
  const session = activeSession.value;
  if (!session || actionPending.value) return false;
  if (recipeId === session.activeRecipeId) return true;
  actionPending.value = true;
  actionError.value = '';
  cancelPoll();
  requestSequence += 1;
  try {
    const result = await setKitchenActiveRecipe({
      activeRecipeId: recipeId,
      expectedRevision: session.revision,
    });
    applyState(result);
    return result.session.activeRecipeId === recipeId;
  } catch (cause) {
    actionError.value = apiErrorMessage(cause, '切换失败，请重新读取厨房菜单后重试。');
    await readState(false);
    return false;
  } finally {
    actionPending.value = false;
    schedulePoll();
  }
}

function previousRecipe() {
  const recipeId = activeSession.value?.recipeIds[activeRecipeIndex.value - 1];
  if (recipeId !== undefined) void chooseRecipe(recipeId);
}

function advanceRecipe() {
  if (isLastRecipe.value) {
    void finishCooking();
    return;
  }
  if (nextRecipeId.value !== undefined) void chooseRecipe(nextRecipeId.value);
}

async function finishCooking() {
  const session = activeSession.value;
  if (!session || !hasMenu.value || actionPending.value) return;
  actionPending.value = true;
  actionError.value = '';
  cancelPoll();
  requestSequence += 1;
  try {
    const result = await completeKitchenMenu({ expectedRevision: session.revision });
    applyState(result);
    isCelebrating.value = true;
    if (completeTimer) clearTimeout(completeTimer);
    completeTimer = setTimeout(() => {
      isCelebrating.value = false;
    }, 3000);
  } catch (cause) {
    actionError.value =
      axios.isAxiosError(cause) && !cause.response
        ? '完成结果暂未确认，请查看做饭历史；不会自动重复提交。'
        : apiErrorMessage(cause, '完成失败，请重新读取厨房菜单后再操作。');
    await readState(false);
  } finally {
    actionPending.value = false;
    schedulePoll();
  }
}

function measureViewport() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
}

function dismissWakeLockNotice() {
  wakeLockNoticeDismissed.value = true;
  window.localStorage.setItem(wakeLockNoticeStorageKey, 'true');
}

function handleVisibility() {
  cancelPoll();
  if (document.visibilityState === 'visible') void readState(true);
}

watch(
  () => activeRecipe.value?.id,
  async (recipeId) => {
    const sequence = ++scrollRestoreSequence;
    if (recipeId === undefined) return;
    await nextTick();
    if (viewDisposed || sequence !== scrollRestoreSequence) return;
    const savedPosition = Number(
      window.sessionStorage.getItem(kitchenScrollStorageKey(recipeId)) ?? 0,
    );
    window.scrollTo({
      top: Number.isFinite(savedPosition) ? Math.max(0, savedPosition) : 0,
      behavior: 'instant',
    });
  },
  { flush: 'post' },
);

onMounted(async () => {
  measureViewport();
  window.addEventListener('resize', measureViewport);
  document.addEventListener('visibilitychange', handleVisibility);
  await readState(true);
});

onBeforeUnmount(() => {
  viewDisposed = true;
  scrollRestoreSequence += 1;
  if (activeRecipe.value) {
    window.sessionStorage.setItem(
      kitchenScrollStorageKey(activeRecipe.value.id),
      String(window.scrollY),
    );
  }
  requestSequence += 1;
  cancelPoll();
  if (completeTimer) clearTimeout(completeTimer);
  window.removeEventListener('resize', measureViewport);
  document.removeEventListener('visibilitychange', handleVisibility);
});
</script>

<template>
  <main class="kitchen-screen" :class="{ 'kitchen-landscape': landscape }">
    <p v-if="initialLoading" class="kitchen-status" role="status">正在读取厨房菜单</p>
    <section v-else-if="loadError && !stateResult" class="kitchen-empty" role="alert">
      <h1>无法读取厨房菜单</h1>
      <p>{{ loadError }}</p>
      <button class="kitchen-button kitchen-primary" type="button" @click="refresh">重试</button>
    </section>
    <template v-else-if="!hasMenu">
      <header class="kitchen-date">
        <time>{{ displayTime.format(new Date()) }}</time>
      </header>
      <section v-if="isCelebrating" class="kitchen-empty completion-message" role="status">
        <span class="kitchen-empty-badge" aria-hidden="true">收工啦</span>
        <h1>今天的菜做完了</h1>
        <p>辛苦啦，今天也好好吃饭。</p>
      </section>
      <section v-else class="kitchen-empty">
        <span class="kitchen-empty-badge" aria-hidden="true">待机中</span>
        <h1>厨房当前没有菜单</h1>
        <p>在手机上选菜后这里会显示做法</p>
        <p v-if="actionError" class="kitchen-warning" role="alert">{{ actionError }}</p>
        <p v-if="loadError" class="kitchen-warning" role="status">
          连接中断，显示上次内容。请重试读取。
        </p>
        <button class="kitchen-button kitchen-secondary" type="button" @click="refresh">
          重试
        </button>
      </section>
    </template>
    <template v-else-if="activeRecipe">
      <nav class="kitchen-menu-tabs" aria-label="厨房菜单">
        <div
          class="kitchen-tab-list"
          :class="{ expanded: menuExpanded, collapsed: recipes.length > 3 && !menuExpanded }"
        >
          <button
            v-for="recipe in recipes"
            :key="recipe.id"
            class="kitchen-tab"
            :class="{ active: recipe.id === activeRecipe.id }"
            type="button"
            :disabled="actionPending"
            @click="chooseRecipe(recipe.id)"
          >
            <span>{{ recipe.title }}</span>
            <strong v-if="recipe.id === activeRecipe.id">当前</strong>
          </button>
        </div>
        <button
          v-if="recipes.length > 3"
          class="kitchen-menu-toggle"
          type="button"
          :aria-expanded="menuExpanded"
          @click="menuExpanded = !menuExpanded"
        >
          {{ menuExpanded ? '收起菜单' : '展开菜单' }}
        </button>
      </nav>
      <header class="kitchen-recipe-heading">
        <h1>{{ activeRecipe.title }}</h1>
        <p>目标 {{ activeItem?.targetServings }} 人份（原 {{ activeRecipe.servings }} 人份）</p>
        <p class="kitchen-reference">参考用量，调料按口味调整。</p>
        <p v-if="activeItem?.targetServings !== activeRecipe.servings" class="kitchen-reference">
          步骤与时间沿用原菜谱。
        </p>
      </header>
      <section class="kitchen-content">
        <article v-if="ingredientLines.length" class="kitchen-column">
          <h2>食材</h2>
          <ul>
            <li v-for="(line, index) in ingredientLines" :key="`${line.label}-${index}`">
              <strong>{{ line.label }}</strong>
              <span>{{ line.text }}</span>
            </li>
          </ul>
        </article>
        <article v-if="stepLines.length" class="kitchen-column">
          <h2>做法</h2>
          <ol>
            <li
              v-for="(line, index) in stepLines"
              :key="`${line.label}-${index}`"
              class="kitchen-step-row"
            >
              <span class="kitchen-step-label">{{ line.label }}</span>
              <p class="kitchen-step-text">{{ line.text }}</p>
            </li>
          </ol>
        </article>
        <article v-if="tips.length" class="kitchen-column kitchen-note">
          <h2>窍门</h2>
          <p v-for="tip in tips" :key="tip">{{ tip }}</p>
        </article>
        <article v-if="notes.length" class="kitchen-column kitchen-note">
          <h2>补充说明</h2>
          <p v-for="note in notes" :key="note">{{ note }}</p>
        </article>
      </section>
      <p v-if="loadError" class="kitchen-offline" role="status">
        连接中断，显示上次内容
        <button class="text-button" type="button" @click="refresh">重试读取</button>
      </p>
      <p v-if="actionError" class="kitchen-warning" role="alert">{{ actionError }}</p>
      <p
        v-if="wakeLockUnavailable && !wakeLockNoticeDismissed"
        class="wake-lock-note"
        role="status"
      >
        无法自动保持常亮，请在系统设置中调整屏幕超时。
        <button class="text-button" type="button" @click="dismissWakeLockNotice">知道了</button>
      </p>
      <footer class="kitchen-actions">
        <button
          v-if="hasPreviousRecipe"
          class="kitchen-button kitchen-secondary"
          type="button"
          :disabled="previousDisabled"
          @click="previousRecipe"
        >
          上一道
        </button>
        <span v-else class="kitchen-action-placeholder" aria-hidden="true" />
        <button
          class="kitchen-button kitchen-primary"
          type="button"
          :disabled="nextDisabled"
          @click="advanceRecipe"
        >
          <template v-if="actionPending">处理中…</template>
          <template v-else-if="isLastRecipe">完成</template>
          <template v-else>下一道：{{ nextRecipe?.title }}</template>
        </button>
      </footer>
    </template>
  </main>
</template>
