<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Checked, MoreFilled, Plus, RefreshRight, Setting, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  type CaseDetail,
  CaseExecutionStatusBadge,
  CasePriorityBadge,
  CaseReviewStatusBadge,
  caseApi,
  formatCaseDateTime,
  getCaseDirectoryText,
  type BatchUpdateCasesPayload,
  type CaseClientFilter,
  type CaseDirectoryWorkspace,
  type ReviewCasePayload,
  type CaseSummaryItem,
  type PageResponse,
} from '@/entities/case'
import { CaseBatchUpdateDialog, batchUpdateCases } from '@/features/case-batch-update'
import { CaseCreateEditDialog } from '@/features/case-create-edit'
import { deleteCase } from '@/features/case-delete'
import { CaseReviewDialog, reviewCase } from '@/features/case-review'
import { runCase } from '@/features/case-run'
import { getCaseStatusActionText, toggleCaseStatus } from '@/features/case-toggle-status'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import { CaseDetailDrawer } from '@/widgets/case-detail-drawer'
import CaseTableSettingsDrawer from './CaseTableSettingsDrawer.vue'
import {
  useCaseTableSettings,
  type CaseTableColumnDefinition,
  type CaseTableColumnKey,
} from './useCaseTableSettings'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    directoryId?: number | null
    filter: CaseClientFilter
    directories?: CaseDirectoryWorkspace[]
    showToolbar?: boolean
  }>(),
  {
    workspaceCode: 'ALL',
    directoryId: null,
    directories: () => [],
    showToolbar: true,
  },
)

const emit = defineEmits<{
  loaded: [items: CaseSummaryItem[]]
}>()

const cases = ref<CaseSummaryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(0)
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingCase = ref<CaseSummaryItem | null>(null)
const editingCaseDetail = ref<CaseDetail | null>(null)
const detailLoading = ref(false)
const saving = ref(false)
const batchDialogVisible = ref(false)
const batchSaving = ref(false)
const selectedCaseIds = ref<number[]>([])
const detailDrawerVisible = ref(false)
const detailCaseId = ref<number | null>(null)
const reviewDialogVisible = ref(false)
const reviewingCase = ref<CaseSummaryItem | null>(null)
const reviewingCaseId = ref<number | null>(null)
const runningCaseId = ref<number | null>(null)
const deletingCaseId = ref<number | null>(null)
const togglingCaseId = ref<number | null>(null)
let filterReloadTimer: number | undefined
let loadRequestSeq = 0
const pageSizeOptions = [10, 20, 30, 40, 50]

const tableColumnDefinitions = computed<CaseTableColumnDefinition[]>(() => [
  { key: 'caseNo', label: '用例编号', width: 168, required: true, defaultVisible: true },
  { key: 'title', label: '用例名称', minWidth: 320, required: true, defaultVisible: true },
  { key: 'priority', label: '优先级', width: 88, defaultVisible: true },
  { key: 'sourceType', label: '用例来源', width: 120, defaultVisible: false },
  { key: 'reviewStatus', label: '评审状态', width: 112, defaultVisible: true },
  { key: 'reviewedByName', label: '评审人', width: 110, defaultVisible: false },
  { key: 'reviewedAt', label: '评审时间', width: 156, defaultVisible: false },
  { key: 'executionStatus', label: '执行状态', width: 112, defaultVisible: true },
  { key: 'executorName', label: '执行人', width: 104, defaultVisible: true },
  { key: 'executedAt', label: '执行时间', width: 156, defaultVisible: false },
  { key: 'workspaceName', label: '所属空间', width: 128, defaultVisible: false },
  { key: 'directoryName', label: '所属模块', width: 152, defaultVisible: true },
  { key: 'createdByName', label: '创建人', width: 130, defaultVisible: false },
  { key: 'createdAt', label: '创建时间', width: 176, defaultVisible: false },
  { key: 'updatedByName', label: '更新人', width: 130, defaultVisible: false },
  { key: 'updatedAt', label: '更新时间', width: 176, defaultVisible: false },
])
const tableSettings = useCaseTableSettings({
  storageKey: 'case-list-table-settings-v1',
  columns: tableColumnDefinitions,
})
const visibleColumns = computed(() => tableSettings.visibleColumns.value)
const dataGridMinWidth = computed(() => {
  const columnWidth = visibleColumns.value.reduce((total, column) => {
    if (typeof column.width === 'number') {
      return total + column.width
    }
    if (typeof column.minWidth === 'number') {
      return total + column.minWidth
    }
    return total + 120
  }, 56)

  return `${columnWidth}px`
})
const dataGridTemplateColumns = computed(() => [
  '56px',
  ...visibleColumns.value.map((column) => {
    if (typeof column.width === 'number') {
      return `${column.width}px`
    }
    if (column.key === 'title' && typeof column.minWidth === 'number') {
      return `minmax(${column.minWidth}px, 1fr)`
    }
    if (typeof column.minWidth === 'number') {
      return `${column.minWidth}px`
    }
    return '120px'
  }),
].join(' '))

const defaultDialogWorkspaceCode = computed(() => {
  if (props.workspaceCode !== 'ALL') {
    return props.workspaceCode
  }

  return props.directories[0]?.workspaceCode || 'ALL'
})

const selectedCases = computed(() => {
  const selectedIdSet = new Set(selectedCaseIds.value)
  return cases.value.filter((item) => selectedIdSet.has(item.id))
})

const allCurrentPageSelected = computed(() => {
  return cases.value.length > 0 && cases.value.every((item) => selectedCaseIds.value.includes(item.id))
})

const currentPageSelectionIndeterminate = computed(() => {
  return selectedCases.value.length > 0 && !allCurrentPageSelected.value
})

function formatColumnValue(row: CaseSummaryItem, key: CaseTableColumnKey) {
  switch (key) {
    case 'caseNo':
      return row.caseNo || '-'
    case 'title':
      return row.title || '-'
    case 'priority':
      return row.priority || '-'
    case 'sourceType':
      return row.sourceType || '-'
    case 'reviewStatus':
      return row.reviewStatus || '-'
    case 'reviewedByName':
      return row.reviewedByName || '-'
    case 'reviewedAt':
      return formatCaseDateTime(row.reviewedAt)
    case 'executionStatus':
      return row.executionStatus || '-'
    case 'executorName':
      return row.executorName || '-'
    case 'executedAt':
      return formatCaseDateTime(row.executedAt)
    case 'workspaceName':
      return row.workspaceName || row.workspaceCode || '-'
    case 'directoryName':
      return getCaseDirectoryText(row)
    case 'createdByName':
      return row.createdByName || '-'
    case 'createdAt':
      return formatCaseDateTime(row.createdAt)
    case 'updatedByName':
      return row.updatedByName || '-'
    case 'updatedAt':
      return formatCaseDateTime(row.updatedAt)
    default:
      return '-'
  }
}

function applyPage(page: PageResponse<CaseSummaryItem>) {
  cases.value = Array.isArray(page.items) ? page.items : []
  const visibleIds = new Set(cases.value.map((item) => item.id))
  selectedCaseIds.value = selectedCaseIds.value.filter((id) => visibleIds.has(id))
  total.value = page.total
  pageNo.value = page.pageNo
  pageSize.value = page.pageSize
  totalPages.value = page.totalPages
  emit('loaded', cases.value)
}

function isCaseSelected(id: number) {
  return selectedCaseIds.value.includes(id)
}

function toggleCaseSelected(id: number, selected: boolean) {
  if (selected) {
    if (!selectedCaseIds.value.includes(id)) {
      selectedCaseIds.value = [...selectedCaseIds.value, id]
    }
    return
  }

  selectedCaseIds.value = selectedCaseIds.value.filter((item) => item !== id)
}

function toggleCurrentPageSelection(selected: boolean) {
  selectedCaseIds.value = selected ? cases.value.map((item) => item.id) : []
}

function clearSelection() {
  selectedCaseIds.value = []
}

function openBatchDialog() {
  if (!selectedCaseIds.value.length) {
    return
  }

  batchDialogVisible.value = true
}

async function loadCases() {
  const requestSeq = ++loadRequestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await caseApi.getCases(props.workspaceCode, {
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      directoryId: props.directoryId,
      keyword: props.filter.keyword,
      priority: props.filter.priority,
      reviewStatus: props.filter.reviewStatus,
      executionStatus: props.filter.executionStatus,
    })
    if (requestSeq === loadRequestSeq) {
      const filteredItems = page.items.filter((item) => {
        if (props.filter.executorName && item.executorName !== props.filter.executorName) {
          return false
        }
        if (props.filter.createdByName && item.createdByName !== props.filter.createdByName) {
          return false
        }
        if (props.filter.workspaceCode && item.workspaceCode !== props.filter.workspaceCode) {
          return false
        }
        return true
      })
      applyPage({
        ...page,
        items: filteredItems,
      })
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

function openCreateDialog() {
  dialogMode.value = 'create'
  editingCase.value = null
  editingCaseDetail.value = null
  dialogVisible.value = true
}

function openDetailDrawer(item: CaseSummaryItem) {
  detailCaseId.value = item.id
  detailDrawerVisible.value = true
}

async function openEditDialog(item: CaseSummaryItem) {
  dialogMode.value = 'edit'
  editingCase.value = item
  editingCaseDetail.value = null
  dialogVisible.value = true
  detailLoading.value = true
  try {
    editingCaseDetail.value = await caseApi.getCaseDetail(item.id, props.workspaceCode)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    detailLoading.value = false
  }
}

async function saveCase(payload: Parameters<typeof caseApi.createCase>[1]) {
  if (saving.value) {
    return
  }

  saving.value = true
  try {
    if (dialogMode.value === 'edit' && editingCase.value) {
      await caseApi.updateCase(editingCase.value.id, props.workspaceCode, payload)
      ElMessage.success('用例已更新')
    } else {
      await caseApi.createCase(props.workspaceCode, payload)
      ElMessage.success('用例已创建')
    }
    dialogVisible.value = false
    await loadCases()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function saveBatchUpdate(payload: BatchUpdateCasesPayload) {
  if (batchSaving.value) {
    return
  }

  batchSaving.value = true
  try {
    await batchUpdateCases(props.workspaceCode, payload)
    ElMessage.success('批量更新成功')
    batchDialogVisible.value = false
    clearSelection()
    await loadCases()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchSaving.value = false
  }
}

function isMessageBoxCancel(error: unknown) {
  if (error === 'cancel' || error === 'close') {
    return true
  }
  return error instanceof Error && (error.message === 'cancel' || error.message === 'close')
}

async function handleDeleteCase(item: CaseSummaryItem) {
  if (deletingCaseId.value !== null || runningCaseId.value !== null || togglingCaseId.value !== null || reviewingCaseId.value !== null) {
    return
  }

  deletingCaseId.value = item.id
  try {
    await deleteCase(item, props.workspaceCode)
    ElMessage.success('用例已删除')
    await loadCases()
  } catch (error) {
    if (!isMessageBoxCancel(error)) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    deletingCaseId.value = null
  }
}

async function handleRunCase(item: CaseSummaryItem) {
  if (runningCaseId.value !== null || deletingCaseId.value !== null || togglingCaseId.value !== null || reviewingCaseId.value !== null) {
    return
  }

  runningCaseId.value = item.id
  try {
    await runCase(item, props.workspaceCode)
    ElMessage.success('用例执行已记录')
    await loadCases()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    runningCaseId.value = null
  }
}

function openReviewDialog(item: CaseSummaryItem) {
  reviewingCase.value = item
  reviewDialogVisible.value = true
}

async function saveReviewCase(payload: ReviewCasePayload) {
  if (!reviewingCase.value || reviewingCaseId.value !== null) {
    return
  }

  reviewingCaseId.value = reviewingCase.value.id
  try {
    await reviewCase(reviewingCase.value, props.workspaceCode, payload)
    ElMessage.success('用例评审已更新')
    reviewDialogVisible.value = false
    await loadCases()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reviewingCaseId.value = null
  }
}

async function handleToggleCaseStatus(item: CaseSummaryItem) {
  if (togglingCaseId.value !== null || runningCaseId.value !== null || deletingCaseId.value !== null || reviewingCaseId.value !== null) {
    return
  }

  togglingCaseId.value = item.id
  try {
    await toggleCaseStatus(item, props.workspaceCode)
    ElMessage.success(`用例已${getCaseStatusActionText(item.status)}`)
    await loadCases()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    togglingCaseId.value = null
  }
}

function handlePageChange(value: number) {
  pageNo.value = value
  void loadCases()
}

function handlePageSizeChange(value: number) {
  tableSettings.updatePageSize(value)
  pageSize.value = value
  pageNo.value = 1
  void loadCases()
}

watch(
  () => [props.workspaceCode, props.directoryId],
  () => {
    pageNo.value = 1
    void loadCases()
  },
)

watch(
  () => ({ ...props.filter }),
  () => {
    pageNo.value = 1
    window.clearTimeout(filterReloadTimer)
    filterReloadTimer = window.setTimeout(() => {
      void loadCases()
    }, 300)
  },
  { deep: true },
)

onMounted(() => {
  tableSettings.load()
  if (tableSettings.pageSize.value && pageSizeOptions.includes(tableSettings.pageSize.value)) {
    pageSize.value = tableSettings.pageSize.value
  }
  void loadCases()
})

onBeforeUnmount(() => {
  window.clearTimeout(filterReloadTimer)
})

defineExpose({
  reload: loadCases,
  openCreateDialog,
})
</script>

<template>
  <section class="case-list-panel">
    <header v-if="showToolbar" class="case-list-panel__header">
      <div>
        <h2>用例列表</h2>
      </div>
      <div class="case-list-panel__actions">
        <AppButton :icon="Plus" type="primary" @click="openCreateDialog">新增用例</AppButton>
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadCases">刷新</AppButton>
      </div>
    </header>

    <AppLoadingState v-if="loading && !cases.length" text="正在加载用例列表..." />

    <AppEmptyState
      v-else-if="errorMessage && !cases.length"
      title="用例列表加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadCases">重试</AppButton>
      </template>
    </AppEmptyState>

    <div v-else class="case-list-panel__table-card">
      <div v-if="selectedCaseIds.length" class="case-list-panel__batch-bar">
        <span>已选择 {{ selectedCaseIds.length }} 条用例</span>
        <div class="case-list-panel__batch-actions">
          <AppButton size="small" @click="clearSelection">清空选择</AppButton>
          <AppButton size="small" type="primary" @click="openBatchDialog">批量更新</AppButton>
        </div>
      </div>

      <div v-if="errorMessage" class="case-list-panel__inline-error">
        {{ errorMessage }}
        <AppButton size="small" :icon="RefreshRight" @click="loadCases">重试</AppButton>
      </div>

      <div v-if="cases.length" v-loading="loading" class="case-list-panel__table-shell">
        <div class="case-list-panel__table-data">
          <div class="case-list-panel__table-scroll">
            <div
              class="case-list-panel__grid case-list-panel__grid--header"
              :style="{ gridTemplateColumns: dataGridTemplateColumns, minWidth: dataGridMinWidth }"
            >
              <div class="case-list-panel__cell case-list-panel__cell--selection">
                <el-checkbox
                  :model-value="allCurrentPageSelected"
                  :indeterminate="currentPageSelectionIndeterminate"
                  aria-label="选择当前页用例"
                  @change="toggleCurrentPageSelection(Boolean($event))"
                />
              </div>
              <div
                v-for="column in visibleColumns"
                :key="`header-${column.key}`"
                :class="['case-list-panel__cell', `case-list-panel__cell--${column.key}`]"
              >
                {{ column.label }}
              </div>
            </div>

            <div
              v-for="item in cases"
              :key="item.id"
              class="case-list-panel__grid case-list-panel__grid--row"
              :style="{ gridTemplateColumns: dataGridTemplateColumns, minWidth: dataGridMinWidth }"
            >
              <div class="case-list-panel__cell case-list-panel__cell--selection">
                <el-checkbox
                  :model-value="isCaseSelected(item.id)"
                  :aria-label="`选择用例 ${item.caseNo}`"
                  @change="toggleCaseSelected(item.id, Boolean($event))"
                />
              </div>
              <div
                v-for="column in visibleColumns"
                :key="`${item.id}-${column.key}`"
                :class="['case-list-panel__cell', `case-list-panel__cell--${column.key}`]"
              >
                <span v-if="column.key === 'caseNo'" class="case-list-panel__code">
                  {{ formatColumnValue(item, column.key) }}
                </span>
                <el-tooltip
                  v-else-if="column.key === 'title'"
                  :content="formatColumnValue(item, column.key)"
                  placement="top"
                >
                  <span class="case-list-panel__title">{{ formatColumnValue(item, column.key) }}</span>
                </el-tooltip>
                <CasePriorityBadge v-else-if="column.key === 'priority'" :priority="item.priority" />
                <CaseReviewStatusBadge v-else-if="column.key === 'reviewStatus'" :status="item.reviewStatus" />
                <CaseExecutionStatusBadge v-else-if="column.key === 'executionStatus'" :status="item.executionStatus" />
                <span v-else class="case-list-panel__cell-text">{{ formatColumnValue(item, column.key) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="case-list-panel__table-actions-fixed">
          <div class="case-list-panel__actions-header">
            <span>操作</span>
            <button
              type="button"
              class="case-list-panel__settings-trigger"
              aria-label="字段设置"
              @click="tableSettings.settingsVisible.value = true"
            >
              <el-icon><Setting /></el-icon>
            </button>
          </div>

          <div
            v-for="item in cases"
            :key="`action-${item.id}`"
            class="case-list-panel__actions-row"
          >
            <div class="case-list-panel__row-actions">
              <el-button text size="small" type="primary" @click="openEditDialog(item)">编辑</el-button>
              <el-button
                text
                size="small"
                type="primary"
                :disabled="runningCaseId === item.id"
                @click="handleRunCase(item)"
              >
                {{ runningCaseId === item.id ? '执行中' : '执行' }}
              </el-button>
              <el-dropdown trigger="click">
                <el-button text size="small" type="primary" class="case-list-panel__more-button">
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      :icon="View"
                      @click="openDetailDrawer(item)"
                    >
                      详情
                    </el-dropdown-item>
                    <el-dropdown-item
                      :icon="Checked"
                      :disabled="reviewingCaseId === item.id"
                      @click="openReviewDialog(item)"
                    >
                      {{ reviewingCaseId === item.id ? '评审中' : '评审' }}
                    </el-dropdown-item>
                    <el-dropdown-item disabled>提缺陷</el-dropdown-item>
                    <el-dropdown-item disabled>复制</el-dropdown-item>
                    <el-dropdown-item
                      :disabled="togglingCaseId === item.id || runningCaseId === item.id || deletingCaseId === item.id || reviewingCaseId === item.id"
                      @click="handleToggleCaseStatus(item)"
                    >
                      {{ togglingCaseId === item.id ? '处理中' : getCaseStatusActionText(item.status) }}
                    </el-dropdown-item>
                    <el-dropdown-item
                      class="case-list-panel__danger-action"
                      :disabled="deletingCaseId === item.id || runningCaseId === item.id || togglingCaseId === item.id || reviewingCaseId === item.id"
                      @click="handleDeleteCase(item)"
                    >
                      {{ deletingCaseId === item.id ? '删除中' : '删除' }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
      </div>

      <AppEmptyState
        v-else
        title="暂无用例"
        :description="cases.length ? '当前筛选条件下没有用例。' : '当前目录下没有用例。'"
      />

      <footer class="case-list-panel__footer">
        <span>共 {{ total }} 条，{{ totalPages }} 页</span>
        <el-pagination
          background
          layout="sizes, prev, pager, next"
          :current-page="pageNo"
          :page-size="pageSize"
          :page-sizes="pageSizeOptions"
          :total="total"
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </footer>
    </div>

    <CaseCreateEditDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :case-item="editingCase"
      :case-detail="editingCaseDetail"
      :directories="directories"
      :default-workspace-code="defaultDialogWorkspaceCode"
      :default-directory-id="directoryId"
      :saving="saving"
      :loading-detail="detailLoading"
      @submit="saveCase"
    />

    <CaseBatchUpdateDialog
      v-model="batchDialogVisible"
      :selected-ids="selectedCaseIds"
      :saving="batchSaving"
      @submit="saveBatchUpdate"
    />

    <CaseReviewDialog
      v-model="reviewDialogVisible"
      :case-item="reviewingCase"
      :saving="reviewingCaseId !== null"
      @submit="saveReviewCase"
    />

    <CaseDetailDrawer
      v-model="detailDrawerVisible"
      :case-id="detailCaseId"
      :workspace-code="workspaceCode"
    />

    <CaseTableSettingsDrawer
      v-model="tableSettings.settingsVisible.value"
      :columns="tableSettings.drawerColumns.value"
      :dragging-key="tableSettings.draggingColumnKey.value"
      :page-size="pageSize"
      :page-size-options="pageSizeOptions"
      @toggle-column="tableSettings.toggleColumnVisibility"
      @update-page-size="handlePageSizeChange"
      @drag-start="tableSettings.handleDragStart"
      @drag-end="tableSettings.handleDragEnd"
      @drop-column="tableSettings.moveColumnToTarget"
      @reset="tableSettings.reset"
    />
  </section>
</template>

<style scoped>
.case-list-panel {
  --case-table-header-height: 48px;
  --case-table-row-height: 54px;
  --case-table-actions-width: 164px;
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  min-width: 0;
}

.case-list-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.case-list-panel__header h2 {
  margin: 0;
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.case-list-panel__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
}

.case-list-panel__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-2);
}

.case-list-panel__table-card {
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--app-bg-panel);
  box-shadow: none;
}

.case-list-panel__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.case-list-panel__batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: 44px;
  padding: var(--app-space-2) var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-primary-soft);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.case-list-panel__batch-bar span {
  font-weight: 600;
}

.case-list-panel__batch-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-2);
}

.case-list-panel__table-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--case-table-actions-width);
  min-width: 0;
  overflow: hidden;
  border-top: 1px solid var(--app-border-soft);
}

.case-list-panel__table-data {
  min-width: 0;
}

.case-list-panel__table-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-gutter: stable;
}

.case-list-panel__table-scroll::-webkit-scrollbar {
  height: 10px;
}

.case-list-panel__table-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.case-list-panel__table-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
}

.case-list-panel__grid {
  display: grid;
}

.case-list-panel__grid--header {
  min-height: var(--case-table-header-height);
  border-bottom: 1px solid var(--app-border);
  background: #f8fafc;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.case-list-panel__grid--row {
  min-height: var(--case-table-row-height);
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
  transition: background-color 160ms ease;
}

.case-list-panel__grid--row:hover {
  background: #f8fafc;
}

.case-list-panel__cell {
  display: flex;
  min-width: 0;
  align-items: center;
  padding: 0 var(--app-space-5);
}

.case-list-panel__cell--selection {
  justify-content: center;
  padding: 0;
}

.case-list-panel__code,
.case-list-panel__title,
.case-list-panel__cell-text {
  display: block;
  width: 100%;
  overflow: hidden;
  font-size: var(--app-font-size-sm);
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-list-panel__code {
  color: var(--app-primary);
  font-family: Consolas, Monaco, monospace;
  font-weight: 400;
}

.case-list-panel__title {
  color: var(--app-text-primary);
  font-weight: 500;
}

.case-list-panel__cell-text {
  color: var(--app-text-main);
}

.case-list-panel__table-actions-fixed {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-left: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.case-list-panel__actions-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-1);
  min-height: var(--case-table-header-height);
  border-bottom: 1px solid var(--app-border);
  background: #f8fafc;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.case-list-panel__settings-trigger {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
}

.case-list-panel__settings-trigger:hover {
  background: var(--app-primary-soft);
}

.case-list-panel__actions-row {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--case-table-row-height);
  border-bottom: 1px solid var(--app-border-soft);
  transition: background-color 160ms ease;
}

.case-list-panel__actions-row:hover {
  background: #f8fafc;
}

.case-list-panel__more-button {
  width: 28px;
  padding-right: 0;
  padding-left: 0;
}

.case-list-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  min-height: 52px;
  padding: var(--app-space-2) var(--app-space-4);
  border-top: 1px solid var(--app-border-soft);
}

.case-list-panel__footer span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.case-list-panel__row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  white-space: nowrap;
}

.case-list-panel__row-actions :deep(.el-button) {
  margin-left: 0;
}

:global(.case-list-panel__danger-action) {
  color: var(--app-danger);
}

@media (max-width: 720px) {
  .case-list-panel__header,
  .case-list-panel__footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .case-list-panel__actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .case-list-panel__batch-bar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
