<script setup lang="ts">
import { computed } from 'vue'

import { getCaseExecutionStatusMeta } from '../lib/format'

const props = defineProps<{
  status: string
}>()

const meta = computed(() => getCaseExecutionStatusMeta(props.status))
</script>

<template>
  <span class="case-badge" :class="`case-badge--${meta.tone}`">
    {{ meta.label }}
  </span>
</template>

<style scoped>
.case-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  white-space: nowrap;
}

.case-badge--primary {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.case-badge--success {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success);
}

.case-badge--danger {
  border-color: #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}
</style>
