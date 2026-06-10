<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string
  }>(),
  {
    text: '加载中...',
  },
)
</script>

<template>
  <div class="app-loading-state" role="status" aria-live="polite">
    <el-skeleton animated :rows="4" />
    <div class="app-loading-state__text">{{ text }}</div>
  </div>
</template>

<style scoped>
.app-loading-state {
  padding: var(--app-space-6);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.app-loading-state__text {
  margin-top: var(--app-space-4);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-md);
  text-align: center;
}
</style>
