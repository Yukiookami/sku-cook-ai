<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { AdminUsersResponse } from '@sku-cook/shared';
import PageHeader from '../../components/common/PageHeader.vue';
import { getAdminUsers } from '../../api/auth';
import { accountErrorMessage } from '../../api/auth-errors';
import { currentAccount } from '../../auth/session';

const router = useRouter();
const allowed = computed(() => currentAccount.value?.isSuperAdmin === true);
const result = ref<AdminUsersResponse | null>(null);
const loading = ref(false);
const error = ref('');
const page = ref(1);
let sequence = 0;

async function load(target: number) {
  if (!allowed.value || loading.value) return;
  const request = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const data = await getAdminUsers(target);
    if (request !== sequence) return;
    result.value = data;
    page.value = target;
  } catch (cause) {
    if (request === sequence)
      error.value = accountErrorMessage(cause, '无法读取用户列表，请重试。');
  } finally {
    if (request === sequence) loading.value = false;
  }
}

onMounted(() => load(1));
onBeforeUnmount(() => {
  sequence += 1;
});
</script>

<template>
  <main class="page">
    <PageHeader title="注册用户" @back="router.push('/recipes')" />
    <p v-if="!allowed" class="inline-error" role="alert">仅超级管理员可查看用户列表。</p>
    <template v-else>
      <p class="muted">仅查看注册用户，不修改账号、密码或权限。邮箱未经过验证。</p>
      <p v-if="loading" role="status">正在读取用户列表…</p>
      <div v-if="error" class="inline-error" role="alert">
        {{ error }}
        <button class="text-button" type="button" :disabled="loading" @click="load(page)">
          重试
        </button>
      </div>
      <p v-if="result && result.items.length === 0 && !error" class="state-note">暂无注册用户。</p>
      <article v-for="user in result?.items" :key="user.id" class="paper-card">
        <h2>{{ user.username }}</h2>
        <p>用户 ID：{{ user.id }}</p>
        <p class="account-current-user">邮箱：{{ user.email ?? '未设置' }}</p>
        <p class="muted">注册时间：{{ new Date(user.createdAt).toLocaleString('zh-CN') }}</p>
      </article>
      <nav v-if="result" class="header-action-group" aria-label="用户列表分页">
        <button
          class="button button-secondary"
          type="button"
          :disabled="loading || page <= 1"
          @click="load(page - 1)"
        >
          上一页
        </button>
        <span>第 {{ page }} 页</span>
        <button
          class="button button-secondary"
          type="button"
          :disabled="loading || !result.hasMore"
          @click="load(page + 1)"
        >
          下一页
        </button>
      </nav>
    </template>
  </main>
</template>
