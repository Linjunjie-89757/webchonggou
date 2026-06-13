<script setup lang="ts">
import { computed } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'

import type { DefectStatistics } from '@/entities/defect'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

type DefectSummaryCard = {
  label: string
  value: number
  description: string
  status: string
  tone: 'primary' | 'assigned' | 'processing' | 'verify'
}

const props = defineProps<{
  statistics: DefectStatistics | null
  loading?: boolean
  errorMessage?: string
  activeStatus?: string
}>()

const emit = defineEmits<{
  retry: []
  select: [status: string]
}>()

const stats = computed<DefectSummaryCard[]>(() => {
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
    { label: '缺陷总数', value: source.total, description: '全部缺陷', status: '', tone: 'primary' },
    { label: '待处理', value: source.assigned, description: '已指派待处理', status: 'ASSIGNED', tone: 'assigned' },
    { label: '处理中', value: source.inProgress, description: '正在处理中', status: 'IN_PROGRESS', tone: 'processing' },
    { label: '待验证', value: source.pendingVerify, description: '等待验证结果', status: 'PENDING_VERIFY', tone: 'verify' },
  ]
})

function isActive(status: string) {
  if (!status) {
    return !props.activeStatus
  }

  return props.activeStatus === status
}

function handleSelect(status: string) {
  emit('select', status)
}
</script>

<template>
  <div class="defect-summary-panel">
    <article
      v-for="stat in stats"
      :key="stat.label"
      class="defect-summary-panel__card"
      :class="[
        `defect-summary-panel__card--${stat.tone}`,
        { 'defect-summary-panel__card--active': isActive(stat.status) },
      ]"
      role="button"
      tabindex="0"
      @click="handleSelect(stat.status)"
      @keydown.enter.prevent="handleSelect(stat.status)"
      @keydown.space.prevent="handleSelect(stat.status)"
    >
      <div class="defect-summary-panel__card-head">
        <span>{{ stat.label }}</span>
        <i class="defect-summary-panel__dot" aria-hidden="true" />
      </div>
      <strong>{{ stat.value }}</strong>
      <p>{{ stat.description }}</p>
    </article>

    <div v-if="errorMessage" class="defect-summary-panel__error">
      <span>{{ errorMessage }}</span>
      <AppButton size="small" :icon="RefreshRight" :disabled="loading" @click="$emit('retry')">重试</AppButton>
    </div>
  </div>
</template>

<style scoped>
.defect-summary-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.defect-summary-panel__card {
  display: grid;
  gap: 10px;
  min-height: 144px;
  padding: 20px 24px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.defect-summary-panel__card:hover {
  border-color: var(--app-border-strong);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.defect-summary-panel__card--active {
  border-color: #60a5fa;
  background: linear-gradient(180deg, #fdfefe 0%, #f3f8ff 100%);
  box-shadow:
    0 12px 28px rgba(59, 130, 246, 0.14),
    0 0 0 1px rgba(96, 165, 250, 0.16);
}

.defect-summary-panel__card--active .defect-summary-panel__card-head span,
.defect-summary-panel__card--active .defect-summary-panel__card strong {
  color: #1d4ed8;
}

.defect-summary-panel__card--active .defect-summary-panel__dot {
  transform: scale(1.08);
  box-shadow: 0 0 0 7px rgba(59, 130, 246, 0.18);
}

.defect-summary-panel__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin-bottom: 6px;
}

.defect-summary-panel__card-head span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: var(--app-line-height-sm);
}

.defect-summary-panel__card strong {
  color: var(--app-text-primary);
  font-size: 28px;
  line-height: 32px;
}

.defect-summary-panel__card p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 18px;
}

.defect-summary-panel__dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #3b82f6;
  box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.12);
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.defect-summary-panel__card--primary {
  border-color: #dbeafe;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
}

.defect-summary-panel__card--assigned .defect-summary-panel__dot {
  background: #a855f7;
  box-shadow: 0 0 0 6px rgba(168, 85, 247, 0.12);
}

.defect-summary-panel__card--processing .defect-summary-panel__dot {
  background: #22c55e;
  box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.12);
}

.defect-summary-panel__card--verify .defect-summary-panel__dot {
  background: #f97316;
  box-shadow: 0 0 0 6px rgba(249, 115, 22, 0.12);
}

.defect-summary-panel__card--success .defect-summary-panel__dot {
  background: #16a34a;
  box-shadow: 0 0 0 6px rgba(22, 163, 74, 0.12);
}

.defect-summary-panel__error {
  display: flex;
  min-height: 144px;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: 20px 24px;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .defect-summary-panel {
    grid-template-columns: 1fr;
  }
}
</style>
