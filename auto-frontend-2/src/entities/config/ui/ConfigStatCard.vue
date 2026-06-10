<script setup lang="ts">
import type { ConfigStat } from '../model/types'

defineProps<{
  stat: ConfigStat
}>()
</script>

<template>
  <article class="config-stat-card" :class="`config-stat-card--${stat.tone ?? 'default'}`">
    <span>{{ stat.label }}</span>
    <strong>{{ stat.value }}</strong>
  </article>
</template>

<style scoped>
.config-stat-card {
  display: flex;
  min-height: 84px;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.config-stat-card span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.config-stat-card strong {
  color: var(--app-text-primary);
  font-size: 24px;
  line-height: 30px;
}

.config-stat-card--primary {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
}

.config-stat-card--success {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
}

.config-stat-card--warning {
  border-color: #fed7aa;
  background: var(--app-warning-soft);
}

.config-stat-card--danger {
  border-color: #fecaca;
  background: var(--app-danger-soft);
}

.config-stat-card--purple {
  border-color: #e9d5ff;
  background: var(--app-purple-soft);
}
</style>
