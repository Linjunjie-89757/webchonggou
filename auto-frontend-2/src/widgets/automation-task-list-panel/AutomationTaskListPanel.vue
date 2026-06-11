<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'

import {
  AutomationTaskEngineBadge,
  AutomationTaskStatusBadge,
  automationTaskApi,
  formatAutomationTaskSummary,
  type AutomationTaskClientFilter,
  type AutomationTaskEngineType,
  type AutomationTaskSummaryItem,
} from '@/entities/automation-task'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    engineType: AutomationTaskEngineType
    filter: AutomationTaskClientFilter
  }>(),
  {
    workspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  loaded: [items: AutomationTaskSummaryItem[]]
}>()

const tasks = ref<AutomationTaskSummaryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(10)
const totalPages = ref(0)
let loadRequestSeq = 0

function normalizePageNo() {
  if (totalPages.value > 0 && pageNo.value > totalPages.value) {
    pageNo.value = totalPages.value
  }
}

function getClientTotalPages(totalCount: number) {
  return totalCount > 0 ? Math.ceil(totalCount / Math.max(pageSize.value, 1)) : 0
}

function reloadFromFirstPage() {
  if (pageNo.value === 1) {
    void loadTasks()
    return
  }

  pageNo.value = 1
}

async function loadTasks() {
  const requestSeq = ++loadRequestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await automationTaskApi.getTasks(props.workspaceCode, {
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      keyword: props.filter.keyword,
      status: props.filter.status,
      engineType: props.engineType,
    })
    if (requestSeq === loadRequestSeq) {
      tasks.value = Array.isArray(page.items) ? page.items : []
      total.value = page.total
      pageNo.value = page.pageNo || pageNo.value
      totalPages.value = getClientTotalPages(page.total)
      emit('loaded', tasks.value)
    }
  } catch (error) {
    if (requestSeq === loadRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === loadRequestSeq) {
      loading.value = false
    }
  }
}

watch(
  () => [props.workspaceCode, props.engineType] as const,
  () => {
    reloadFromFirstPage()
  },
)

watch(
  () => props.filter,
  () => {
    reloadFromFirstPage()
  },
  { deep: true },
)

watch(pageNo, (value, oldValue) => {
  if (value !== oldValue) {
    void loadTasks()
  }
})

watch(pageSize, (value, oldValue) => {
  if (value !== oldValue) {
    reloadFromFirstPage()
  }
})

watch(totalPages, normalizePageNo)

onMounted(() => {
  void loadTasks()
})

defineExpose({
  reload: loadTasks,
})
</script>

<template>
  <section class="automation-task-list-panel">
    <AppLoadingState v-if="loading && !tasks.length" text="正在加载自动化任务..." />

    <AppEmptyState
      v-else-if="errorMessage && !tasks.length"
      title="任务加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadTasks">重试</AppButton>
      </template>
    </AppEmptyState>

    <div v-else class="automation-task-list-panel__card">
      <div v-if="errorMessage" class="automation-task-list-panel__inline-error">
        <span>{{ errorMessage }}</span>
        <AppButton size="small" :icon="RefreshRight" @click="loadTasks">重试</AppButton>
      </div>

      <div class="automation-task-list-panel__toolbar">
        <div>
          <strong>任务列表</strong>
          <span>共 {{ total }} 条</span>
        </div>
      </div>

      <div class="automation-task-list-panel__table-wrap">
        <el-table
          v-loading="loading"
          :data="tasks"
          class="automation-task-list-panel__table"
          size="small"
          row-key="id"
        >
          <el-table-column prop="taskName" label="任务名称" min-width="220" fixed="left" show-overflow-tooltip>
            <template #default="{ row }: { row: AutomationTaskSummaryItem }">
              <span class="automation-task-list-panel__title">{{ row.taskName || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="engineType" label="执行引擎" width="104">
            <template #default="{ row }: { row: AutomationTaskSummaryItem }">
              <AutomationTaskEngineBadge :engine-type="row.engineType" />
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="104">
            <template #default="{ row }: { row: AutomationTaskSummaryItem }">
              <AutomationTaskStatusBadge :status="row.status" />
            </template>
          </el-table-column>
          <el-table-column prop="summary" label="摘要" min-width="240" show-overflow-tooltip>
            <template #default="{ row }: { row: AutomationTaskSummaryItem }">
              {{ formatAutomationTaskSummary(row.summary) }}
            </template>
          </el-table-column>
          <el-table-column prop="workspaceName" label="所属空间" min-width="136" show-overflow-tooltip>
            <template #default="{ row }: { row: AutomationTaskSummaryItem }">
              {{ row.workspaceName || row.workspaceCode || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default>
              <div class="automation-task-list-panel__actions">
                <AppButton size="small" disabled>详情</AppButton>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <AppEmptyState
        v-if="!loading && !tasks.length && !errorMessage"
        title="暂无匹配任务"
        description="当前工作空间或筛选条件下没有可展示的自动化任务。"
      />

      <div v-if="tasks.length || total > 0" class="automation-task-list-panel__pagination">
        <span>共 {{ total }} 条 / {{ totalPages }} 页</span>
        <el-pagination
          v-model:current-page="pageNo"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 30, 50]"
          :total="total"
          size="small"
          layout="sizes, prev, pager, next, jumper"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.automation-task-list-panel {
  min-width: 0;
}

.automation-task-list-panel__card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
}

.automation-task-list-panel__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.automation-task-list-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.automation-task-list-panel__toolbar > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.automation-task-list-panel__toolbar strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.automation-task-list-panel__toolbar span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.automation-task-list-panel__table-wrap {
  min-width: 0;
  overflow-x: auto;
}

.automation-task-list-panel__table {
  min-width: 880px;
}

.automation-task-list-panel__title {
  color: var(--app-text-primary);
  font-weight: 600;
}

.automation-task-list-panel__actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-1);
  white-space: nowrap;
}

.automation-task-list-panel__pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding-top: var(--app-space-3);
  border-top: 1px solid var(--app-border-soft);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}
</style>
