<script setup lang="ts">
import { Bell, Brush, Cpu, Lock, Setting, User } from '@element-plus/icons-vue'

export type SettingsTab = 'aiConnection' | 'workspace' | 'team' | 'rolePermission' | 'notify' | 'security' | 'appearance'

defineProps<{
  activeTab: SettingsTab
}>()

const emit = defineEmits<{
  'update:activeTab': [tab: SettingsTab]
}>()

const settingsTabs: Array<{
  id: SettingsTab
  label: string
  description: string
  icon: typeof Cpu
}> = [
  { id: 'aiConnection', label: 'AI 连接池', description: '查看模型服务连接', icon: Cpu },
  { id: 'workspace', label: '工作空间', description: '查看空间与成员概览', icon: Setting },
  { id: 'team', label: '用户管理', description: '查看平台用户账号', icon: User },
  { id: 'rolePermission', label: '角色权限', description: '权限能力占位', icon: Lock },
  { id: 'notify', label: '通知设置', description: '消息推送占位', icon: Bell },
  { id: 'security', label: '安全设置', description: '访问安全占位', icon: Lock },
  { id: 'appearance', label: '外观设置', description: '主题偏好占位', icon: Brush },
]
</script>

<template>
  <aside class="settings-sidebar" aria-label="系统设置分类">
    <button
      v-for="item in settingsTabs"
      :key="item.id"
      type="button"
      class="settings-sidebar__item"
      :class="{ 'is-active': activeTab === item.id }"
      @click="emit('update:activeTab', item.id)"
    >
      <el-icon class="settings-sidebar__icon">
        <component :is="item.icon" />
      </el-icon>
      <span class="settings-sidebar__text">
        <strong>{{ item.label }}</strong>
        <small>{{ item.description }}</small>
      </span>
    </button>
  </aside>
</template>

<style scoped>
.settings-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  width: 224px;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.settings-sidebar__item {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 0;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background-color 160ms ease, color 160ms ease;
}

.settings-sidebar__item:hover {
  background: var(--app-bg-muted);
  color: var(--app-text-primary);
}

.settings-sidebar__item.is-active {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.settings-sidebar__icon {
  flex: 0 0 auto;
  margin-top: 1px;
  font-size: 17px;
}

.settings-sidebar__text {
  min-width: 0;
}

.settings-sidebar strong {
  display: block;
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.settings-sidebar small {
  display: block;
  margin-top: 2px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.settings-sidebar__item.is-active small {
  color: var(--app-primary-hover);
}

@media (max-width: 900px) {
  .settings-sidebar {
    width: 100%;
  }
}
</style>
