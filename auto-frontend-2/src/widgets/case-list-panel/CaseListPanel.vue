<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Checked, Edit, MoreFilled, Plus, RefreshRight, VideoPlay, View } from '@element-plus/icons-vue'
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

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    directoryId?: number | null
    filter: CaseClientFilter
    directories?: CaseDirectoryWorkspace[]
  }>(),
  {
    workspaceCode: 'ALL',
    directoryId: null,
    directories: () => [],
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
      applyPage(page)
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
  void loadCases()
})

onBeforeUnmount(() => {
  window.clearTimeout(filterReloadTimer)
})

defineExpose({
  reload: loadCases,
})
</script>

<template>
  <section class="case-list-panel">
    <header class="case-list-panel__header">
      <div>
        <h2>用例列表</h2>
        <p>第一阶段仅接入读取、分页和当前页筛选。</p>
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

      <div v-if="cases.length" class="case-list-panel__scroll">
        <table>
          <colgroup>
            <col class="case-list-panel__select-col" />
            <col class="case-list-panel__code-col" />
            <col class="case-list-panel__title-col" />
            <col class="case-list-panel__priority-col" />
            <col class="case-list-panel__status-col" />
            <col class="case-list-panel__status-col" />
            <col class="case-list-panel__person-col" />
            <col class="case-list-panel__workspace-col" />
            <col class="case-list-panel__module-col" />
            <col class="case-list-panel__time-col" />
            <col class="case-list-panel__action-col" />
          </colgroup>
          <thead>
            <tr>
              <th>
                <el-checkbox
                  :model-value="allCurrentPageSelected"
                  :indeterminate="currentPageSelectionIndeterminate"
                  aria-label="选择当前页用例"
                  @change="toggleCurrentPageSelection(Boolean($event))"
                />
              </th>
              <th>用例编号</th>
              <th>用例名称</th>
              <th>优先级</th>
              <th>评审状态</th>
              <th>执行状态</th>
              <th>执行人</th>
              <th>所属空间</th>
              <th>所属模块</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in cases" :key="item.id">
              <td>
                <el-checkbox
                  :model-value="isCaseSelected(item.id)"
                  :aria-label="`选择用例 ${item.caseNo}`"
                  @change="toggleCaseSelected(item.id, Boolean($event))"
                />
              </td>
              <td>
                <span class="case-list-panel__mono">{{ item.caseNo }}</span>
              </td>
              <td>
                <div class="case-list-panel__title">{{ item.title }}</div>
                <div class="case-list-panel__subtitle">{{ item.caseType }} · {{ item.sourceType }}</div>
              </td>
              <td><CasePriorityBadge :priority="item.priority" /></td>
              <td><CaseReviewStatusBadge :status="item.reviewStatus" /></td>
              <td><CaseExecutionStatusBadge :status="item.executionStatus" /></td>
              <td>{{ item.executorName || '-' }}</td>
              <td>
                <span class="case-list-panel__muted">{{ item.workspaceName || item.workspaceCode }}</span>
              </td>
              <td>
                <span class="case-list-panel__muted">{{ getCaseDirectoryText(item) }}</span>
              </td>
              <td>{{ formatCaseDateTime(item.updatedAt) }}</td>
              <td>
                <div class="case-list-panel__row-actions">
                  <el-button text size="small" :icon="View" @click="openDetailDrawer(item)">详情</el-button>
                  <el-button text size="small" :icon="Edit" @click="openEditDialog(item)">编辑</el-button>
                  <el-dropdown trigger="click">
                    <el-button text size="small" :icon="MoreFilled">更多</el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item
                          :icon="VideoPlay"
                          :disabled="runningCaseId === item.id"
                          @click="handleRunCase(item)"
                        >
                          {{ runningCaseId === item.id ? '执行中' : '执行' }}
                        </el-dropdown-item>
                        <el-dropdown-item
                          :icon="Checked"
                          :disabled="reviewingCaseId === item.id"
                          @click="openReviewDialog(item)"
                        >
                          {{ reviewingCaseId === item.id ? '评审中' : '评审' }}
                        </el-dropdown-item>
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
              </td>
            </tr>
          </tbody>
        </table>
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
          :page-sizes="[10, 20, 50]"
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
  </section>
</template>

<style scoped>
.case-list-panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.case-list-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.case-list-panel__header h2 {
  margin: 0;
  font-size: var(--app-font-size-xl);
  line-height: 26px;
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
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
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
  padding: var(--app-space-3) var(--app-space-4);
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

.case-list-panel__scroll {
  overflow-x: auto;
}

.case-list-panel table {
  width: 100%;
  min-width: 1268px;
  border-collapse: collapse;
  table-layout: fixed;
}

.case-list-panel__select-col {
  width: 48px;
}

.case-list-panel th {
  padding: var(--app-space-3) var(--app-space-4);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  text-align: left;
}

.case-list-panel td {
  padding: var(--app-space-3) var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  vertical-align: middle;
}

.case-list-panel tr:last-child td {
  border-bottom: 0;
}

.case-list-panel__code-col {
  width: 136px;
}

.case-list-panel__title-col {
  width: 260px;
}

.case-list-panel__priority-col {
  width: 84px;
}

.case-list-panel__status-col {
  width: 104px;
}

.case-list-panel__person-col,
.case-list-panel__workspace-col,
.case-list-panel__module-col {
  width: 132px;
}

.case-list-panel__time-col {
  width: 148px;
}

.case-list-panel__action-col {
  width: 168px;
}

.case-list-panel__title,
.case-list-panel__subtitle,
.case-list-panel__muted,
.case-list-panel__mono {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-list-panel__title {
  color: var(--app-text-primary);
  font-weight: 600;
}

.case-list-panel__subtitle,
.case-list-panel__muted {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
}

.case-list-panel__mono {
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
}

.case-list-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  padding: var(--app-space-3) var(--app-space-4);
  border-top: 1px solid var(--app-border-soft);
}

.case-list-panel__footer span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.case-list-panel__row-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-1);
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
