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
    description="管理平台级 AI 连接、工作空间与用户账号。当前阶段先完成只读闭环，写操作在后续目标逐步接入。"
  >
    <div class="system-settings-page">
      <SettingsSidebar v-model:active-tab="activeTab" />

      <main class="system-settings-page__content">
        <AiConnectionPoolPanel v-if="activeTab === 'aiConnection'" />
        <WorkspaceSettingsPanel v-else-if="activeTab === 'workspace' || activeTab === 'team'" />
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
  align-items: flex-start;
  gap: var(--app-space-5);
}

.system-settings-page__content {
  min-width: 0;
  flex: 1;
  padding: var(--app-space-6);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
}

@media (max-width: 900px) {
  .system-settings-page {
    flex-direction: column;
  }

  .system-settings-page__content {
    width: 100%;
    padding: var(--app-space-4);
  }
}
</style>
