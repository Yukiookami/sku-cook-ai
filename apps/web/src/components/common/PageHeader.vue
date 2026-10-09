<script setup lang="ts">
defineProps<{ title: string }>();
const emit = defineEmits<{ back: []; right: [] }>();
</script>

<template>
  <header class="page-header">
    <button class="text-button header-back" type="button" @click="emit('back')">‹ 返回</button>
    <h1>{{ title }}</h1>
    <div class="header-action">
      <slot name="right"><span aria-hidden="true" /></slot>
    </div>
  </header>
</template>
