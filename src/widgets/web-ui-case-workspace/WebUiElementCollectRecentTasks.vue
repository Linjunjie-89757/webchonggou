<script setup lang="ts">
import { Clock } from '@element-plus/icons-vue'

import AppButton from '@/shared/ui/app-button/AppButton.vue'

export interface WebUiElementCollectRecentTask {
  taskId: number
  workspaceCode: string
  moduleId: number | null
  pageId: number | null
  pageName: string | null
  pageUrl: string | null
  groupStrategy: 'AI' | 'CUSTOM'
  groupName: string | null
  title: string
  createdAt: string
}

defineProps<{
  tasks: WebUiElementCollectRecentTask[]
}>()

const emit = defineEmits<{
  open: [task: WebUiElementCollectRecentTask]
  clear: []
}>()

function formatTaskTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
</script>

<template>
  <el-popover
    placement="bottom-end"
    width="360"
    trigger="click"
    popper-class="web-ui-collect-recent-popover"
  >
    <template #reference>
      <AppButton :icon="Clock">采集任务</AppButton>
    </template>

    <section class="web-ui-collect-recent">
      <header class="web-ui-collect-recent__header">
        <strong>最近采集任务</strong>
        <el-button v-if="tasks.length" link type="primary" @click="emit('clear')">清空</el-button>
      </header>

      <div v-if="tasks.length" class="web-ui-collect-recent__list">
        <button
          v-for="task in tasks"
          :key="`${task.workspaceCode}-${task.taskId}`"
          class="web-ui-collect-recent__item"
          type="button"
          @click="emit('open', task)"
        >
          <span>
            <strong>{{ task.title }}</strong>
            <small>#{{ task.taskId }} / {{ task.workspaceCode }}</small>
          </span>
          <small>{{ formatTaskTime(task.createdAt) }}</small>
        </button>
      </div>
      <div v-else class="web-ui-collect-recent__empty">
        暂无最近采集任务
      </div>
    </section>
  </el-popover>
</template>

<style scoped>
.web-ui-collect-recent {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-collect-recent__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.web-ui-collect-recent__list {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-collect-recent__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
  width: 100%;
  padding: var(--app-space-2);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-card);
  color: var(--app-text-primary);
  cursor: pointer;
  text-align: left;
}

.web-ui-collect-recent__item:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--app-bg-soft);
}

.web-ui-collect-recent__item span {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-collect-recent__item small,
.web-ui-collect-recent__empty {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}
</style>
