<script setup lang="ts">
type StatusTone = 'default' | 'success' | 'warning' | 'danger' | 'primary' | 'purple'

withDefaults(
  defineProps<{
    label: string
    tone?: StatusTone
  }>(),
  {
    tone: 'default',
  },
)
</script>

<template>
  <span class="app-status-badge" :class="`app-status-badge--${tone}`">
    {{ label }}
  </span>
</template>

<style scoped>
.app-status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 var(--app-space-2);
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: var(--app-line-height-xs);
  white-space: nowrap;
}

.app-status-badge--success {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.app-status-badge--warning {
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.app-status-badge--danger {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.app-status-badge--primary {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.app-status-badge--purple {
  background: var(--app-purple-soft);
  color: var(--app-purple);
}
</style>
