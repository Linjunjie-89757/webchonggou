<script setup lang="ts">
import { Settings2 } from '@lucide/vue'

withDefaults(defineProps<{
  label?: string
  size?: number
}>(), {
  label: '字段设置',
  size: 14,
})
</script>

<template>
  <button
    type="button"
    class="app-table-settings-trigger"
    :aria-label="label"
    :title="label"
  >
    <Settings2 :size="size" />
  </button>
</template>

<style scoped>
.app-table-settings-trigger {
  display: inline-flex;
  width: 24px;
  height: 24px;
  min-width: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
}

.app-table-settings-trigger:hover,
.app-table-settings-trigger:focus-visible {
  background: rgba(59, 130, 246, 0.08);
  color: var(--app-primary);
  outline: none;
}
</style>
