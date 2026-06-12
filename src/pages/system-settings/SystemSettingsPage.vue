<script setup lang="ts">
import { computed, ref } from 'vue'

import AppPage from '@/shared/ui/app-page/AppPage.vue'
import { AiConnectionPoolPanel } from '@/widgets/ai-connection-pool'
import { SettingsPlaceholderPanel } from '@/widgets/settings-placeholder-panel'
import { SettingsSidebar, type SettingsTab } from '@/widgets/settings-sidebar'
import { WorkspaceSettingsPanel } from '@/widgets/workspace-settings-panel'

const activeTab = ref<SettingsTab>('aiConnection')

const placeholderMeta = computed(() => {
  const meta: Record<Exclude<SettingsTab, 'aiConnection' | 'workspace' | 'team'>, {
    title: string
    description: string
  }> = {
    rolePermission: {
      title: '角色权限暂未接入',
      description: '后端当前没有独立角色权限 Controller，后续确认权限模型后再接入真实能力。',
    },
    notify: {
      title: '通知设置暂未接入',
      description: '消息推送与告警规则会在后续目标中按真实接口拆分。',
    },
    security: {
      title: '安全设置暂未接入',
      description: '密钥、访问控制和登录安全配置暂保留统一占位态。',
    },
    appearance: {
      title: '外观设置暂未接入',
      description: '主题、显示密度和个人偏好后续确认边界后再接入。',
    },
  }

  return meta[activeTab.value as keyof typeof meta]
})
</script>

<template>
  <AppPage
    title="系统设置"
    description="管理平台级 AI 连接、工作空间、成员与用户账号，未接入的设置分类保持占位。"
    fill
  >
    <div class="system-settings-page">
      <SettingsSidebar v-model:active-tab="activeTab" />

      <main class="system-settings-page__content">
        <AiConnectionPoolPanel v-if="activeTab === 'aiConnection'" />
        <WorkspaceSettingsPanel
          v-else-if="activeTab === 'workspace' || activeTab === 'team'"
          :mode="activeTab === 'team' ? 'team' : 'workspace'"
        />
        <SettingsPlaceholderPanel
          v-else
          :title="placeholderMeta?.title || '设置项暂未接入'"
          :description="placeholderMeta?.description"
        />
      </main>
    </div>
  </AppPage>
</template>

<style scoped>
.system-settings-page {
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: stretch;
  overflow: hidden;
  background: var(--app-bg-page);
}

.system-settings-page__content {
  min-width: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 28px 32px;
  background: var(--app-bg-page);
  scrollbar-width: none;
}

.system-settings-page__content::-webkit-scrollbar {
  display: none;
}

.system-settings-page__content :deep(.settings-panel-header.settings-panel-header) {
  display: flex;
  min-height: 64px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--app-border-soft);
}

.system-settings-page__content :deep(.settings-panel-header h2) {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
}

.system-settings-page__content :deep(.settings-panel-header p) {
  max-width: 720px;
  margin: 2px 0 0;
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.system-settings-page__content :deep(.settings-panel-header__actions.settings-panel-header__actions) {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.system-settings-page__content :deep(.settings-panel-header__actions .el-button.app-button) {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

@media (max-width: 900px) {
  .system-settings-page {
    flex-direction: column;
    overflow: visible;
  }

  .system-settings-page__content {
    width: 100%;
    overflow: visible;
    padding: var(--app-space-4);
  }
}

@media (max-width: 640px) {
  .system-settings-page__content :deep(.settings-panel-header.settings-panel-header) {
    flex-direction: column;
    align-items: flex-start;
  }

  .system-settings-page__content :deep(.settings-panel-header__actions.settings-panel-header__actions) {
    justify-content: flex-start;
  }
}
</style>
