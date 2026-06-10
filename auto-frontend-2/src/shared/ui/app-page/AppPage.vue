<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section class="app-page">
    <header class="app-page__header">
      <div>
        <h1 class="app-page__title">{{ title }}</h1>
        <p v-if="description" class="app-page__description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="app-page__actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="app-page__content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.app-page {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

.app-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.app-page__title {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-page-title);
  font-weight: 700;
  line-height: 28px;
}

.app-page__description {
  max-width: 760px;
  margin: var(--app-space-2) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.app-page__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.app-page__content {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

@media (max-width: 720px) {
  .app-page__header {
    flex-direction: column;
  }

  .app-page__actions {
    justify-content: flex-start;
  }
}
</style>
