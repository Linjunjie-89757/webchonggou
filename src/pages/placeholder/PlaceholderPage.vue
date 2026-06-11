<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import AppSection from '@/shared/ui/app-section/AppSection.vue'

const route = useRoute()

const title = computed(() => String(route.meta.title ?? '页面建设中'))
const description = computed(() =>
  String(route.meta.description ?? '当前页面将在后续迁移阶段按确认后的拆分方案实现。'),
)
</script>

<template>
  <main v-if="route.meta.bare" class="placeholder-login">
    <AppEmptyState :title="title" :description="description" />
  </main>

  <AppPage v-else :title="title" :description="description" fill>
    <AppSection class="placeholder-page-section">
      <AppEmptyState title="页面建设中..." :description="description" />
    </AppSection>
  </AppPage>
</template>

<style scoped>
.placeholder-login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: var(--app-space-6);
  background: var(--app-bg-page);
}

.placeholder-page-section {
  flex: 1;
  justify-content: center;
}
</style>
