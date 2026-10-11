<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { deleteAccountSession } from '../../api/auth';
import { currentAccount, clearCurrentAccount } from '../../auth/session';
import { accountErrorMessage } from '../../api/auth-errors';

const router = useRouter();
const emit = defineEmits<{ navigate: [] }>();
const pending = ref(false);
const error = ref('');

async function logout() {
  if (pending.value) return;
  pending.value = true;
  error.value = '';
  try {
    await deleteAccountSession();
    clearCurrentAccount();
    await router.replace({ name: 'account' });
  } catch (cause) {
    if (axios.isAxiosError(cause) && cause.response?.status === 401) {
      clearCurrentAccount();
      await router.replace({ name: 'account' });
      return;
    }
    error.value = accountErrorMessage(cause, '退出失败，请稍后重试。');
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <section class="account-menu" aria-label="账号操作">
    <div class="account-menu-panel">
      <p class="account-menu-user">
        <span class="account-menu-avatar" aria-hidden="true">
          {{ currentAccount?.username.slice(0, 1).toUpperCase() ?? 'U' }}
        </span>
        <span>当前账号：{{ currentAccount?.username }}</span>
      </p>
      <RouterLink
        class="button button-secondary compact-button full-width"
        to="/account/profile"
        @click="emit('navigate')"
      >
        用户中心
      </RouterLink>
      <RouterLink
        v-if="currentAccount?.isSuperAdmin === true"
        class="button button-secondary compact-button full-width"
        to="/admin/users"
        @click="emit('navigate')"
      >
        管理员页面
      </RouterLink>
      <p v-if="error" class="inline-error account-menu-error" role="alert">{{ error }}</p>
      <button
        class="button button-secondary compact-button full-width"
        type="button"
        :disabled="pending"
        @click="logout"
      >
        {{ pending ? '正在退出…' : '退出并切换账号' }}
      </button>
    </div>
  </section>
</template>
