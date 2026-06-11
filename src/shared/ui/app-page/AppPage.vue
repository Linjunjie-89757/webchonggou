<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  fill?: boolean
}>()
</script>

<template>
  <section class="app-page" :class="{ 'app-page--fill': fill }">
    <div class="app-page__content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.app-page {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.app-page--fill {
  min-height: calc(100dvh - 64px - var(--app-space-6) * 2);
}

.app-page__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-5);
}

.app-page--fill .app-page__content {
  flex: 1;
  min-height: 0;
}
</style>
