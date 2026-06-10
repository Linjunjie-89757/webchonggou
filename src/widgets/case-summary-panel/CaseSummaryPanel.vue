<script setup lang="ts">
import { computed } from 'vue'

import type { CaseStat, CaseSummaryItem } from '@/entities/case'
import { ConfigStatCard } from '@/entities/config'

const props = defineProps<{
  cases: CaseSummaryItem[]
}>()

const stats = computed<CaseStat[]>(() => [
  { label: '当前页用例', value: props.cases.length, tone: 'primary' },
  { label: '未评审', value: props.cases.filter((item) => item.reviewStatus === 'PENDING').length },
  { label: '已通过', value: props.cases.filter((item) => item.reviewStatus === 'PASSED').length, tone: 'success' },
  { label: '执行失败', value: props.cases.filter((item) => item.executionStatus === 'FAILED').length, tone: 'danger' },
])
</script>

<template>
  <div class="case-summary-panel">
    <ConfigStatCard v-for="stat in stats" :key="stat.label" :stat="stat" />
  </div>
</template>

<style scoped>
.case-summary-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-4);
}

@media (max-width: 1100px) {
  .case-summary-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .case-summary-panel {
    grid-template-columns: 1fr;
  }
}
</style>
