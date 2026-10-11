<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { deleteAccountSession } from '../../api/auth';
import { currentAccount, clearCurrentAccount } from '../../auth/session';
import { accountErrorMessage } from '../../api/auth-errors';

const router = useRouter();
defineProps<{ embedded?: boolean }>();
const emit = defineEmits<{ navigate: [] }>();
const open = ref(false);
const pending = ref(false);
const error = ref('');

function syncOpen(event: Event) {
  open.value = (event.currentTarget as HTMLDetailsElement).open;
}

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
  <component
    :is="embedded ? 'section' : 'details'"
    class="account-menu"
    :class="{ 'account-menu-embedded': embedded }"
    @toggle="syncOpen"
  >
    <summary v-if="!embedded" :aria-expanded="open" aria-label="账号菜单">
      <span class="account-menu-avatar" aria-hidden="true">
        {{ currentAccount?.username.slice(0, 1).toUpperCase() ?? 'U' }}
      </span>
    </summary>
    <div class="account-menu-panel">
      <p class="account-menu-user">
        <span v-if="embedded" class="account-menu-avatar" aria-hidden="true">
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
  </component>
</template>
