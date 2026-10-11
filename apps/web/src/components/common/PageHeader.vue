<script setup lang="ts">
import AccountMenu from './AccountMenu.vue';

defineProps<{ title: string }>();
const emit = defineEmits<{ back: []; right: [] }>();
</script>

<template>
  <header class="page-header">
    <button class="text-button header-back" type="button" @click="emit('back')">‹ 返回</button>
    <h1>{{ title }}</h1>
    <div class="header-action header-action-group">
      <slot name="right"><span aria-hidden="true" /></slot>
      <AccountMenu />
    </div>
  </header>
</template>
