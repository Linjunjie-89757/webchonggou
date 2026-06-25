<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Delete, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  webUiAutomationApi,
  type WebUiElementCollectTaskListItem,
} from '@/entities/web-ui-automation'
import { isCollectTaskTerminalStatus } from '@/entities/web-ui-automation/lib/collectTask'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'

const props = defineProps<{
  modelValue: boolean
  workspaceCode: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  open: [task: WebUiElementCollectTaskListItem]
  deleted: [task: WebUiElementCollectTaskListItem]
}>()

const loading = ref(false)
const deletingId = ref<number | null>(null)
const tasks = ref<WebUiElementCollectTaskListItem[]>([])
const total = ref(0)
const query = reactive({
  keyword: '',
  status: '',
  pageNo: 1,
  pageSize: 10,
})

const statusOptions = [
  { label: '处理中', value: 'PROCESSING' },
  { label: '等待本地验证', value: 'WAITING_LOCAL_VALIDATION' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已降级', value: 'DEGRADED' },
  { label: '已失败', value: 'FAILED' },
  { label: '已取消', value: 'CANCELED' },
]

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

watch(() => props.modelValue, (nextVisible) => {
  if (nextVisible) {
    void loadTasks()
  }
})

function formatTaskStatus(status?: string | null) {
  if (status === 'PROCESSING') return '处理中'
  if (status === 'WAITING_LOCAL_VALIDATION') return '等待本地验证'
  if (status === 'COMPLETED') return '已完成'
  if (status === 'DEGRADED') return '已降级'
  if (status === 'FAILED') return '已失败'
  if (status === 'CANCELED') return '已取消'
  return status || '未知'
}

function getTaskStatusType(status?: string | null) {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'DEGRADED') return 'warning'
  if (status === 'CANCELED') return 'info'
  return 'primary'
}

function formatTaskTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatTaskTitle(task: WebUiElementCollectTaskListItem) {
  return task.pageTitle || task.pageName || task.actualUrl || `采集任务 #${task.taskId}`
}

async function loadTasks() {
  loading.value = true
  try {
    const page = await webUiAutomationApi.listLocalRunnerCollectTasks(props.workspaceCode || 'ALL', {
      keyword: query.keyword,
      status: query.status,
      pageNo: query.pageNo,
      pageSize: query.pageSize,
    })
    tasks.value = page.items
    total.value = page.total
  } catch (error) {
    tasks.value = []
    total.value = 0
    ElMessage.error(`采集任务加载失败：${getRequestErrorMessage(error)}`)
  } finally {
    loading.value = false
  }
}

function searchTasks() {
  query.pageNo = 1
  void loadTasks()
}

function resetTasks() {
  query.keyword = ''
  query.status = ''
  query.pageNo = 1
  void loadTasks()
}

function openTask(task: WebUiElementCollectTaskListItem) {
  emit('open', task)
}

async function deleteTask(task: WebUiElementCollectTaskListItem) {
  if (!isCollectTaskTerminalStatus(task.status)) {
    ElMessage.warning('采集任务仍在处理中，请先取消任务后再删除。')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定删除采集任务 #${task.taskId} 吗？删除后无法从任务列表打开该历史任务。`,
      '删除采集任务',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  deletingId.value = task.taskId
  try {
    await webUiAutomationApi.deleteLocalRunnerCollectTask(props.workspaceCode || 'ALL', task.taskId)
    ElMessage.success('采集任务已删除')
    emit('deleted', task)
    if (tasks.value.length === 1 && query.pageNo > 1) {
      query.pageNo -= 1
    }
    await loadTasks()
  } catch (error) {
    ElMessage.error(`采集任务删除失败：${getRequestErrorMessage(error)}`)
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <el-drawer
    v-model="visible"
    title="采集任务"
    size="860px"
    append-to-body
    destroy-on-close
  >
    <section class="web-ui-collect-task-list">
      <div class="web-ui-collect-task-list__filters">
        <el-input
          v-model="query.keyword"
          class="web-ui-collect-task-list__keyword"
          clearable
          placeholder="搜索页面标题、URL、页面对象或任务 ID"
          :prefix-icon="Search"
          @keyup.enter="searchTasks"
        />
        <el-select
          v-model="query.status"
          class="web-ui-collect-task-list__status"
          clearable
          placeholder="任务状态"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <AppButton :icon="Search" @click="searchTasks">查询</AppButton>
        <AppButton :icon="RefreshRight" @click="resetTasks">重置</AppButton>
      </div>

      <el-table
        v-loading="loading"
        :data="tasks"
        class="web-ui-collect-task-list__table"
        border
        stripe
      >
        <el-table-column label="任务" min-width="220">
          <template #default="{ row }">
            <button class="web-ui-collect-task-list__title" type="button" @click="openTask(row)">
              <strong>{{ formatTaskTitle(row) }}</strong>
              <small>#{{ row.taskId }} / {{ row.actualUrl || '-' }}</small>
            </button>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="132">
          <template #default="{ row }">
            <el-tag :type="getTaskStatusType(row.status)" effect="light">
              {{ formatTaskStatus(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="候选" width="112">
          <template #default="{ row }">
            {{ row.finalCount }} / {{ row.rawCount }}
          </template>
        </el-table-column>
        <el-table-column label="页面对象" min-width="132">
          <template #default="{ row }">
            {{ row.pageName || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTaskTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openTask(row)">打开</el-button>
            <el-button
              link
              type="danger"
              :icon="Delete"
              :loading="deletingId === row.taskId"
              :disabled="!isCollectTaskTerminalStatus(row.status)"
              @click="deleteTask(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <AppEmptyState
            title="暂无采集任务"
            description="完成一次 AI 采集后，任务会出现在这里。可以按状态、页面标题或任务 ID 查找历史任务。"
          />
        </template>
      </el-table>

      <div class="web-ui-collect-task-list__footer">
        <span class="web-ui-collect-task-list__hint">处理中任务需要先取消，完成、失败、取消或降级后的任务可以删除。</span>
        <el-pagination
          v-model:current-page="query.pageNo"
          v-model:page-size="query.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="loadTasks"
          @size-change="searchTasks"
        />
      </div>
    </section>
  </el-drawer>
</template>

<style scoped>
.web-ui-collect-task-list {
  display: grid;
  gap: var(--app-space-4);
}

.web-ui-collect-task-list__filters,
.web-ui-collect-task-list__footer {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  flex-wrap: wrap;
}

.web-ui-collect-task-list__filters {
  justify-content: flex-start;
}

.web-ui-collect-task-list__footer {
  justify-content: space-between;
}

.web-ui-collect-task-list__keyword {
  flex: 1 1 320px;
  max-width: 420px;
}

.web-ui-collect-task-list__status {
  width: 168px;
}

.web-ui-collect-task-list__table {
  width: 100%;
}

.web-ui-collect-task-list__title {
  display: grid;
  gap: var(--app-space-1);
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-text-primary);
  cursor: pointer;
  text-align: left;
}

.web-ui-collect-task-list__title:hover strong {
  color: var(--el-color-primary);
}

.web-ui-collect-task-list__title strong,
.web-ui-collect-task-list__title small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-collect-task-list__title small,
.web-ui-collect-task-list__hint {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}
</style>
