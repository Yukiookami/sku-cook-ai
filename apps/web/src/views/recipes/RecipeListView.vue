<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { recipeTotalMinutes, type RecipeSummary } from '@sku-cook/shared';
import KitchenMenuPanel from '../../components/kitchen/KitchenMenuPanel.vue';
import { apiErrorMessage } from '../../api/errors';
import { getRandomRecipe, getRecipeTags, getRecipes } from '../../api/recipes';

const route = useRoute();
const router = useRouter();
const recipes = ref<RecipeSummary[]>([]);
const tags = ref<string[]>([]);
const tagsError = ref('');
const listError = ref('');
const loading = ref(true);
const loadingMore = ref(false);
const loaded = ref(false);
const hasMore = ref(false);
const page = ref(1);
const searchInput = ref(typeof route.query.q === 'string' ? route.query.q : '');
const selectedTag = ref(typeof route.query.tag === 'string' ? route.query.tag : '');
const searchExpanded = ref(false);
const selecting = ref(false);
const selectionOrder = ref(new Map<number, RecipeSummary>());
const showMore = ref(false);
const showKitchen = ref(false);
const kitchenMode = ref<'send' | 'view'>('send');
const recommendation = ref<RecipeSummary | null>(null);
const randomLoading = ref(false);
const randomError = ref('');
const noAlternative = ref(false);
const randomAttemptExclude = ref<number | undefined>();
const listEnd = ref<HTMLElement | null>(null);
const displayTags = computed(() => tags.value);
const selectedRecipes = computed(() => [...selectionOrder.value.values()]);
const hasFilters = computed(() => Boolean(route.query.q || route.query.tag));
const duplicateLoadError = computed(
  () => Boolean(listError.value) && listError.value === tagsError.value,
);
let listSequence = 0;
let randomSequence = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let observer: IntersectionObserver | undefined;

function duration(recipe: RecipeSummary): string | null {
  const total = recipeTotalMinutes(recipe.prepMinutes, recipe.cookMinutes);
  return total === null ? null : `${total}分钟`;
}

async function fetchList(reset: boolean) {
  if (!reset && (loadingMore.value || loading.value || !hasMore.value)) return;
  const request = ++listSequence;
  if (reset) {
    page.value = 1;
    listError.value = '';
    loading.value = true;
    loadingMore.value = false;
    recipes.value = [];
    hasMore.value = false;
    loaded.value = false;
  } else {
    loadingMore.value = true;
  }
  const requestPage = reset ? 1 : page.value + 1;
  try {
    const response = await getRecipes({
      page: requestPage,
      pageSize: 20,
      ...(typeof route.query.q === 'string' && route.query.q.trim()
        ? { q: route.query.q.trim() }
        : {}),
      ...(typeof route.query.tag === 'string' && route.query.tag ? { tag: route.query.tag } : {}),
    });
    if (request !== listSequence) return;
    recipes.value = reset ? response.items : [...recipes.value, ...response.items];
    page.value = requestPage;
    hasMore.value = response.hasMore;
    loaded.value = true;
  } catch (cause) {
    if (request === listSequence) {
      listError.value = apiErrorMessage(cause, '无法读取菜谱，请检查网络后重试。');
    }
  } finally {
    if (request === listSequence) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

async function fetchTags() {
  try {
    const response = await getRecipeTags();
    tags.value = response.tags;
    tagsError.value = '';
  } catch (cause) {
    tagsError.value = apiErrorMessage(cause, '标签读取失败，可单独重试。');
  }
}

function setSearch(value: string, immediate = false) {
  searchInput.value = value;
  if (searchTimer) clearTimeout(searchTimer);
  const commit = () => {
    void router.replace({
      query: {
        ...route.query,
        ...(value.trim() ? { q: value.trim() } : { q: undefined }),
      },
    });
  };
  if (immediate) commit();
  else searchTimer = setTimeout(commit, 300);
}

function updateSearch(event: Event) {
  const target = event.currentTarget;
  if (target instanceof HTMLInputElement) setSearch(target.value);
}

function selectTag(tag: string) {
  void router.replace({
    query: {
      ...route.query,
      ...(tag ? { tag } : { tag: undefined }),
    },
  });
}

function clearFilters() {
  searchInput.value = '';
  selectedTag.value = '';
  if (searchTimer) clearTimeout(searchTimer);
  void router.replace({ query: {} });
}

function retryList() {
  void fetchList(recipes.value.length === 0);
}

function retryListLoad() {
  const retryTags = duplicateLoadError.value;
  retryList();
  if (retryTags) void fetchTags();
}

function toggleSelecting() {
  selecting.value = !selecting.value;
  if (!selecting.value) selectionOrder.value.clear();
}

function toggleSelection(recipe: RecipeSummary) {
  const next = new Map(selectionOrder.value);
  if (next.has(recipe.id)) {
    next.delete(recipe.id);
  } else if (next.size >= 10) {
    listError.value = '一次最多选择10道菜，请先取消部分选择。';
    return;
  } else {
    next.set(recipe.id, recipe);
  }
  selectionOrder.value = next;
  listError.value = '';
}

function openKitchen(mode: 'send' | 'view') {
  kitchenMode.value = mode;
  showKitchen.value = true;
  showMore.value = false;
}

function onKitchenSent() {
  selecting.value = false;
  selectionOrder.value.clear();
}

async function requestRecommendation(exclude?: number) {
  const request = ++randomSequence;
  randomLoading.value = true;
  randomError.value = '';
  randomAttemptExclude.value = exclude;
  try {
    const response = await getRandomRecipe(exclude);
    if (request !== randomSequence) return;
    if (response.recipe) {
      recommendation.value = response.recipe;
      noAlternative.value = false;
    } else if (response.reason === 'EMPTY_LIBRARY') {
      recommendation.value = null;
      noAlternative.value = false;
      randomError.value = '还没有菜谱，先新增或导入再随机推荐。';
    } else {
      noAlternative.value = true;
    }
  } catch (cause) {
    if (request === randomSequence) {
      randomError.value = apiErrorMessage(cause, '推荐失败，请重试。');
    }
  } finally {
    if (request === randomSequence) randomLoading.value = false;
  }
}

function goToRecipe(id: number, fromRecommendation = false) {
  if (selecting.value && !fromRecommendation) {
    const found = [...recipes.value, ...(recommendation.value ? [recommendation.value] : [])].find(
      (recipe) => recipe.id === id,
    );
    if (found) toggleSelection(found);
    return;
  }
  sessionStorage.setItem('recipe-list-scroll', String(window.scrollY));
  void router.push(`/recipes/${id}`);
}

function openImport() {
  showMore.value = false;
  void router.push('/recipes/import');
}

function openHistory() {
  showMore.value = false;
  void router.push('/cooking-history');
}

function handleListScroll() {
  if (!listEnd.value || !hasMore.value || loading.value || loadingMore.value) return;
  const rect = listEnd.value.getBoundingClientRect();
  if (rect.top < window.innerHeight + 200) void fetchList(false);
}

watch(
  () => [route.query.q, route.query.tag],
  () => {
    searchInput.value = typeof route.query.q === 'string' ? route.query.q : '';
    selectedTag.value = typeof route.query.tag === 'string' ? route.query.tag : '';
    void fetchList(true);
  },
);

onMounted(async () => {
  await Promise.all([fetchList(true), fetchTags()]);
  const saved = Number(sessionStorage.getItem('recipe-list-scroll'));
  if (Number.isFinite(saved) && saved > 0) {
    await nextTick();
    window.scrollTo(0, saved);
    sessionStorage.removeItem('recipe-list-scroll');
  }
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchList(false);
      },
      { rootMargin: '200px' },
    );
    if (listEnd.value) observer.observe(listEnd.value);
  }
  window.addEventListener('scroll', handleListScroll, { passive: true });
});

onBeforeUnmount(() => {
  listSequence += 1;
  randomSequence += 1;
  if (searchTimer) clearTimeout(searchTimer);
  observer?.disconnect();
  window.removeEventListener('scroll', handleListScroll);
});
</script>

<template>
  <main class="page list-page" :class="{ 'selection-active': selecting }">
    <header class="home-header">
      <h1>吃什么饭</h1>
      <div class="header-buttons">
        <RouterLink class="button button-primary compact-button" to="/recipes/new">新增</RouterLink>
        <button class="button button-primary compact-button" type="button" @click="showMore = true">
          更多
        </button>
      </div>
    </header>
    <div v-if="loading && !recipes.length" class="list-loading-state" role="status">
      <span class="list-loading-spinner" aria-hidden="true" />
      <span>正在加载菜谱…</span>
    </div>

    <section class="paper-card recommendation-card" aria-labelledby="recommend-title">
      <h2 id="recommend-title" class="section-chip">今天吃什么？</h2>
      <p class="muted">从全部菜谱随机</p>
      <template v-if="recommendation">
        <h3 class="recommend-title">{{ recommendation.title }}</h3>
        <div class="tag-line">
          <span v-for="tag in recommendation.tags" :key="tag" class="tag-pill">{{ tag }}</span>
          <span v-if="duration(recommendation)" class="tag-pill neutral-pill">
            {{ duration(recommendation) }}
          </span>
        </div>
        <p v-if="recommendation.description" class="recommend-description">
          {{ recommendation.description }}
        </p>
        <p v-if="noAlternative" class="inline-note" role="status">没有其他可推荐的菜谱。</p>
      </template>
      <p v-else-if="randomError" class="inline-error" role="alert">{{ randomError }}</p>
      <p v-else class="muted">按下按钮，为今天找一道灵感。</p>
      <p v-if="randomError.includes('还没有菜谱')" class="inline-links">
        <RouterLink to="/recipes/new">新增菜谱</RouterLink>
        <button class="text-button" type="button" @click="openImport">菜谱导入 / 导出</button>
      </p>
      <div class="recommend-actions">
        <button
          v-if="recommendation"
          class="button button-primary"
          type="button"
          @click="goToRecipe(recommendation.id, true)"
        >
          查看做法
        </button>
        <button
          v-if="recommendation"
          class="button button-secondary"
          type="button"
          :disabled="randomLoading || noAlternative"
          @click="requestRecommendation(recommendation.id)"
        >
          {{ randomLoading ? '换菜中…' : '换一个' }}
        </button>
        <button
          v-else
          class="button button-primary"
          type="button"
          :disabled="randomLoading"
          @click="requestRecommendation()"
        >
          {{ randomLoading ? '正在推荐…' : '随机推荐' }}
        </button>
      </div>
      <p v-if="randomError && !randomError.includes('还没有菜谱')" class="inline-links">
        <button
          class="text-button"
          type="button"
          @click="requestRecommendation(randomAttemptExclude)"
        >
          重试推荐
        </button>
      </p>
    </section>

    <label class="search-field">
      <span aria-hidden="true">⌕</span>
      <input
        :value="searchInput"
        type="search"
        maxlength="50"
        placeholder="搜索菜名"
        aria-label="搜索菜名"
        @input="updateSearch"
        @keydown.enter.prevent="setSearch(searchInput, true)"
      />
    </label>

    <div class="filter-row">
      <div class="tag-filter" :class="{ expanded: searchExpanded }">
        <button
          class="filter-chip"
          :class="{ active: !selectedTag }"
          type="button"
          @click="selectTag('')"
        >
          全部
        </button>
        <button
          v-for="tag in displayTags"
          :key="tag"
          class="filter-chip"
          :class="{ active: selectedTag === tag }"
          type="button"
          @click="selectTag(tag)"
        >
          {{ tag }}
        </button>
        <button
          v-if="tags.length > 4"
          class="text-button tag-expand"
          type="button"
          :aria-expanded="searchExpanded"
          @click="searchExpanded = !searchExpanded"
        >
          {{ searchExpanded ? '收起' : '更多标签' }}
        </button>
      </div>
      <button class="select-button" type="button" @click="toggleSelecting">
        {{ selecting ? '取消选菜' : '选菜' }}
      </button>
    </div>
    <p v-if="tagsError && !duplicateLoadError" class="inline-error" role="alert">
      {{ tagsError }} <button class="text-button" type="button" @click="fetchTags">重试标签</button>
    </p>

    <div v-if="listError" class="inline-error list-error" role="alert">
      {{ listError }}
      <button class="text-button" type="button" @click="retryListLoad">重试</button>
    </div>
    <section v-else-if="loaded && !recipes.length" class="paper-card empty-state">
      <h2>{{ hasFilters ? '没有找到匹配的菜谱' : '还没有菜谱' }}</h2>
      <p class="muted">
        {{ hasFilters ? '试试清除搜索或标签筛选。' : '先新增一道家常菜，开始整理菜谱。' }}
      </p>
      <div class="inline-links">
        <button
          v-if="hasFilters"
          class="button button-secondary"
          type="button"
          @click="clearFilters"
        >
          清除筛选
        </button>
        <RouterLink v-else class="button button-primary" to="/recipes/new">去新增</RouterLink>
        <button v-if="!hasFilters" class="text-button" type="button" @click="openImport">
          菜谱导入 / 导出
        </button>
      </div>
    </section>
    <section v-else-if="recipes.length" class="recipe-grid" aria-label="菜谱列表">
      <article
        v-for="recipe in recipes"
        :key="recipe.id"
        class="paper-card recipe-card"
        :class="{ 'recipe-selected': selectionOrder.has(recipe.id) }"
      >
        <button class="recipe-card-main" type="button" @click="goToRecipe(recipe.id)">
          <span v-if="selecting" class="selection-marker" aria-hidden="true">
            {{ selectionOrder.has(recipe.id) ? '✓' : '' }}
          </span>
          <span class="recipe-card-content">
            <strong>{{ recipe.title }}</strong>
            <span class="tag-line">
              <span v-for="tag in recipe.tags" :key="tag" class="tag-pill">{{ tag }}</span>
              <span v-if="duration(recipe)" class="tag-pill neutral-pill">{{
                duration(recipe)
              }}</span>
            </span>
            <span v-if="recipe.description" class="recipe-description">{{
              recipe.description
            }}</span>
          </span>
          <span class="card-chevron" aria-hidden="true">›</span>
        </button>
      </article>
      <div ref="listEnd" class="list-end">
        <button
          v-if="hasMore && !loadingMore"
          class="text-button"
          type="button"
          @click="fetchList(false)"
        >
          加载更多
        </button>
        <span v-else-if="loadingMore" role="status">正在加载更多…</span>
        <span v-else-if="loaded && recipes.length" class="muted">已经到底了</span>
      </div>
    </section>

    <div v-if="selecting" class="selection-bar">
      <span>已选 {{ selectionOrder.size }} 道</span>
      <button
        class="button button-primary"
        type="button"
        :disabled="selectionOrder.size === 0"
        @click="openKitchen('send')"
      >
        发送到厨房（{{ selectionOrder.size }}）
      </button>
    </div>

    <Teleport to="body">
      <div v-if="showMore" class="menu-scrim" @click.self="showMore = false">
        <nav class="more-menu paper-card" aria-label="更多功能">
          <button
            class="icon-button close-more"
            type="button"
            aria-label="关闭"
            @click="showMore = false"
          >
            ×
          </button>
          <button class="menu-action" type="button" @click="openImport">菜谱导入 / 导出</button>
          <button class="menu-action" type="button" @click="openKitchen('view')">
            查看厨房菜单
          </button>
          <RouterLink class="menu-action" to="/kitchen" @click="showMore = false">
            打开厨房显示
          </RouterLink>
          <button class="menu-action" type="button" @click="openHistory">做饭历史</button>
          <RouterLink class="menu-action" to="/health-check" @click="showMore = false">
            技术联通检查
          </RouterLink>
        </nav>
      </div>
    </Teleport>

    <KitchenMenuPanel
      :show="showKitchen"
      :mode="kitchenMode"
      :selections="selectedRecipes"
      @close="showKitchen = false"
      @sent="onKitchenSent"
    />
  </main>
</template>
