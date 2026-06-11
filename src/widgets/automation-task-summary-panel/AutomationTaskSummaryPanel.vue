<script setup lang="ts">
import { computed } from 'vue'

import type { AutomationTaskStat, AutomationTaskSummaryItem } from '@/entities/automation-task'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = defineProps<{
  items: AutomationTaskSummaryItem[]
  loading?: boolean
}>()

const stats = computed<AutomationTaskStat[]>(() => {
  const items = props.items
  return [
    { label: '当前任务', value: items.length, tone: 'primary' },
    { label: '待执行', value: items.filter((item) => item.status === 'READY').length },
    { label: '执行中', value: items.filter((item) => item.status === 'RUNNING').length, tone: 'warning' },
    { label: '失败', value: items.filter((item) => item.status === 'FAILED').length, tone: 'danger' },
    { label: '成功', value: items.filter((item) => item.status === 'SUCCESS').length, tone: 'success' },
  ]
})
</script>

<template>
  <section class="automation-task-summary-panel">
    <AppLoadingState v-if="loading && !items.length" text="正在加载任务统计..." />
    <article
      v-for="item in stats"
      v-else
      :key="item.label"
      class="automation-task-summary-panel__item"
      :class="item.tone ? `is-${item.tone}` : undefined"
    >
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
    </article>
  </section>
</template>

<style scoped>
.automation-task-summary-panel {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.automation-task-summary-panel__item {
  min-width: 0;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
}

.automation-task-summary-panel__item span {
  display: block;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.automation-task-summary-panel__item strong {
  display: block;
  margin-top: var(--app-space-1);
  color: var(--app-text-primary);
  font-size: var(--app-font-size-2xl);
  line-height: var(--app-line-height-lg);
}

.automation-task-summary-panel__item.is-primary strong {
  color: var(--app-primary);
}

.automation-task-summary-panel__item.is-success strong {
  color: var(--app-success);
}

.automation-task-summary-panel__item.is-warning strong {
  color: var(--app-warning);
}

.automation-task-summary-panel__item.is-danger strong {
  color: var(--app-danger);
}

@media (max-width: 980px) {
  .automation-task-summary-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .automation-task-summary-panel {
    grid-template-columns: 1fr;
  }
}
</style>
