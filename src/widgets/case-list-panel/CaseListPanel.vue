<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Checked, MoreFilled, Plus, RefreshRight, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import {
  type CaseDetail,
  CaseExecutionStatusBadge,
  CasePriorityBadge,
  CaseReviewStatusBadge,
  caseApi,
  formatCaseDateTime,
  getCaseDirectoryText,
  type BatchMoveCasesPayload,
  type BatchUpdateCasesPayload,
  type CaseClientFilter,
  type CaseDirectoryNode,
  type CaseDirectoryWorkspace,
  type ReviewCasePayload,
  type CaseSummaryItem,
  type PageResponse,
  saveCaseExecutionContext,
} from '@/entities/case'
import {
  defectApi,
  defectPriorityOptions,
  defectSeverityOptions,
  type DefectPriority,
  type DefectSeverity,
  type SaveDefectPayload,
} from '@/entities/defect'
import { CaseBatchUpdateDialog, batchUpdateCases } from '@/features/case-batch-update'
import { CaseCreateEditDrawer } from '@/features/case-create-edit'
import type { CaseDialogMode } from '@/features/case-create-edit/model'
import { deleteCase } from '@/features/case-delete'
import { CaseReviewDialog, reviewCase } from '@/features/case-review'
import { getCaseStatusActionText, toggleCaseStatus } from '@/features/case-toggle-status'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'
import AppTagInput from '@/shared/ui/app-tag-input/AppTagInput.vue'
import AppUserSelect from '@/shared/ui/app-user-select/AppUserSelect.vue'
import { CaseDetailDrawer } from '@/widgets/case-detail-drawer'
import {
  useCaseTableSettings,
  type CaseTableColumnDefinition,
  type CaseTableColumnKey,
} from './useCaseTableSettings'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    directoryId?: number | null
    selectedNodeId?: string | null
    filter: CaseClientFilter
    directories?: CaseDirectoryWorkspace[]
    showToolbar?: boolean
  }>(),
  {
    workspaceCode: 'ALL',
    directoryId: null,
    selectedNodeId: null,
    directories: () => [],
    showToolbar: true,
  },
)

const emit = defineEmits<{
  loaded: [items: CaseSummaryItem[]]
  reloadDirectories: []
}>()

const route = useRoute()
const router = useRouter()
const cases = ref<CaseSummaryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(0)
const dialogVisible = ref(false)
const dialogMode = ref<CaseDialogMode>('create')
const editingCase = ref<CaseSummaryItem | null>(null)
const editingCaseDetail = ref<CaseDetail | null>(null)
const detailLoading = ref(false)
const saving = ref(false)
const batchDialogVisible = ref(false)
const batchSaving = ref(false)
const batchMoveDialogVisible = ref(false)
const batchMoveSaving = ref(false)
const batchMoveTargetDirectoryId = ref<number | null>(null)
const selectedCaseIds = ref<number[]>([])
const detailDrawerVisible = ref(false)
const detailCaseId = ref<number | null>(null)
const reviewDialogVisible = ref(false)
const reviewingCase = ref<CaseSummaryItem | null>(null)
const reviewingCaseId = ref<number | null>(null)
const defectDialogVisible = ref(false)
const defectCase = ref<CaseSummaryItem | null>(null)
const defectSaving = ref(false)
const defectFormError = ref('')
const defectForm = reactive({
  title: '',
  description: '',
  priority: 'P1' as DefectPriority,
  severity: 'HIGH' as DefectSeverity,
  assigneeId: '',
  tags: [] as string[],
})
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

const editingCaseIndex = computed(() => {
  if (!editingCase.value) {
    return -1
  }
  return cases.value.findIndex(item => item.id === editingCase.value?.id)
})

const canNavigatePrevCase = computed(() => dialogMode.value === 'edit' && editingCaseIndex.value > 0)
const canNavigateNextCase = computed(() => dialogMode.value === 'edit' && editingCaseIndex.value >= 0 && editingCaseIndex.value < cases.value.length - 1)

const allCurrentPageSelected = computed(() => {
  return cases.value.length > 0 && cases.value.every((item) => selectedCaseIds.value.includes(item.id))
})

const currentPageSelectionIndeterminate = computed(() => {
  return selectedCases.value.length > 0 && !allCurrentPageSelected.value
})

const selectedWorkspaceCodes = computed(() => [...new Set(selectedCases.value.map((item) => item.workspaceCode))])
const batchMoveWorkspaceCode = computed(() => (selectedWorkspaceCodes.value.length === 1 ? selectedWorkspaceCodes.value[0] : ''))

type DirectoryOption = {
  value: number | null
  label: string
}

function buildDirectoryOptions(nodes: CaseDirectoryNode[], prefix = ''): DirectoryOption[] {
  const options: DirectoryOption[] = []
  nodes.forEach((node) => {
    const label = prefix ? `${prefix} / ${node.name}` : node.name
    options.push({ value: node.id, label })
    if (node.children.length) {
      options.push(...buildDirectoryOptions(node.children, label))
    }
  })
  return options
}

const batchMoveDirectoryOptions = computed<DirectoryOption[]>(() => {
  if (!batchMoveWorkspaceCode.value) {
    return []
  }

  const workspace = props.directories.find((item) => item.workspaceCode === batchMoveWorkspaceCode.value)
  return [
    { value: null, label: '空间根目录' },
    ...buildDirectoryOptions(workspace?.children ?? []),
  ]
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

function openBatchMoveDialog() {
  if (!selectedCaseIds.value.length) {
    return
  }
  if (!batchMoveWorkspaceCode.value) {
    ElMessage.warning('批量移动暂不支持跨空间混选')
    return
  }

  batchMoveTargetDirectoryId.value = null
  batchMoveDialogVisible.value = true
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

async function switchEditCase(item: CaseSummaryItem) {
  const previousCase = editingCase.value
  editingCase.value = item
  detailLoading.value = true
  try {
    const detail = await caseApi.getCaseDetail(item.id, props.workspaceCode)
    editingCaseDetail.value = detail
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    editingCase.value = previousCase
  } finally {
    detailLoading.value = false
  }
}

async function openAdjacentEditCase(direction: 'prev' | 'next') {
  if (dialogMode.value !== 'edit' || detailLoading.value || saving.value) {
    return
  }

  const currentIndex = editingCaseIndex.value
  const nextIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1
  const nextCase = cases.value[nextIndex]
  if (!nextCase) {
    return
  }

  await switchEditCase(nextCase)
}

async function openCopyDialog(item: CaseSummaryItem) {
  dialogMode.value = 'copy'
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
    } else if (dialogMode.value === 'copy') {
      await caseApi.createCase(props.workspaceCode, payload)
      ElMessage.success('复制用例已创建')
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

function openDefectDialog(item: CaseSummaryItem) {
  defectCase.value = item
  defectForm.title = `${item.title || item.caseNo || '用例'} - 缺陷`
  defectForm.description = ''
  defectForm.priority = 'P1'
  defectForm.severity = 'HIGH'
  defectForm.assigneeId = ''
  defectForm.tags = []
  defectFormError.value = ''
  defectDialogVisible.value = true
}

function buildDefectFromCasePayload(): SaveDefectPayload {
  return {
    workspaceCode: defectCase.value?.workspaceCode,
    title: defectForm.title.trim(),
    description: defectForm.description.trim(),
    priority: defectForm.priority,
    severity: defectForm.severity,
    assigneeId: Number.isFinite(Number(defectForm.assigneeId)) ? Number(defectForm.assigneeId) : null,
    relatedCaseId: defectCase.value?.id ?? null,
    tags: [...defectForm.tags],
  }
}

function validateDefectFromCaseForm() {
  if (!defectForm.title.trim()) {
    return '请输入缺陷标题'
  }
  if (!defectForm.description.trim()) {
    return '请输入缺陷描述'
  }
  if (!defectForm.assigneeId.trim()) {
    return '请选择处理人'
  }
  if (!Number.isFinite(Number(defectForm.assigneeId))) {
    return '处理人数据异常，请重新选择'
  }
  return ''
}

async function submitDefectFromCase() {
  if (!defectCase.value || defectSaving.value) {
    return
  }

  const error = validateDefectFromCaseForm()
  if (error) {
    defectFormError.value = error
    return
  }

  defectSaving.value = true
  defectFormError.value = ''
  try {
    await defectApi.createDefectFromCase(
      defectCase.value.workspaceCode || props.workspaceCode,
      defectCase.value.id,
      buildDefectFromCasePayload(),
    )
    ElMessage.success('已从用例创建缺陷')
    defectDialogVisible.value = false
  } catch (error) {
    defectFormError.value = getRequestErrorMessage(error)
  } finally {
    defectSaving.value = false
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

async function saveBatchMove() {
  if (!selectedCaseIds.value.length || !batchMoveWorkspaceCode.value || batchMoveSaving.value) {
    return
  }

  const payload: BatchMoveCasesPayload = {
    caseIds: [...selectedCaseIds.value],
    targetDirectoryId: batchMoveTargetDirectoryId.value,
  }

  batchMoveSaving.value = true
  try {
    await caseApi.batchMoveCases(batchMoveWorkspaceCode.value, payload)
    ElMessage.success('批量移动已完成')
    batchMoveDialogVisible.value = false
    clearSelection()
    emit('reloadDirectories')
    await loadCases()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchMoveSaving.value = false
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

async function handleBatchDeleteCases() {
  if (!selectedCaseIds.value.length || deletingCaseId.value !== null || runningCaseId.value !== null || togglingCaseId.value !== null || reviewingCaseId.value !== null) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除当前页选中的 ${selectedCaseIds.value.length} 条用例吗？`, '批量删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    deletingCaseId.value = -1
    await caseApi.batchDeleteCases(props.workspaceCode, {
      caseIds: [...selectedCaseIds.value],
    })
    ElMessage.success('批量删除已完成')
    if (cases.value.length === selectedCaseIds.value.length && pageNo.value > 1) {
      pageNo.value -= 1
    }
    clearSelection()
    await loadCases()
  } catch (error) {
    if (!isMessageBoxCancel(error)) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    deletingCaseId.value = null
  }
}

function buildReturnQuery() {
  return Object.fromEntries(
    Object.entries(route.query)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, value as string]),
  )
}

function openExecutionPage(item: CaseSummaryItem) {
  if (runningCaseId.value !== null || deletingCaseId.value !== null || togglingCaseId.value !== null || reviewingCaseId.value !== null) {
    return
  }

  saveCaseExecutionContext({
    workspaceCode: item.workspaceCode || props.workspaceCode,
    returnQuery: buildReturnQuery(),
    selectedDirectoryId: props.directoryId,
    selectedNodeId: props.selectedNodeId,
    sourceLabel: getCaseDirectoryText(item),
    filter: { ...props.filter },
    items: cases.value,
  })

  void router.push({
    name: 'case-execution',
    params: { id: item.id },
    query: {
      workspace: item.workspaceCode || props.workspaceCode,
    },
  })
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
  tableSettings.load()
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
            <AppTableSettingsTrigger @click="tableSettings.settingsVisible.value = true" />
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
                @click="openExecutionPage(item)"
              >
                执行
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
                    <el-dropdown-item @click="openDefectDialog(item)">提缺陷</el-dropdown-item>
                    <el-dropdown-item
                      :disabled="detailLoading && editingCase?.id === item.id"
                      @click="openCopyDialog(item)"
                    >
                      {{ detailLoading && editingCase?.id === item.id && dialogMode === 'copy' ? '复制中' : '复制' }}
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
          </div>
        </div>
      </div>

      <AppEmptyState
        v-else
        title="暂无用例"
        :description="cases.length ? '当前筛选条件下没有用例。' : '当前目录下没有用例。'"
      />

      <footer class="case-list-panel__footer">
        <div class="case-list-panel__footer-left">
          <div v-if="selectedCaseIds.length" class="case-list-panel__batch-bar">
            <span>已选 {{ selectedCaseIds.length }} 条</span>
            <div class="case-list-panel__batch-actions">
              <AppButton size="small" @click="openBatchMoveDialog">移动到</AppButton>
              <AppButton size="small" @click="openBatchDialog">批量编辑</AppButton>
              <AppButton size="small" type="danger" :loading="deletingCaseId === -1" @click="handleBatchDeleteCases">
                批量删除
              </AppButton>
              <AppButton size="small" @click="clearSelection">取消</AppButton>
            </div>
          </div>
        </div>
        <div class="case-list-panel__pagination">
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
        </div>
      </footer>
    </div>

    <CaseCreateEditDrawer
      v-model="dialogVisible"
      :mode="dialogMode"
      :case-item="editingCase"
      :case-detail="editingCaseDetail"
      :directories="directories"
      :default-workspace-code="defaultDialogWorkspaceCode"
      :default-directory-id="directoryId"
      :saving="saving"
      :loading-detail="detailLoading"
      :show-navigator="dialogMode === 'edit' && cases.length > 1"
      :can-go-prev="canNavigatePrevCase"
      :can-go-next="canNavigateNextCase"
      :current-index="editingCaseIndex >= 0 ? editingCaseIndex + 1 : 0"
      :total-count="cases.length"
      @submit="saveCase"
      @prev="openAdjacentEditCase('prev')"
      @next="openAdjacentEditCase('next')"
    />

    <CaseBatchUpdateDialog
      v-model="batchDialogVisible"
      :selected-ids="selectedCaseIds"
      :saving="batchSaving"
      @submit="saveBatchUpdate"
    />

    <AppDialog
      v-model="batchMoveDialogVisible"
      title="批量移动用例"
      width="420px"
    >
      <div class="case-batch-move-dialog">
        <div class="case-batch-move-dialog__summary">
          已选择 {{ selectedCaseIds.length }} 条用例
        </div>
        <label class="case-batch-move-dialog__field">
          <span>目标目录</span>
          <el-select v-model="batchMoveTargetDirectoryId" placeholder="请选择目标目录" clearable>
            <el-option
              v-for="item in batchMoveDirectoryOptions"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </label>
      </div>

      <template #footer>
        <AppButton :disabled="batchMoveSaving" @click="batchMoveDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="batchMoveSaving" @click="saveBatchMove">保存</AppButton>
      </template>
    </AppDialog>

    <AppDialog
      v-model="defectDialogVisible"
      title="从用例提缺陷"
      width="720px"
    >
      <div class="case-defect-dialog">
        <div class="case-defect-dialog__summary">
          <span>{{ defectCase?.caseNo || `#${defectCase?.id}` }}</span>
          <strong>{{ defectCase?.title || '-' }}</strong>
        </div>

        <div class="case-defect-dialog__field">
          <span class="is-required">缺陷标题</span>
          <el-input
            v-model="defectForm.title"
            :disabled="defectSaving"
            placeholder="请输入缺陷标题"
          />
        </div>

        <div class="case-defect-dialog__field">
          <span class="is-required">缺陷描述</span>
          <el-input
            v-model="defectForm.description"
            type="textarea"
            :rows="5"
            resize="none"
            :disabled="defectSaving"
            placeholder="请描述实际结果、复现步骤或影响范围"
          />
        </div>

        <div class="case-defect-dialog__grid">
          <div class="case-defect-dialog__field">
            <span class="is-required">处理人</span>
            <AppUserSelect
              v-model="defectForm.assigneeId"
              :workspace-code="defectCase?.workspaceCode || workspaceCode"
              :disabled="defectSaving"
              placeholder="请选择处理人"
            />
          </div>

          <div class="case-defect-dialog__field">
            <span class="is-required">严重级别</span>
            <el-select
              v-model="defectForm.severity"
              class="case-defect-dialog__select"
              :disabled="defectSaving"
            >
              <el-option
                v-for="item in defectSeverityOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>
        </div>

        <div class="case-defect-dialog__field">
          <span class="is-required">优先级</span>
          <div class="case-defect-dialog__segment">
            <button
              v-for="item in defectPriorityOptions"
              :key="item.value"
              type="button"
              :class="{ 'is-active': defectForm.priority === item.value }"
              :disabled="defectSaving"
              @click="defectForm.priority = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="case-defect-dialog__field">
          <span>标签</span>
          <AppTagInput
            v-model="defectForm.tags"
            :disabled="defectSaving"
            placeholder="输入内容后回车添加标签"
          />
        </div>

        <p v-if="defectFormError" class="case-defect-dialog__error">{{ defectFormError }}</p>
      </div>

      <template #footer>
        <AppButton :disabled="defectSaving" @click="defectDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="defectSaving" @click="submitDefectFromCase">创建缺陷</AppButton>
      </template>
    </AppDialog>

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

    <AppTableColumnSettingsDrawer
      v-model="tableSettings.settingsVisible.value"
      :columns="tableSettings.drawerColumns.value"
      :dragging-key="tableSettings.draggingColumnKey.value"
      @toggle-column="tableSettings.toggleColumnVisibility"
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
  justify-content: flex-start;
  gap: var(--app-space-3);
  min-height: 32px;
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

.case-list-panel__footer-left {
  min-width: 0;
  flex: 1;
}

.case-list-panel__pagination {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-3);
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

.case-batch-move-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.case-batch-move-dialog__summary {
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.case-batch-move-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.case-batch-move-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.case-defect-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.case-defect-dialog__summary {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.case-defect-dialog__summary span {
  flex: 0 0 auto;
  color: var(--app-primary);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-sm);
}

.case-defect-dialog__summary strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-defect-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.case-defect-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.case-defect-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.case-defect-dialog__field > span.is-required::before {
  margin-right: 3px;
  color: var(--app-danger);
  content: '*';
}

.case-defect-dialog__select {
  width: 100%;
}

.case-defect-dialog__segment {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.case-defect-dialog__segment button {
  min-height: 34px;
  padding: 0 var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.case-defect-dialog__segment button:hover:not(:disabled),
.case-defect-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.case-defect-dialog__segment button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.case-defect-dialog__error {
  margin: 0;
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
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

  .case-list-panel__pagination {
    width: 100%;
    flex-wrap: wrap;
  }

  .case-defect-dialog__grid {
    grid-template-columns: 1fr;
  }
}
</style>
