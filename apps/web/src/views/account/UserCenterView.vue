<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { UpdateUsernameRequestSchema, UpdatePasswordRequestSchema } from '@sku-cook/shared';
import PageHeader from '../../components/common/PageHeader.vue';
import ConfirmDialog from '../../components/common/ConfirmDialog.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { updateAccountUsername, updateAccountPassword } from '../../api/auth';
import { accountErrorMessage } from '../../api/auth-errors';
import { currentAccount, setCurrentAccount } from '../../auth/session';

const router = useRouter();
const username = ref(currentAccount.value?.username ?? '');
const currentPassword = ref('');
const newPassword = ref('');
const pending = ref(false);
const { dialog, confirm, settle } = useConfirmDialog();
const usernameError = ref('');
const passwordError = ref('');
const usernameSuccess = ref('');
const passwordSuccess = ref('');

async function saveUsername() {
  if (pending.value) return;
  usernameError.value = '';
  usernameSuccess.value = '';
  const parsed = UpdateUsernameRequestSchema.safeParse({ username: username.value });
  if (!parsed.success) {
    usernameError.value = '用户名须为3～32位，以英文字母开头，仅含字母、数字和下划线。';
    return;
  }
  pending.value = true;
  try {
    const user = await updateAccountUsername(parsed.data.username);
    setCurrentAccount(user);
    username.value = user.username;
    usernameSuccess.value = '用户名已更新。';
  } catch (error) {
    usernameError.value = accountErrorMessage(error, '修改用户名失败，请稍后重试。');
  } finally {
    pending.value = false;
  }
}

async function savePassword() {
  if (pending.value) return;
  passwordError.value = '';
  passwordSuccess.value = '';
  const parsed = UpdatePasswordRequestSchema.safeParse({
    currentPassword: currentPassword.value,
    newPassword: newPassword.value,
  });
  if (!parsed.success) {
    passwordError.value = '当前密码和新密码均须为8～128位，且不能全为空白。';
    return;
  }
  pending.value = true;
  try {
    if (
      !(await confirm({
        title: '确认修改密码',
        message: '确定使用新密码吗？现有登录会话将保持不变。',
        confirmText: '确认修改',
      }))
    )
      return;
    const user = await updateAccountPassword(parsed.data);
    setCurrentAccount(user);
    currentPassword.value = '';
    newPassword.value = '';
    passwordSuccess.value = '密码已更新，现有登录会话保持不变。';
  } catch (error) {
    passwordError.value = accountErrorMessage(error, '修改密码失败，请稍后重试。');
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <main class="page account-page user-center-page">
    <ConfirmDialog :options="dialog" @close="settle" />
    <PageHeader title="用户中心" @back="router.push({ name: 'recipe-list' })" />
    <p class="account-current-user">当前用户名：{{ currentAccount?.username }}</p>
    <p class="account-current-user">
      邮箱：{{ currentAccount?.email ?? '未设置（仍可用用户名登录）' }}
    </p>
    <section class="paper-card account-card">
      <h2>修改用户名</h2>
      <form class="account-form" @submit.prevent="saveUsername">
        <label for="profile-username">用户名</label>
        <input
          id="profile-username"
          v-model="username"
          :disabled="pending"
          autocomplete="username"
          autocapitalize="none"
          :spellcheck="false"
          maxlength="32"
          aria-describedby="username-help username-error"
        />
        <p id="username-help">
          3～32位，以英文字母开头，仅含字母、数字和下划线；大小写不敏感唯一。
        </p>
        <p v-if="usernameError" id="username-error" class="inline-error" role="alert">
          {{ usernameError }}
        </p>
        <p v-if="usernameSuccess" role="status">{{ usernameSuccess }}</p>
        <button class="button button-primary account-submit" type="submit" :disabled="pending">
          保存用户名
        </button>
      </form>
    </section>
    <section class="paper-card account-card">
      <h2>修改密码</h2>
      <form class="account-form" @submit.prevent="savePassword">
        <label for="profile-current-password">当前密码</label>
        <input
          id="profile-current-password"
          v-model="currentPassword"
          type="password"
          :disabled="pending"
          autocomplete="current-password"
          maxlength="128"
          aria-describedby="password-help password-error"
        />
        <label for="profile-new-password">新密码</label>
        <input
          id="profile-new-password"
          v-model="newPassword"
          type="password"
          :disabled="pending"
          autocomplete="new-password"
          maxlength="128"
          aria-describedby="password-help password-error"
        />
        <p id="password-help">密码为8～128位，不能全为空白。提交前需确认，修改后保持现有会话。</p>
        <p v-if="passwordError" id="password-error" class="inline-error" role="alert">
          {{ passwordError }}
        </p>
        <p v-if="passwordSuccess" role="status">{{ passwordSuccess }}</p>
        <button class="button button-primary account-submit" type="submit" :disabled="pending">
          修改密码
        </button>
      </form>
    </section>
    <p v-if="pending" role="status">正在处理，请勿重复提交。</p>
  </main>
</template>
