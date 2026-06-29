<script setup lang="ts">
import type { ApiRequestContentTabItem, RequestContentTab } from './apiInterfaceTypes'

const props = defineProps<{
  tabs: ApiRequestContentTabItem[]
  activeTab: RequestContentTab
}>()

const emit = defineEmits<{
  'update:activeTab': [value: RequestContentTab]
}>()
</script>

<template>
  <div class="api-content-tabs">
    <button
      v-for="tab in props.tabs"
      :key="tab.value"
      :class="['api-content-tab', { 'is-active': props.activeTab === tab.value }]"
      type="button"
      @click="emit('update:activeTab', tab.value)"
    >
      {{ tab.label }}
      <span v-if="tab.count" class="api-tab-badge">{{ tab.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.api-content-tabs {
  display: flex;
  height: 46px;
  min-height: 46px;
  align-items: center;
  gap: 0;
  overflow: hidden;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.api-content-tab {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  height: 45px;
  align-items: center;
  gap: 6px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  padding: 0 12px;
  white-space: nowrap;
}

.api-content-tab.is-active {
  border-bottom-color: var(--app-primary);
  color: var(--app-primary);
  font-weight: 500;
}

.api-content-tab:not(.is-active):hover {
  color: var(--app-text-secondary);
}

.api-content-tab.is-active::after {
  content: none;
}

.api-tab-badge {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
  padding: 0 5px;
}
</style>
