<script setup lang="ts">
import { RouterView } from 'vue-router';
import { Button as VanButton } from 'vant';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import 'vant/lib/button/style';

const { needRefresh, updateServiceWorker } = useRegisterSW();
</script>

<template>
  <div v-if="needRefresh" class="update-notice" role="status">
    新版本已准备好。
    <VanButton size="small" @click="updateServiceWorker()">刷新页面</VanButton>
  </div>
  <RouterView />
</template>
