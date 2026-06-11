<script setup lang="ts">
import { computed } from 'vue'

import { formatAutomationTaskEngine } from '../lib/format'

const props = defineProps<{
  engineType?: string | null
}>()

const label = computed(() => formatAutomationTaskEngine(props.engineType))
</script>

<template>
  <span class="automation-task-engine-badge">{{ label }}</span>
</template>

<style scoped>
.automation-task-engine-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  height: 22px;
  padding: 0 var(--app-space-2);
  border: 1px solid #c7d2fe;
  border-radius: var(--app-radius-sm);
  background: #eef2ff;
  color: #4338ca;
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
}
</style>
