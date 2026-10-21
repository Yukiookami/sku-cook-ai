<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import {
  RecipeIdParamsSchema,
  TargetServingsSchema,
  scaleIngredientAmount,
  type Recipe,
  type RecipeSummary,
  type RecipeLikeResponse,
} from '@sku-cook/shared';
import PageHeader from '../../components/common/PageHeader.vue';
import RecipeLikeButton from '../../components/recipes/RecipeLikeButton.vue';
import ConfirmDialog from '../../components/common/ConfirmDialog.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import KitchenMenuPanel from '../../components/kitchen/KitchenMenuPanel.vue';
import ShoppingPanel from '../../components/kitchen/ShoppingPanel.vue';
import { apiErrorMessage } from '../../api/errors';
import { deleteRecipe, getRecipe } from '../../api/recipes';
import { recordCookingHistory } from '../../api/cooking-history';
import { createSingleRecipeExport } from '../../domain/recipe-export';

const route = useRoute();
const router = useRouter();
const recipe = ref<Recipe | null>(null);
const loading = ref(false);
const loadError = ref('');
const notFound = ref(false);
const targetServings = ref(1);
const writing = ref(false);
const { dialog, confirm, settle } = useConfirmDialog();
const writeError = ref('');
const showMore = ref(false);
const showKitchen = ref(false);
const showShopping = ref(false);
const kitchenSelection = ref<RecipeSummary[]>([]);
const exportStatus = ref('');
const exportError = ref('');
const exporting = ref(false);
let sequence = 0;

const ingredientGroups = computed(() => {
  if (!recipe.value) return [];
  const groups = new Map<string, Recipe['ingredients']>();
  for (const ingredient of recipe.value.ingredients) {
    const name = ingredient.group?.trim() || '食材';
    const group = groups.get(name) ?? [];
    group.push(ingredient);
    groups.set(name, group);
  }
  const defaultGroup = groups.get('食材');
  const namedGroups = [...groups.entries()].filter(([name]) => name !== '食材');
  return [...(defaultGroup ? [['食材', defaultGroup] as const] : []), ...namedGroups];
});

const sourceUrl = computed(() => {
  const value = recipe.value?.source?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
});

function difficultyLabel(value: 'easy' | 'medium' | 'hard'): string {
  return { easy: '简单', medium: '中等', hard: '复杂' }[value];
}

function formattedAmount(ingredient: Recipe['ingredients'][number]) {
  const current = recipe.value;
  if (!current) return null;
  return scaleIngredientAmount(
    ingredient.amount,
    ingredient.scaleWithServings,
    current.servings,
    targetServings.value,
  );
}

async function loadRecipe() {
  const current = ++sequence;
  const params = RecipeIdParamsSchema.safeParse({ id: Number(route.params.id) });
  if (!params.success) {
    recipe.value = null;
    notFound.value = true;
    loadError.value = '';
    loading.value = false;
    return;
  }
  loading.value = true;
  loadError.value = '';
  notFound.value = false;
  try {
    const result = await getRecipe(params.data.id);
    if (current !== sequence) return;
    recipe.value = result;
    const requestedTarget = TargetServingsSchema.safeParse(Number(route.query.targetServings));
    targetServings.value = requestedTarget.success ? requestedTarget.data : result.servings;
  } catch (cause) {
    if (current !== sequence) return;
    recipe.value = null;
    if (axios.isAxiosError(cause) && cause.response?.status === 404) {
      notFound.value = true;
    } else {
      loadError.value = apiErrorMessage(cause, '无法读取菜谱，请检查网络后重试。');
    }
  } finally {
    if (current === sequence) loading.value = false;
  }
}

function adjustServings(direction: number) {
  if (writing.value) return;
  const next = targetServings.value + direction;
  if (next >= 1 && next <= 100) targetServings.value = next;
}

function summaryFromRecipe(value: Recipe): RecipeSummary {
  return {
    id: value.id,
    isLiked: value.isLiked,
    title: value.title,
    description: value.description,
    servings: value.servings,
    prepMinutes: value.prepMinutes,
    cookMinutes: value.cookMinutes,
    difficulty: value.difficulty,
    tags: value.tags,
    updatedAt: value.updatedAt,
  };
}

function updateLike(result: RecipeLikeResponse) {
  if (recipe.value?.id === result.id) recipe.value = { ...recipe.value, isLiked: result.isLiked };
}

function openKitchen() {
  if (!recipe.value) return;
  kitchenSelection.value = [summaryFromRecipe(recipe.value)];
  showKitchen.value = true;
  showMore.value = false;
}

function returnToRecipeList() {
  showKitchen.value = false;
  void router.push('/recipes');
}

function historyLink() {
  if (!recipe.value) return;
  void router.push({ name: 'cooking-history' });
}

function exportRecipe() {
  const currentRecipe = recipe.value;
  if (!currentRecipe || exporting.value) return;

  exporting.value = true;
  exportStatus.value = '';
  exportError.value = '';
  try {
    const data = createSingleRecipeExport(currentRecipe);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = [...currentRecipe.title]
      .map((character) =>
        /[<>:"/\\|?*]/.test(character) || character.charCodeAt(0) < 32 ? '_' : character,
      )
      .join('')
      .trim();
    link.href = url;
    link.download = `${safeTitle || `recipe-${currentRecipe.id}`}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    exportStatus.value = `已导出「${currentRecipe.title}」，JSON文件包含1道菜谱，可在菜谱导入页导入。`;
    showMore.value = false;
  } catch {
    exportError.value = '导出失败，请稍后重试。';
  } finally {
    exporting.value = false;
  }
}

async function recordCooked() {
  if (!recipe.value || writing.value) return;
  const recipeId = recipe.value.id;
  const servings = targetServings.value;
  const title = recipe.value.title;
  writing.value = true;
  writeError.value = '';
  try {
    if (
      !(await confirm({
        title: '记录做过',
        message: `记录刚做过「${title}」${servings}人份？时间按现在保存。`,
        confirmText: '确认记录',
      }))
    )
      return;
    await recordCookingHistory({ recipeId, targetServings: servings });
    writeError.value = '已记录做饭历史。';
  } catch {
    writeError.value = '记录结果暂未确认，请先查看做饭历史，不要重复提交。';
  } finally {
    writing.value = false;
  }
}

async function removeRecipe() {
  if (!recipe.value || writing.value) return;
  const currentRecipe = recipe.value;
  writing.value = true;
  writeError.value = '';
  try {
    if (
      !(await confirm({
        title: '删除菜谱',
        message: `删除「${currentRecipe.title}」？食材和步骤也会删除；若在厨房菜单中，也会移除。已有做饭历史会保留名字和份数，但不能再打开此菜谱。`,
        confirmText: '确认删除',
        danger: true,
      }))
    )
      return;
    await deleteRecipe(currentRecipe.id);
    void router.replace('/recipes');
  } catch (cause) {
    writeError.value = apiErrorMessage(cause, '删除结果暂未确认，请返回列表查询后再决定。');
  } finally {
    writing.value = false;
  }
}

function goBack() {
  if (window.history.length > 1) router.back();
  else void router.push('/recipes');
}

watch(() => [route.params.id, route.query.targetServings], loadRecipe);
onMounted(loadRecipe);
onBeforeUnmount(() => {
  sequence += 1;
});
</script>

<template>
  <main class="page detail-page">
    <ConfirmDialog :options="dialog" @close="settle" />
    <PageHeader title="菜谱详情" @back="goBack">
      <template #right>
        <button class="button button-primary compact-button" type="button" @click="showMore = true">
          更多
        </button>
      </template>
    </PageHeader>

    <p v-if="loading" class="state-note" role="status">正在读取菜谱…</p>
    <section v-else-if="notFound" class="paper-card empty-state" role="alert">
      <h2>菜谱不存在</h2>
      <p class="muted">菜谱可能已删除，或链接中的编号无效。</p>
      <RouterLink class="button button-primary" to="/recipes">返回菜谱</RouterLink>
    </section>
    <section v-else-if="loadError" class="paper-card empty-state" role="alert">
      <h2>无法读取菜谱</h2>
      <p>{{ loadError }}</p>
      <button class="button button-primary" type="button" @click="loadRecipe">重试</button>
    </section>
    <template v-else-if="recipe">
      <section class="paper-card recipe-summary">
        <div class="detail-title-row">
          <h2 class="detail-title">{{ recipe.title }}</h2>
          <RecipeLikeButton
            :recipe-id="recipe.id"
            :is-liked="recipe.isLiked"
            :disabled="writing"
            @updated="updateLike"
          />
        </div>
        <p class="muted recipe-like-description">爱心表示：喜欢吃，也做得好吃。</p>
        <p v-if="recipe.description" class="detail-description">{{ recipe.description }}</p>
        <p class="recipe-meta">
          原菜谱 {{ recipe.servings }} 人份
          <span v-if="recipe.prepMinutes !== null">· 准备 {{ recipe.prepMinutes }} 分钟</span>
          <span v-if="recipe.cookMinutes !== null">· 烹饪 {{ recipe.cookMinutes }} 分钟</span>
          <span v-if="recipe.difficulty">· {{ difficultyLabel(recipe.difficulty) }}</span>
        </p>
        <div v-if="recipe.tags.length" class="tag-line">
          <span v-for="tag in recipe.tags" :key="tag" class="tag-pill">{{ tag }}</span>
        </div>
      </section>

      <section
        v-for="[groupName, ingredients] in ingredientGroups"
        :key="groupName"
        class="paper-card detail-section"
      >
        <div class="section-heading">
          <h2>{{ groupName }}</h2>
          <div class="servings-control" aria-label="调整目标份数">
            <button
              class="stepper-button"
              type="button"
              :disabled="targetServings <= 1 || writing"
              aria-label="减少目标份数"
              @click="adjustServings(-1)"
            >
              −
            </button>
            <span>目标 {{ targetServings }} 人份</span>
            <button
              class="stepper-button"
              type="button"
              :disabled="targetServings >= 100 || writing"
              aria-label="增加目标份数"
              @click="adjustServings(1)"
            >
              ＋
            </button>
          </div>
        </div>
        <p class="muted">参考用量，调料按口味调整</p>
        <ul class="ingredient-list">
          <li v-for="(ingredient, index) in ingredients" :key="`${ingredient.name}-${index}`">
            <div>
              <strong>{{ ingredient.name }}</strong>
              <span v-if="ingredient.note" class="ingredient-note">{{ ingredient.note }}</span>
              <span
                v-if="ingredient.scaleWithServings === false && targetServings !== recipe.servings"
                class="muted inline-caption"
              >
                原量，按需调整
              </span>
            </div>
            <span class="ingredient-amount">
              <template v-if="ingredient.amount">
                <template v-if="formattedAmount(ingredient)?.approximate">约</template>
                {{ formattedAmount(ingredient)?.text }}
                <template v-if="formattedAmount(ingredient)?.unconverted">
                  <span class="muted">（未换算）</span>
                </template>
                <template
                  v-else-if="
                    formattedAmount(ingredient)?.preserved && targetServings !== recipe.servings
                  "
                >
                  <span class="muted">（原量）</span>
                </template>
              </template>
              {{ ingredient.unit }}
            </span>
          </li>
        </ul>
        <p v-if="targetServings !== recipe.servings" class="muted">步骤与时间沿用原菜谱。</p>
      </section>

      <section class="paper-card detail-section">
        <h2>做法</h2>
        <ol class="steps-list">
          <li v-for="step in recipe.steps" :key="step.order">
            <span class="step-number">{{ String(step.order).padStart(2, '0') }}</span>
            <p>{{ step.text }}</p>
          </li>
        </ol>
      </section>

      <section v-if="recipe.tips" class="paper-card detail-section">
        <h2>窍门</h2>
        <p class="long-text">{{ recipe.tips }}</p>
      </section>
      <section v-if="recipe.source" class="paper-card detail-section">
        <h2>来源</h2>
        <a v-if="sourceUrl" :href="sourceUrl" target="_blank" rel="noopener noreferrer">{{
          recipe.source
        }}</a>
        <p v-else class="long-text">{{ recipe.source }}</p>
      </section>
      <p v-if="writeError" class="inline-note" role="status">{{ writeError }}</p>
      <p v-if="exportStatus" class="inline-note" role="status">{{ exportStatus }}</p>
      <p v-if="exportError" class="inline-note" role="alert">{{ exportError }}</p>
      <p v-if="writeError.includes('暂未确认')" class="inline-links">
        <button class="text-button" type="button" @click="historyLink">查看做饭历史</button>
      </p>
      <div class="bottom-spacer" aria-hidden="true" />
    </template>

    <div v-if="recipe" class="fixed-action shopping-action">
      <button
        class="button button-secondary"
        type="button"
        :disabled="writing"
        @click="showShopping = true"
      >
        发送采购清单
      </button>
      <button class="button button-primary" type="button" :disabled="writing" @click="openKitchen">
        发送到厨房
      </button>
    </div>

    <Teleport to="body">
      <div v-if="showMore" class="menu-scrim" @click.self="showMore = false">
        <nav class="more-menu paper-card" aria-label="菜谱操作">
          <div class="more-menu-heading">
            <span>菜谱操作</span>
            <button
              class="icon-button close-more"
              type="button"
              aria-label="关闭"
              @click="showMore = false"
            >
              ×
            </button>
          </div>
          <RouterLink
            class="menu-action"
            :to="`/recipes/${recipe?.id}/edit`"
            @click="showMore = false"
          >
            编辑菜谱
          </RouterLink>
          <button class="menu-action" type="button" :disabled="exporting" @click="exportRecipe">
            {{ exporting ? '正在导出…' : '导出单道菜谱 JSON' }}
          </button>
          <button class="menu-action" type="button" :disabled="writing" @click="recordCooked">
            {{ writing ? '提交中…' : '记录做过' }}
          </button>
          <button
            class="menu-action danger-text"
            type="button"
            :disabled="writing"
            @click="removeRecipe"
          >
            删除菜谱
          </button>
        </nav>
      </div>
    </Teleport>
    <KitchenMenuPanel
      :show="showKitchen"
      mode="send"
      :selections="kitchenSelection"
      :initial-targets="recipe ? { [recipe.id]: targetServings } : {}"
      @close="showKitchen = false"
      @return-to-recipes="returnToRecipeList"
    />
    <ShoppingPanel
      :show="showShopping"
      :selections="recipe ? [{ recipeId: recipe.id, targetServings }] : []"
      @close="showShopping = false"
    />
  </main>
</template>
