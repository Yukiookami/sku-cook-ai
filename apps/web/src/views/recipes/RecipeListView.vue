<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  recipeTotalMinutes,
  type RecipeSummary,
  type RecipeLikeResponse,
  type TakeoutCandidate,
} from '@sku-cook/shared';
import RecipeLikeButton from '../../components/recipes/RecipeLikeButton.vue';
import KitchenMenuPanel from '../../components/kitchen/KitchenMenuPanel.vue';
import ShoppingPanel from '../../components/kitchen/ShoppingPanel.vue';
import type { ShoppingPreviewInput } from '@sku-cook/shared';
import AccountMenu from '../../components/common/AccountMenu.vue';
import SegmentedSwitch from '../../components/common/SegmentedSwitch.vue';
import { apiErrorMessage } from '../../api/errors';
import { getRandomRecipe, getRecipeTags, getRecipes } from '../../api/recipes';
import { getRandomTakeoutCandidate } from '../../api/takeout';

let pendingRecipeListScrollRestore: number | null = null;

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
const showAddMenu = ref(false);
const showKitchen = ref(false);
const showShopping = ref(false);
const shoppingSelections = ref<ShoppingPreviewInput['items']>([]);

function openShopping(withSelection: boolean) {
  shoppingSelections.value = withSelection
    ? selectedRecipes.value.map((recipe) => ({
        recipeId: recipe.id,
        targetServings: recipe.servings,
      }))
    : [];
  showMore.value = false;
  showShopping.value = true;
}
const kitchenMode = ref<'send' | 'view'>('send');
const recommendation = ref<RecipeSummary | null>(null);
const randomLoading = ref(false);
const randomError = ref('');
const noAlternative = ref(false);
const randomAttemptExclude = ref<number | undefined>();
const recommendationModes = [
  { label: '自己做', value: 'cook' },
  { label: '点外卖', value: 'takeout' },
] as const;
const takeoutRecommendation = ref<TakeoutCandidate | null>(null);
const takeoutLoading = ref(false);
const takeoutError = ref('');
const takeoutNoAlternative = ref(false);
const takeoutAttemptExclude = ref<number | undefined>();
const recommendationMode = ref<'cook' | 'takeout'>(
  localStorage.getItem('sku-cook-ai:recommendation-mode') === 'takeout' ? 'takeout' : 'cook',
);
const listEnd = ref<HTMLElement | null>(null);
const displayTags = computed(() => tags.value);
const selectedRecipes = computed(() => [...selectionOrder.value.values()]);
const hasFilters = computed(() => Boolean(route.query.q || route.query.tag));
const duplicateLoadError = computed(
  () => Boolean(listError.value) && listError.value === tagsError.value,
);
let listSequence = 0;
let randomSequence = 0;
let takeoutSequence = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let observer: IntersectionObserver | undefined;

function duration(recipe: RecipeSummary): string | null {
  const total = recipeTotalMinutes(recipe.prepMinutes, recipe.cookMinutes);
  return total === null ? null : `${total}分钟`;
}

function updateLike(result: RecipeLikeResponse) {
  recipes.value = recipes.value.map((recipe) =>
    recipe.id === result.id ? { ...recipe, isLiked: result.isLiked } : recipe,
  );
  if (recommendation.value?.id === result.id)
    recommendation.value = { ...recommendation.value, isLiked: result.isLiked };
  const selected = selectionOrder.value.get(result.id);
  if (selected) selectionOrder.value.set(result.id, { ...selected, isLiked: result.isLiked });
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

function returnToRecipeList() {
  showKitchen.value = false;
  void router.push('/recipes');
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

async function requestTakeoutRecommendation(excludeCandidateId?: number) {
  const request = ++takeoutSequence;
  takeoutLoading.value = true;
  takeoutError.value = '';
  takeoutAttemptExclude.value = excludeCandidateId;
  try {
    const response = await getRandomTakeoutCandidate(
      excludeCandidateId === undefined ? {} : { excludeCandidateId },
    );
    if (request !== takeoutSequence) return;
    if (response.candidate) {
      takeoutRecommendation.value = response.candidate;
      takeoutNoAlternative.value = false;
    } else if (response.reason === 'EMPTY_LIBRARY') {
      takeoutRecommendation.value = null;
      takeoutNoAlternative.value = false;
      takeoutError.value = '还没有外卖候选，先添加店铺或菜品链接。';
    } else {
      takeoutNoAlternative.value = true;
    }
  } catch (cause) {
    if (request === takeoutSequence) {
      takeoutError.value = apiErrorMessage(cause, '外卖推荐失败，请重试。');
    }
  } finally {
    if (request === takeoutSequence) takeoutLoading.value = false;
  }
}

function openTakeoutManagement() {
  void router.push('/takeout');
}

function goToRecipe(id: number, fromRecommendation = false) {
  if (selecting.value && !fromRecommendation) {
    const found = [...recipes.value, ...(recommendation.value ? [recommendation.value] : [])].find(
      (recipe) => recipe.id === id,
    );
    if (found) toggleSelection(found);
    return;
  }
  pendingRecipeListScrollRestore = window.scrollY;
  void router.push(`/recipes/${id}`);
}

function openImport() {
  showMore.value = false;
  showAddMenu.value = false;
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

watch(recommendationMode, (mode) => localStorage.setItem('sku-cook-ai:recommendation-mode', mode), {
  immediate: true,
});

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
  const saved = pendingRecipeListScrollRestore;
  pendingRecipeListScrollRestore = null;
  sessionStorage.removeItem('recipe-list-scroll');
  if (saved !== null && Number.isFinite(saved) && saved > 0) {
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
  takeoutSequence += 1;
  if (searchTimer) clearTimeout(searchTimer);
  observer?.disconnect();
  window.removeEventListener('scroll', handleListScroll);
});
</script>

<template>
  <main class="page list-page" :class="{ 'selection-active': selecting }">
    <header class="home-header">
      <h1>{{ recommendationMode === 'cook' ? '吃什么饭' : '点什么饭' }}</h1>
      <div class="header-buttons">
        <button
          class="button button-primary compact-button"
          type="button"
          aria-haspopup="dialog"
          :aria-expanded="showAddMenu"
          @click="showAddMenu = true"
        >
          新增
        </button>
        <button class="button button-primary compact-button" type="button" @click="showMore = true">
          更多
        </button>
      </div>
    </header>
    <Teleport to="body">
      <div v-if="showAddMenu" class="menu-scrim" @click.self="showAddMenu = false">
        <nav class="more-menu paper-card add-menu" aria-label="新增菜谱">
          <div class="more-menu-heading">
            <span>新增菜谱</span>
            <button
              class="icon-button close-more"
              type="button"
              aria-label="关闭新增菜单"
              @click="showAddMenu = false"
            >
              ×
            </button>
          </div>
          <RouterLink class="menu-action" to="/recipes/new" @click="showAddMenu = false">
            手动新增菜谱
          </RouterLink>
          <button class="menu-action" type="button" @click="openImport">从 JSON 导入菜谱</button>
        </nav>
      </div>
    </Teleport>
    <section class="paper-card recommendation-card" aria-labelledby="recommend-title">
      <h2 id="recommend-title" class="section-chip">
        {{ recommendationMode === 'cook' ? '今天吃什么？' : '今天点什么？' }}
      </h2>
      <SegmentedSwitch
        v-model="recommendationMode"
        class="recommendation-mode-switch"
        :options="recommendationModes"
        label="推荐方式"
      />
      <template v-if="recommendationMode === 'cook'">
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
      </template>
      <template v-else>
        <p class="muted">从自己保存的外卖候选中随机挑选</p>
        <template v-if="takeoutRecommendation">
          <h3 class="recommend-title">{{ takeoutRecommendation.name }}</h3>
          <p v-if="!takeoutRecommendation.url" class="muted">此候选没有可打开的平台链接。</p>
          <p v-if="takeoutNoAlternative" class="inline-note" role="status">
            没有其他外卖候选，添加更多后再换一个。
          </p>
        </template>
        <p v-else-if="takeoutError" class="inline-error" role="alert">{{ takeoutError }}</p>
        <p v-else class="muted">按下按钮，为今天挑一家店或一道想吃的菜。</p>
        <div class="recommend-actions">
          <a
            v-if="takeoutRecommendation?.url"
            class="button button-primary"
            :href="takeoutRecommendation.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            打开平台链接
          </a>
          <button
            v-if="takeoutRecommendation"
            class="button button-secondary"
            type="button"
            :disabled="takeoutLoading || takeoutNoAlternative"
            @click="requestTakeoutRecommendation(takeoutRecommendation.id)"
          >
            {{ takeoutLoading ? '正在换…' : '换一个' }}
          </button>
          <button
            v-else
            class="button button-primary"
            type="button"
            :disabled="takeoutLoading"
            @click="requestTakeoutRecommendation()"
          >
            {{ takeoutLoading ? '正在推荐…' : '随机推荐' }}
          </button>
        </div>
        <p v-if="takeoutError && !takeoutError.includes('还没有外卖候选')" class="inline-links">
          <button
            class="text-button"
            type="button"
            @click="requestTakeoutRecommendation(takeoutAttemptExclude)"
          >
            重试推荐
          </button>
        </p>
        <p class="inline-links">
          <button class="text-button" type="button" @click="openTakeoutManagement">
            管理外卖候选
          </button>
        </p>
      </template>
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

    <div v-if="loading && !recipes.length" class="list-loading-state" role="status">
      <span class="list-loading-spinner" aria-hidden="true" />
      <span>正在加载菜谱…</span>
    </div>
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
        <RecipeLikeButton
          class="recipe-card-like"
          :recipe-id="recipe.id"
          :is-liked="recipe.isLiked"
          :disabled="selecting"
          @updated="updateLike"
        />
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

    <div v-if="selecting" class="selection-bar shopping-selection-bar">
      <span>已选 {{ selectionOrder.size }} 道</span>
      <button
        class="button button-secondary"
        type="button"
        :disabled="selectionOrder.size === 0"
        @click="openShopping(true)"
      >
        发送采购清单
      </button>
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
          <div class="more-menu-heading">
            <span>更多功能</span>
            <button
              class="icon-button close-more"
              type="button"
              aria-label="关闭"
              @click="showMore = false"
            >
              ×
            </button>
          </div>
          <AccountMenu @navigate="showMore = false" />
          <button class="menu-action" type="button" @click="openImport">菜谱导入 / 导出</button>
          <button class="menu-action" type="button" @click="openKitchen('view')">
            查看厨房菜单
          </button>
          <RouterLink class="menu-action" to="/kitchen" @click="showMore = false">
            打开厨房显示
          </RouterLink>
          <button class="menu-action" type="button" @click="openHistory">做饭历史</button>
          <button class="menu-action" type="button" @click="openShopping(false)">
            采购发送记录 / 重试
          </button>
          <RouterLink class="menu-action" to="/takeout" @click="showMore = false">
            外卖候选管理
          </RouterLink>
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
      @return-to-recipes="returnToRecipeList"
    />
    <ShoppingPanel
      :show="showShopping"
      :selections="shoppingSelections"
      @close="showShopping = false"
    />
  </main>
</template>
