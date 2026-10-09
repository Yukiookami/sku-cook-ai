<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import type { RecipeInput } from '@sku-cook/shared';
import PageHeader from '../../components/common/PageHeader.vue';
import RecipeForm from '../../components/recipes/RecipeForm.vue';
import { apiErrorMessage } from '../../api/errors';
import { createRecipe } from '../../api/recipes';
import axios from 'axios';

const router = useRouter();
const dirty = ref(false);
const saving = ref(false);
const titleError = ref('');
const serverError = ref('');

async function save(input: RecipeInput) {
  if (saving.value) return;
  saving.value = true;
  titleError.value = '';
  serverError.value = '';
  try {
    const recipe = await createRecipe(input);
    await router.replace(`/recipes/${recipe.id}`);
  } catch (cause) {
    if (axios.isAxiosError(cause) && cause.response?.status === 409) {
      titleError.value = '已有同名菜谱，请修改菜名。';
    } else if (!axios.isAxiosError(cause) || !cause.response) {
      serverError.value = '保存结果暂未确认，请先返回菜谱一览查询，不要重复提交。';
    } else {
      serverError.value = apiErrorMessage(cause, '保存失败，草稿已保留，请修正后重试。');
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
    else void router.push('/recipes');
  }
}
onBeforeRouteLeave(() => {
  if (dirty.value && !saving.value && !window.confirm('未保存内容将丢失，仍要离开吗？')) {
    return false;
  }
});
window.addEventListener('beforeunload', beforeUnload);
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
</script>

<template>
  <main class="page form-page">
    <PageHeader title="新增菜谱" @back="back" />
    <RecipeForm
      submit-label="保存菜谱"
      :saving="saving"
      :title-error="titleError"
      :server-error="serverError"
      @submit="save"
      @dirty-change="dirty = $event"
    />
  </main>
</template>
