<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import type { CookingHistory } from '@sku-cook/shared';
import PageHeader from '../../components/common/PageHeader.vue';
import { apiErrorMessage } from '../../api/errors';
import { deleteCookingHistory, getCookingHistory } from '../../api/cooking-history';

const router = useRouter();
const histories = ref<CookingHistory[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const loaded = ref(false);
const hasMore = ref(false);
const page = ref(1);
const error = ref('');
const deletingId = ref<number | null>(null);
let requestSequence = 0;
let deleteSequence = 0;

function localDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

async function load(reset: boolean) {
  if (reset) {
    requestSequence += 1;
    page.value = 1;
    loading.value = true;
    loadingMore.value = false;
    error.value = '';
  } else {
    if (loading.value || loadingMore.value || !hasMore.value) return;
    loadingMore.value = true;
  }
  const request = ++requestSequence;
  const requestedPage = reset ? 1 : page.value + 1;
  try {
    const result = await getCookingHistory(requestedPage);
    if (request !== requestSequence) return;
    histories.value = reset ? result.items : [...histories.value, ...result.items];
    page.value = requestedPage;
    hasMore.value = result.hasMore;
    loaded.value = true;
  } catch (cause) {
    if (request === requestSequence) {
      error.value = apiErrorMessage(cause, '无法读取做饭历史，请检查网络后重试。');
    }
  } finally {
    if (request === requestSequence) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function openLatest(item: CookingHistory['items'][number]) {
  if (item.recipeId === null) return;
  void router.push({
    name: 'recipe-detail',
    params: { id: item.recipeId },
    query: { targetServings: String(item.targetServings) },
  });
}

async function removeHistory(history: CookingHistory) {
  if (deletingId.value !== null) return;
  const confirmed = window.confirm(
    `删除这次做饭记录？本次${history.items.length}道菜的记录会移除，菜谱和厨房菜单不会改变。`,
  );
  if (!confirmed) return;
  const sequence = ++deleteSequence;
  deletingId.value = history.id;
  error.value = '';
  try {
    await deleteCookingHistory(history.id);
    if (sequence === deleteSequence) await load(true);
  } catch (cause) {
    if (sequence !== deleteSequence) return;
    if (axios.isAxiosError(cause) && cause.response?.status === 404) {
      error.value = '这条记录已被删除，列表已重新读取。';
      await load(true);
    } else {
      error.value = apiErrorMessage(cause, '删除结果暂未确认，请重新读取历史后核对。');
    }
  } finally {
    if (sequence === deleteSequence) deletingId.value = null;
  }
}

function back() {
  if (window.history.length > 1) router.back();
  else void router.push('/recipes');
}

function onScroll() {
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 240) {
    void load(false);
  }
}

onMounted(() => {
  void load(true);
  window.addEventListener('scroll', onScroll, { passive: true });
});
onBeforeUnmount(() => {
  requestSequence += 1;
  deleteSequence += 1;
  window.removeEventListener('scroll', onScroll);
});
</script>

<template>
  <main class="page history-page">
    <PageHeader title="做饭历史" @back="back" />
    <p class="history-intro">找到最近做过的菜，点菜名查看最新做法。</p>
    <p v-if="error" class="inline-error" role="alert">
      {{ error }}
      <button class="text-button" type="button" @click="load(true)">重新读取</button>
    </p>
    <p v-if="loading && !histories.length" class="state-note" role="status">正在读取做饭历史…</p>
    <section v-else-if="loaded && !histories.length" class="paper-card empty-state">
      <h2>还没有做饭记录</h2>
      <p class="muted">厨房点完成会自动记录，也可在菜谱详情手动记录。</p>
      <RouterLink class="button button-primary" to="/recipes">去菜谱一览</RouterLink>
    </section>
    <section v-else class="history-list">
      <article v-for="history in histories" :key="history.id" class="paper-card history-card">
        <header class="history-card-heading">
          <time class="section-chip">{{ localDate(history.cookedAt) }}</time>
          <span class="tag-pill neutral-pill">
            {{ history.source === 'kitchen' ? '厨房完成' : '手动记录' }}
          </span>
        </header>
        <div
          v-for="(item, index) in history.items"
          :key="`${history.id}-${index}`"
          class="history-item"
        >
          <div>
            <button
              v-if="item.recipeId !== null"
              class="history-recipe-link"
              type="button"
              @click="openLatest(item)"
            >
              {{ item.title }}
            </button>
            <strong v-else>{{ item.title }}</strong>
            <p>{{ item.targetServings }} 人份</p>
            <span v-if="item.recipeId === null" class="muted">菜谱已删除</span>
          </div>
          <button
            v-if="item.recipeId !== null"
            class="button button-primary history-open"
            type="button"
            @click="openLatest(item)"
          >
            查看做法
          </button>
        </div>
        <button
          class="button button-danger full-width delete-history"
          type="button"
          :disabled="deletingId !== null"
          @click="removeHistory(history)"
        >
          {{ deletingId === history.id ? '删除中…' : '删除这次记录' }}
        </button>
      </article>
      <div class="list-end">
        <button
          v-if="hasMore && !loadingMore"
          class="text-button"
          type="button"
          @click="load(false)"
        >
          加载更多
        </button>
        <span v-else-if="loadingMore" role="status">正在加载更多…</span>
        <span v-else-if="loaded && histories.length" class="muted">已经到底了</span>
      </div>
    </section>
  </main>
</template>
