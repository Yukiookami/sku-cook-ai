<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { accountErrorMessage } from '../../api/auth-errors';
import { loginAccount, registerAccount, validateAccountCredentials } from '../../api/auth';
import { setCurrentAccount } from '../../auth/session';

const route = useRoute();
const router = useRouter();
const username = ref('');
const password = ref('');
const email = ref('');
const submitting = ref(false);
const error = ref('');
const isRegister = computed(() => route.query.mode === 'register');
const submitLabel = computed(() => (isRegister.value ? '创建账号' : '登录'));

function switchMode() {
  error.value = '';
  void router.replace({
    name: 'account',
    query: {
      ...(isRegister.value ? {} : { mode: 'register' }),
      ...(typeof route.query.redirect === 'string' ? { redirect: route.query.redirect } : {}),
      ...(route.query.session === 'unavailable' ? { session: 'unavailable' } : {}),
    },
  });
}

function redirectPath(): string {
  const redirect = route.query.redirect;
  if (typeof redirect !== 'string' || !redirect.startsWith('/') || redirect.startsWith('//')) {
    return '/recipes';
  }
  return redirect;
}

async function submit() {
  if (submitting.value) return;
  if (!username.value) {
    error.value = isRegister.value ? '请填写用户名。' : '请填写用户名或邮箱。';
    return;
  }
  if (isRegister.value && !email.value) {
    error.value = '请填写邮箱。';
    return;
  }
  if (!password.value) {
    error.value = '请填写密码。';
    return;
  }
  const inputError = validateAccountCredentials(
    username.value,
    password.value,
    isRegister.value ? email.value : undefined,
  );
  if (inputError) {
    error.value = inputError;
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    const user = isRegister.value
      ? await registerAccount(username.value, password.value, email.value)
      : await loginAccount(username.value, password.value);
    setCurrentAccount(user);
    password.value = '';
    await router.replace(redirectPath());
  } catch (cause) {
    error.value = accountErrorMessage(
      cause,
      isRegister.value ? '注册失败，请检查填写内容后重试。' : '登录失败，请检查账号信息后重试。',
    );
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="page account-page">
    <header class="home-header account-header">
      <h1>吃什么饭</h1>
      <span class="account-header-mark">家庭菜谱</span>
    </header>

    <section class="paper-card account-card" aria-labelledby="account-title">
      <p class="section-chip">家庭账号</p>
      <h2 id="account-title">{{ isRegister ? '创建账号' : '欢迎回来' }}</h2>
      <p class="muted account-intro">
        {{ isRegister ? '创建账号后即可开始使用家庭菜谱。' : '登录后继续查看菜谱与厨房菜单。' }}
      </p>
      <p v-if="route.query.session === 'unavailable'" class="inline-error" role="alert">
        暂时无法确认登录状态，请重试或重新登录。
      </p>
      <form class="account-form" novalidate @submit.prevent="submit">
        <label class="account-field">
          <span>{{ isRegister ? '用户名' : '用户名或邮箱' }}</span>
          <input
            v-model="username"
            name="username"
            type="text"
            autocomplete="username"
            autocapitalize="none"
            :spellcheck="false"
            :maxlength="isRegister ? 32 : 254"
            required
            :disabled="submitting"
            :aria-describedby="error ? 'account-error' : undefined"
          />
        </label>
        <label v-if="isRegister" class="account-field">
          <span>邮箱</span>
          <input
            v-model="email"
            name="email"
            type="email"
            autocomplete="email"
            autocapitalize="none"
            :spellcheck="false"
            maxlength="254"
            required
            :disabled="submitting"
            :aria-describedby="error ? 'account-error' : undefined"
          />
          <span class="muted">邮箱可用于登录，不发送验证邮件。</span>
        </label>
        <label class="account-field">
          <span>密码</span>
          <input
            v-model="password"
            name="password"
            type="password"
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
            required
            :disabled="submitting"
            :aria-describedby="error ? 'account-error' : undefined"
          />
        </label>
        <p v-if="error" id="account-error" class="inline-error" role="alert">{{ error }}</p>
        <button
          class="button button-primary full-width account-submit"
          type="submit"
          :disabled="submitting"
        >
          {{ submitting ? (isRegister ? '正在创建…' : '正在登录…') : submitLabel }}
        </button>
      </form>
      <p class="account-switch">
        {{ isRegister ? '已经有账号？' : '还没有账号？' }}
        <button class="text-button" type="button" :disabled="submitting" @click="switchMode">
          {{ isRegister ? '返回登录' : '开放注册' }}
        </button>
      </p>
    </section>
  </main>
</template>
