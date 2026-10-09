<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import axios from 'axios';
import { RecipeIdParamsSchema, type Recipe, type RecipeInput } from '@sku-cook/shared';
import PageHeader from '../../components/common/PageHeader.vue';
import RecipeForm from '../../components/recipes/RecipeForm.vue';
import { apiErrorMessage } from '../../api/errors';
import { getRecipe, updateRecipe } from '../../api/recipes';

const route = useRoute();
const router = useRouter();
const recipe = ref<Recipe | null>(null);
const loading = ref(false);
const loadError = ref('');
const notFound = ref(false);
const dirty = ref(false);
const saving = ref(false);
const titleError = ref('');
const serverError = ref('');
let loadSequence = 0;

async function load() {
  const current = ++loadSequence;
  const params = RecipeIdParamsSchema.safeParse({ id: Number(route.params.id) });
  if (!params.success) {
    notFound.value = true;
    loading.value = false;
    return;
  }
  loading.value = true;
  loadError.value = '';
  notFound.value = false;
  try {
    const result = await getRecipe(params.data.id);
    if (current !== loadSequence) return;
    recipe.value = result;
  } catch (cause) {
    if (current !== loadSequence) return;
    recipe.value = null;
    if (axios.isAxiosError(cause) && cause.response?.status === 404) {
      notFound.value = true;
    } else {
      loadError.value = apiErrorMessage(cause, '无法读取菜谱，请检查网络后重试。');
    }
  } finally {
    if (current === loadSequence) loading.value = false;
  }
}

async function save(input: RecipeInput) {
  if (!recipe.value || saving.value) return;
  saving.value = true;
  titleError.value = '';
  serverError.value = '';
  try {
    await updateRecipe(recipe.value.id, input);
    dirty.value = false;
    void router.replace(`/recipes/${recipe.value.id}`);
  } catch (cause) {
    if (axios.isAxiosError(cause) && cause.response?.status === 409) {
      titleError.value = '已有同名菜谱，请修改菜名。';
    } else if (axios.isAxiosError(cause) && cause.response?.status === 404) {
      serverError.value = '菜谱已被删除，本次修改未保存。';
      notFound.value = true;
    } else if (!axios.isAxiosError(cause) || !cause.response) {
      serverError.value = '保存结果暂未确认，请重新读取菜谱核对，不要自动再次提交。';
    } else {
      serverError.value = apiErrorMessage(cause, '保存失败，修改已保留，请重试。');
    }
  } finally {
    saving.value = false;
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value || saving.value) return;
  event.preventDefault();
  event.returnValue = '';
}
function back() {
  if (!dirty.value || window.confirm('未保存内容将丢失，仍要离开吗？')) {
    if (window.history.length > 1) router.back();
    else void router.push(`/recipes/${String(route.params.id)}`);
  }
}
onBeforeRouteLeave(() => {
  if (dirty.value && !saving.value && !window.confirm('未保存内容将丢失，仍要离开吗？')) {
    return false;
  }
});
watch(() => route.params.id, load);
onMounted(() => {
  void load();
  window.addEventListener('beforeunload', beforeUnload);
});
onBeforeUnmount(() => {
  loadSequence += 1;
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<template>
  <main class="page form-page">
    <PageHeader title="编辑菜谱" @back="back" />
    <p v-if="loading" class="state-note" role="status">正在读取菜谱…</p>
    <section v-else-if="notFound" class="paper-card empty-state" role="alert">
      <h2>菜谱不存在</h2>
      <p>可能已被删除，编辑不会自动创建新菜谱。</p>
      <RouterLink class="button button-primary" to="/recipes">返回菜谱</RouterLink>
    </section>
    <section v-else-if="loadError" class="paper-card empty-state" role="alert">
      <h2>无法读取菜谱</h2>
      <p>{{ loadError }}</p>
      <button class="button button-primary" type="button" @click="load">重试</button>
    </section>
    <RecipeForm
      v-else-if="recipe"
      :key="recipe.id"
      :initial-recipe="recipe"
      submit-label="保存修改"
      :saving="saving"
      :title-error="titleError"
      :server-error="serverError"
      @submit="save"
      @dirty-change="dirty = $event"
    />
  </main>
</template>
