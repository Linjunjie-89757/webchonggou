<script setup lang="ts">
defineProps<{
  label: string
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
}>()
</script>

<template>
  <span class="config-type-badge" :class="`config-type-badge--${tone ?? 'default'}`">
    {{ label }}
  </span>
</template>

<style scoped>
.config-type-badge {
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

.config-type-badge--primary {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.config-type-badge--success {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success);
}

.config-type-badge--warning {
  border-color: #fed7aa;
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.config-type-badge--danger {
  border-color: #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.config-type-badge--purple {
  border-color: #e9d5ff;
  background: var(--app-purple-soft);
  color: var(--app-purple);
}
</style>
