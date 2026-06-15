<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const activeTab = computed({
  get() {
    if (route.path.startsWith('/cases/ai-generate')) {
      return 'ai-generate'
    }
    if (route.path.startsWith('/cases/ai-records')) {
      return 'ai-records'
    }
    if (route.path.startsWith('/cases/ai-config')) {
      return 'ai-config'
    }
    return 'manage'
  },
  set(value: string) {
    const pathMap: Record<string, string> = {
      manage: '/cases/manage',
      'ai-generate': '/cases/ai-generate',
      'ai-records': '/cases/ai-records',
      'ai-config': '/cases/ai-config',
    }

    void router.replace({
      path: pathMap[value] ?? '/cases/manage',
      query: route.query,
      hash: route.hash,
    })
  },
})
</script>

<template>
  <section class="case-center-page">
    <div class="case-center-page__tabs">
      <el-tabs v-model="activeTab" class="case-center-page__tab-nav">
        <el-tab-pane label="用例管理" name="manage" />
        <el-tab-pane label="AI 用例生成" name="ai-generate" />
        <el-tab-pane label="AI 生成记录" name="ai-records" />
        <el-tab-pane label="AI 配置" name="ai-config" />
      </el-tabs>
    </div>

    <div
      class="case-center-page__content"
      :class="{ 'case-center-page__content--auto-height': activeTab === 'ai-config' }"
    >
      <RouterView />
    </div>
  </section>
</template>

<style scoped>
.case-center-page {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.case-center-page__tabs {
  display: flex;
  flex: 0 0 48px;
  align-items: center;
  min-width: 0;
  padding: 0 var(--app-space-6);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.case-center-page__tab-nav {
  --el-color-primary: var(--app-text-primary);
  display: inline-flex;
  flex: 0 0 auto;
  min-width: 0;
  padding: 4px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
}

.case-center-page__tab-nav :deep(.el-tabs__header) {
  margin: 0;
}

.case-center-page__tab-nav :deep(.el-tabs__nav-wrap) {
  min-height: 32px;
}

.case-center-page__tab-nav :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.case-center-page__tab-nav :deep(.el-tabs__active-bar) {
  display: none;
}

.case-center-page__tab-nav :deep(.el-tabs__nav) {
  gap: 2px;
}

.case-center-page__tab-nav :deep(.el-tabs__nav-scroll) {
  overflow: visible;
}

.case-center-page__tab-nav :deep(.el-tabs__item) {
  height: 32px;
  padding: 0 16px !important;
  border: 0;
  border-radius: var(--app-radius-sm);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-md);
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}

.case-center-page__tab-nav :deep(.el-tabs__item:hover) {
  color: var(--app-text-secondary);
}

.case-center-page__tab-nav :deep(.el-tabs__item.is-active) {
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.case-center-page__content {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
  padding: var(--app-space-6);
}

.case-center-page__content > :deep(*) {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.case-center-page__content--auto-height > :deep(*) {
  min-height: auto;
}
</style>
