<script setup lang="ts">
import { ref } from 'vue';
import { Button as VanButton } from 'vant';
import { getHealth } from '../api/health';
import 'vant/lib/button/style';

const loading = ref(false);
const message = ref('基础工程已就绪，菜谱业务尚未实现。');
const failed = ref(false);

async function checkConnection() {
  loading.value = true;
  failed.value = false;
  try {
    const health = await getHealth();
    message.value = `连接成功：${health.service}（不代表数据库已连接）`;
  } catch (error) {
    console.error('Health check failed', error);
    failed.value = true;
    message.value = '无法连接后端，请确认 API 已启动，并检查代理配置。';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="home">
    <p class="eyebrow">PERSONAL DAILY APP</p>
    <h1>家庭菜谱</h1>
    <p :role="failed ? 'alert' : 'status'">{{ message }}</p>
    <VanButton type="primary" :loading="loading" @click="checkConnection"> 检查后端连接 </VanButton>
  </main>
</template>
