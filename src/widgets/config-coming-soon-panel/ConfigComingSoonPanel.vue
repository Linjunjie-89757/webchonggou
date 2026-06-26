<script setup lang="ts">
defineProps<{
  title: string
  description: string
  items: string[]
}>()
</script>

<template>
  <section class="config-coming-soon-panel">
    <div class="config-coming-soon-panel__head">
      <span>规划中</span>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>

    <div class="config-coming-soon-panel__grid">
      <div v-for="item in items" :key="item" class="config-coming-soon-panel__item">
        <strong>{{ item }}</strong>
        <small>后续目标包接入真实数据与操作闭环。</small>
      </div>
    </div>
  </section>
</template>

<style scoped>
.config-coming-soon-panel {
  display: flex;
  min-height: 360px;
  flex-direction: column;
  gap: var(--app-space-5);
}

.config-coming-soon-panel__head {
  max-width: 760px;
}

.config-coming-soon-panel__head span {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: var(--app-radius-sm);
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.config-coming-soon-panel__head h2 {
  margin: var(--app-space-3) 0 var(--app-space-2);
  color: var(--app-text-primary);
  font-size: 22px;
  line-height: 1.3;
}

.config-coming-soon-panel__head p {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-md);
  line-height: 1.7;
}

.config-coming-soon-panel__grid {
  display: grid;
  gap: var(--app-space-3);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.config-coming-soon-panel__item {
  min-height: 112px;
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.config-coming-soon-panel__item strong {
  display: block;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.config-coming-soon-panel__item small {
  display: block;
  margin-top: var(--app-space-2);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: 1.6;
}
</style>
