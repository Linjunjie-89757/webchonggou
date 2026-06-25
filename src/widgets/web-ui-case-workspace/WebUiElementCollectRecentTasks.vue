<script setup lang="ts">
import { Clock, Close } from '@element-plus/icons-vue'

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
  remove: [task: WebUiElementCollectRecentTask]
  clear: []
  all: []
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
    width="380"
    trigger="click"
    popper-class="web-ui-collect-recent-popover"
  >
    <template #reference>
      <AppButton :icon="Clock">采集任务</AppButton>
    </template>

    <section class="web-ui-collect-recent">
      <header class="web-ui-collect-recent__header">
        <strong>最近采集任务</strong>
        <div class="web-ui-collect-recent__actions">
          <el-button link type="primary" @click="emit('all')">查看全部</el-button>
          <el-button v-if="tasks.length" link type="primary" @click="emit('clear')">清空</el-button>
        </div>
      </header>

      <div v-if="tasks.length" class="web-ui-collect-recent__list">
        <div
          v-for="task in tasks"
          :key="`${task.workspaceCode}-${task.taskId}`"
          class="web-ui-collect-recent__item"
        >
          <button class="web-ui-collect-recent__main" type="button" @click="emit('open', task)">
            <span>
              <strong>{{ task.title }}</strong>
              <small>#{{ task.taskId }} / {{ task.workspaceCode }}</small>
            </span>
            <small>{{ formatTaskTime(task.createdAt) }}</small>
          </button>
          <el-button
            class="web-ui-collect-recent__remove"
            text
            :icon="Close"
            title="移除这条最近任务"
            @click.stop="emit('remove', task)"
          />
        </div>
      </div>
      <div v-else class="web-ui-collect-recent__empty">
        <p>暂无最近采集任务</p>
        <small>采集完成后会出现在这里，也可以查看全部历史任务。</small>
      </div>
      <button v-if="!tasks.length" class="web-ui-collect-recent__all" type="button" @click="emit('all')">
        查看全部采集任务
      </button>
    </section>
  </el-popover>
</template>

<style scoped>
.web-ui-collect-recent {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-collect-recent__header,
.web-ui-collect-recent__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.web-ui-collect-recent__actions {
  justify-content: flex-end;
}

.web-ui-collect-recent__list {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-collect-recent__item {
  display: flex;
  align-items: center;
  gap: var(--app-space-1);
  width: 100%;
  padding: var(--app-space-2);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-card);
}

.web-ui-collect-recent__item:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--app-bg-soft);
}

.web-ui-collect-recent__main,
.web-ui-collect-recent__all {
  border: 0;
  background: transparent;
  color: var(--app-text-primary);
  cursor: pointer;
}

.web-ui-collect-recent__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-width: 0;
  flex: 1;
  padding: 0;
  text-align: left;
}

.web-ui-collect-recent__main span {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-collect-recent__main strong,
.web-ui-collect-recent__main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-collect-recent__main:hover strong,
.web-ui-collect-recent__all:hover {
  color: var(--el-color-primary);
}

.web-ui-collect-recent__remove {
  flex: 0 0 auto;
}

.web-ui-collect-recent__empty {
  display: grid;
  gap: var(--app-space-1);
  padding: var(--app-space-3);
  border: 1px dashed var(--app-border-color);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-soft);
}

.web-ui-collect-recent__empty p {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-recent__main small,
.web-ui-collect-recent__empty small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-collect-recent__all {
  justify-self: start;
  padding: 0;
  font-size: var(--app-font-size-sm);
}
</style>
