<script setup lang="ts">
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
  }>(),
  {
    description: '该分类会在后续目标中按真实接口逐步接入，当前先保留统一占位态。',
  },
)
</script>

<template>
  <section class="settings-placeholder-panel">
    <AppEmptyState :title="title" :description="description" />
  </section>
</template>

<style scoped>
.settings-placeholder-panel {
  min-width: 0;
}
</style>
