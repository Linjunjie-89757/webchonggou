<script setup lang="ts">
import { computed } from 'vue'

import { getAutomationTaskStatusOption } from '../model/options'

const props = defineProps<{
  status?: string | null
}>()

const option = computed(() => getAutomationTaskStatusOption(props.status))
const tone = computed(() => option.value?.tone || 'default')
const label = computed(() => option.value?.label || props.status || '-')
</script>

<template>
  <span class="automation-task-status-badge" :class="`is-${tone}`">{{ label }}</span>
</template>

<style scoped>
.automation-task-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  height: 22px;
  padding: 0 var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
}

.automation-task-status-badge.is-primary {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.automation-task-status-badge.is-success {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success);
}

.automation-task-status-badge.is-warning {
  border-color: #fed7aa;
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.automation-task-status-badge.is-danger {
  border-color: #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}
</style>
