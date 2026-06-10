<script setup lang="ts">
import { computed } from 'vue'

import { getDefectStatusMeta } from '../lib/format'

const props = defineProps<{
  status: string
}>()

const meta = computed(() => getDefectStatusMeta(props.status))
</script>

<template>
  <span class="defect-badge" :class="`defect-badge--${meta.tone}`">
    {{ meta.label }}
  </span>
</template>

<style scoped>
.defect-badge {
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

.defect-badge--primary {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.defect-badge--success {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success);
}

.defect-badge--warning {
  border-color: #fed7aa;
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.defect-badge--danger {
  border-color: #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}
</style>
