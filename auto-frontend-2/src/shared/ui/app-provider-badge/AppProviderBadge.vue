<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    tone?: 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'default'
  }>(),
  {
    tone: 'default',
  },
)
</script>

<template>
  <span class="app-provider-badge" :class="`app-provider-badge--${tone}`">
    <span class="app-provider-badge__mark">{{ label.slice(0, 1).toUpperCase() }}</span>
    <span>{{ label }}</span>
  </span>
</template>

<style scoped>
.app-provider-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-1);
  min-height: 26px;
  padding: 0 var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  white-space: nowrap;
}

.app-provider-badge__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: 10px;
  line-height: 16px;
}

.app-provider-badge--primary {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.app-provider-badge--success {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success);
}

.app-provider-badge--warning {
  border-color: #fed7aa;
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.app-provider-badge--danger {
  border-color: #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.app-provider-badge--purple {
  border-color: #e9d5ff;
  background: var(--app-purple-soft);
  color: var(--app-purple);
}
</style>
