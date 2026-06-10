<script setup lang="ts">
import { computed } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'

import type { DefectStat, DefectStatistics } from '@/entities/defect'
import { ConfigStatCard } from '@/entities/config'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

const props = defineProps<{
  statistics: DefectStatistics | null
  loading?: boolean
  errorMessage?: string
}>()

defineEmits<{
  retry: []
}>()

const stats = computed<DefectStat[]>(() => {
  const source = props.statistics ?? {
    total: 0,
    todo: 0,
    assigned: 0,
    inProgress: 0,
    pendingVerify: 0,
    closed: 0,
    rejected: 0,
  }

  return [
    { label: '缺陷总数', value: source.total, tone: 'primary' },
    { label: '待指派', value: source.todo },
    { label: '处理中', value: source.inProgress, tone: 'warning' },
    { label: '待验证', value: source.pendingVerify, tone: 'purple' },
    { label: '已关闭', value: source.closed, tone: 'success' },
  ]
})
</script>

<template>
  <div class="defect-summary-panel">
    <ConfigStatCard v-for="stat in stats" :key="stat.label" :stat="stat" />
    <div v-if="errorMessage" class="defect-summary-panel__error">
      <span>{{ errorMessage }}</span>
      <AppButton size="small" :icon="RefreshRight" :disabled="loading" @click="$emit('retry')">重试</AppButton>
    </div>
  </div>
</template>

<style scoped>
.defect-summary-panel {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.defect-summary-panel :deep(.config-stat-card) {
  min-height: 68px;
  padding: var(--app-space-3) var(--app-space-4);
}

.defect-summary-panel :deep(.config-stat-card strong) {
  font-size: 22px;
  line-height: 26px;
}

.defect-summary-panel__error {
  display: flex;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-lg);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.defect-summary-panel__error span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1180px) {
  .defect-summary-panel {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .defect-summary-panel {
    grid-template-columns: 1fr;
  }
}
</style>
