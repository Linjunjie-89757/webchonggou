<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  CircleClose,
  Delete,
  FolderOpened,
  MoreFilled,
  RefreshRight,
  View,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { caseAiApi, type AiGenerationTaskEventItem, type AiGenerationTaskItem, type GeneratedAiCaseItem } from '@/entities/case-ai'
import { caseApi, type CaseDirectoryNode } from '@/entities/case'
import { useWorkspaceContext } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppCard from '@/shared/ui/app-card/AppCard.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'

type TaskStatus = AiGenerationTaskItem['status']
type ColumnKey =
  | 'taskId'
  | 'workspaceName'
  | 'requirementTitle'
  | 'outputMode'
  | 'status'
  | 'generatedCount'
  | 'savedCaseCount'
  | 'createdByName'
  | 'createdAt'
  | 'updatedAt'

interface ColumnDefinition {
  key: ColumnKey
  label: string
  width?: number
  minWidth?: number
  required?: boolean
  defaultVisible?: boolean
}

interface PersistedTableSettings {
  columnVisibility?: Partial<Record<ColumnKey, boolean>>
  columnOrder?: ColumnKey[]
}

interface DirectoryOption {
  value: number | null
  label: string
}

const TABLE_SETTINGS_STORAGE_KEY = 'case-ai-record-table-settings-v1'
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50]

const route = useRoute()
const router = useRouter()
const { selectedWorkspaceCode } = useWorkspaceContext()

const loading = ref(false)
const hasLoaded = ref(false)
const errorMessage = ref('')
const records = ref<AiGenerationTaskItem[]>([])
const statusFilter = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const settingsVisible = ref(false)
const draggingColumnKey = ref<ColumnKey | null>(null)
const columnVisibility = ref<Partial<Record<ColumnKey, boolean>>>({})
const columnOrder = ref<ColumnKey[]>([])

const processDialogVisible = ref(false)
const processRecord = ref<AiGenerationTaskItem | null>(null)
const processLoading = ref(false)
const processPending = ref(false)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailRecord = ref<AiGenerationTaskItem | null>(null)
const detailActiveTab = ref<'detail' | 'analysis'>('detail')
const detailCaseIndex = ref(0)

const adoptDialogVisible = ref(false)
const adoptLoading = ref(false)
const adoptSubmitting = ref(false)
const adoptRecord = ref<AiGenerationTaskItem | null>(null)
const adoptDirectoryOptions = ref<DirectoryOption[]>([])
const adoptForm = reactive({
  directoryId: null as number | null,
})
const adoptPathTouched = ref(false)

let pollingTimer: number | null = null

const processSteps = [
  {
    index: 1 as const,
    title: '任务已创建',
    description: '已经记录需求内容、目标空间和输出模式。',
  },
  {
    index: 2 as const,
    title: 'AI 生成用例',
    description: '正在根据需求描述生成候选测试用例。',
  },
  {
    index: 3 as const,
    title: 'AI 自动评审',
    description: '正在汇总评审意见、优化建议和补充结论。',
  },
  {
    index: 4 as const,
    title: '任务完成',
    description: '生成结果已经进入 AI 生成记录，可继续查看和采纳。',
  },
]

const tableColumns: ColumnDefinition[] = [
  { key: 'taskId', label: '任务 ID', minWidth: 180, required: true, defaultVisible: true },
  { key: 'workspaceName', label: '所属空间', minWidth: 140, defaultVisible: true },
  { key: 'requirementTitle', label: '关联需求', minWidth: 280, required: true, defaultVisible: true },
  { key: 'outputMode', label: '输出模式', minWidth: 120, defaultVisible: true },
  { key: 'status', label: '状态', minWidth: 110, defaultVisible: true },
  { key: 'generatedCount', label: '生成用例数', minWidth: 110, defaultVisible: true },
  { key: 'savedCaseCount', label: '已采纳数', minWidth: 110, defaultVisible: true },
  { key: 'createdByName', label: '创建人', minWidth: 120, defaultVisible: false },
  { key: 'createdAt', label: '生成时间', minWidth: 180, defaultVisible: true },
  { key: 'updatedAt', label: '更新时间', minWidth: 180, defaultVisible: false },
]

const resolvedWorkspaceCode = computed(() => {
  const routeWorkspace = Array.isArray(route.query.workspace) ? route.query.workspace[0] : route.query.workspace
  return routeWorkspace || selectedWorkspaceCode.value || 'ALL'
})

const runningStatuses: TaskStatus[] = ['PENDING', 'GENERATING', 'REVIEWING']

const filteredRecords = computed(() => (
  statusFilter.value
    ? records.value.filter(item => item.status === statusFilter.value)
    : records.value
))

const total = computed(() => filteredRecords.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const pagedRecords = computed(() => {
  const start = (pageNo.value - 1) * pageSize.value
  return filteredRecords.value.slice(start, start + pageSize.value)
})

const stats = computed(() => ({
  total: records.value.length,
  completed: records.value.filter(item => item.status === 'COMPLETED').length,
  running: records.value.filter(item => runningStatuses.includes(item.status)).length,
  failed: records.value.filter(item => item.status === 'FAILED').length,
}))

const visibleColumns = computed(() => orderedColumns.value.filter(column => (
  column.required || Boolean(columnVisibility.value[column.key])
)))

const drawerColumns = computed(() => orderedColumns.value.map(column => ({
  key: column.key,
  label: column.label,
  required: Boolean(column.required),
  visible: column.required ? true : Boolean(columnVisibility.value[column.key]),
  draggable: !column.required,
})))

const activeGeneratedCase = computed(() => detailRecord.value?.generatedCases?.[detailCaseIndex.value] ?? null)
const detailCaseCount = computed(() => detailRecord.value?.generatedCases?.length ?? 0)
const canPreviewPreviousCase = computed(() => detailCaseIndex.value > 0)
const canPreviewNextCase = computed(() => detailCaseIndex.value < detailCaseCount.value - 1)
const detailEvents = computed(() => [...(detailRecord.value?.events ?? [])].sort((left, right) => (
  (left.seq ?? 0) - (right.seq ?? 0)
)))
const adoptableCases = computed(() => {
  if (!adoptRecord.value) {
    return []
  }

  const adoptedIndexes = new Set(adoptRecord.value.adoptedCaseIndexes ?? [])
  const deletedIndexes = new Set(adoptRecord.value.deletedCaseIndexes ?? [])
  return adoptRecord.value.generatedCases
    .map((item, index) => ({ item, index }))
    .filter(entry => !adoptedIndexes.has(entry.index) && !deletedIndexes.has(entry.index))
})

const orderedColumns = computed(() => columnOrder.value
  .map(key => tableColumns.find(column => column.key === key))
  .filter((column): column is ColumnDefinition => Boolean(column)))

function getDefaultColumnOrder() {
  const required = tableColumns.filter(column => column.required).map(column => column.key)
  const optional = tableColumns.filter(column => !column.required).map(column => column.key)
  return [...required, ...optional]
}

function normalizeColumnOrder(nextOrder?: ColumnKey[]) {
  const requiredKeys = tableColumns.filter(column => column.required).map(column => column.key)
  const optionalKeys = tableColumns.filter(column => !column.required).map(column => column.key)
  const preferredOptionalOrder = (nextOrder ?? []).filter(key => optionalKeys.includes(key))
  const remainingOptionalKeys = optionalKeys.filter(key => !preferredOptionalOrder.includes(key))
  return [...requiredKeys, ...preferredOptionalOrder, ...remainingOptionalKeys]
}

function buildDefaultColumnVisibility() {
  return tableColumns.reduce<Partial<Record<ColumnKey, boolean>>>((result, column) => {
    result[column.key] = column.required ? true : Boolean(column.defaultVisible)
    return result
  }, {})
}

function persistTableSettings() {
  if (typeof window === 'undefined') {
    return
  }

  const payload: PersistedTableSettings = {
    columnVisibility: columnVisibility.value,
    columnOrder: columnOrder.value,
  }
  window.localStorage.setItem(TABLE_SETTINGS_STORAGE_KEY, JSON.stringify(payload))
}

function loadTableSettings() {
  const defaultOrder = getDefaultColumnOrder()
  const defaultVisibility = buildDefaultColumnVisibility()
  if (typeof window === 'undefined') {
    columnOrder.value = defaultOrder
    columnVisibility.value = defaultVisibility
    return
  }

  const raw = window.localStorage.getItem(TABLE_SETTINGS_STORAGE_KEY)
  if (!raw) {
    columnOrder.value = defaultOrder
    columnVisibility.value = defaultVisibility
    return
  }

  try {
    const parsed = JSON.parse(raw) as PersistedTableSettings
    columnOrder.value = normalizeColumnOrder(parsed.columnOrder)
    columnVisibility.value = tableColumns.reduce<Partial<Record<ColumnKey, boolean>>>((result, column) => {
      result[column.key] = column.required
        ? true
        : (parsed.columnVisibility?.[column.key] ?? Boolean(column.defaultVisible))
      return result
    }, {})
  } catch {
    columnOrder.value = defaultOrder
    columnVisibility.value = defaultVisibility
  }
}

function resetTableSettings() {
  columnOrder.value = getDefaultColumnOrder()
  columnVisibility.value = buildDefaultColumnVisibility()
  persistTableSettings()
}

function isColumnKey(key: string): key is ColumnKey {
  return tableColumns.some(column => column.key === key)
}

function toggleColumnVisibility(key: string, value: boolean | string | number) {
  if (!isColumnKey(key)) {
    return
  }
  const column = tableColumns.find(item => item.key === key)
  if (!column || column.required) {
    return
  }
  columnVisibility.value = {
    ...columnVisibility.value,
    [key]: Boolean(value),
  }
  persistTableSettings()
}

function handleDragStart(key: string) {
  if (!isColumnKey(key)) {
    return
  }
  const column = tableColumns.find(item => item.key === key)
  if (!column || column.required) {
    return
  }
  draggingColumnKey.value = key
}

function handleDragEnd() {
  draggingColumnKey.value = null
}

function moveColumnToTarget(targetKey: string) {
  if (!isColumnKey(targetKey)) {
    return
  }
  const sourceKey = draggingColumnKey.value
  if (!sourceKey || sourceKey === targetKey) {
    return
  }

  const sourceColumn = tableColumns.find(item => item.key === sourceKey)
  const targetColumn = tableColumns.find(item => item.key === targetKey)
  if (!sourceColumn || !targetColumn || sourceColumn.required || targetColumn.required) {
    return
  }

  const nextOrder = [...columnOrder.value]
  const sourceIndex = nextOrder.indexOf(sourceKey)
  const targetIndex = nextOrder.indexOf(targetKey)
  if (sourceIndex < 0 || targetIndex < 0) {
    return
  }

  const [moved] = nextOrder.splice(sourceIndex, 1)
  nextOrder.splice(targetIndex, 0, moved)
  columnOrder.value = normalizeColumnOrder(nextOrder)
  draggingColumnKey.value = null
  persistTableSettings()
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function formatMultilineText(value?: string | null) {
  return value?.trim() || '-'
}

function getStatusLabel(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    PENDING: '任务创建中',
    GENERATING: '生成中',
    REVIEWING: '评审中',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELED: '已取消',
  }
  return map[status] ?? status
}

function getStatusTone(status: TaskStatus) {
  const map: Record<TaskStatus, 'default' | 'primary' | 'warning' | 'success' | 'danger'> = {
    PENDING: 'primary',
    GENERATING: 'primary',
    REVIEWING: 'warning',
    COMPLETED: 'success',
    FAILED: 'danger',
    CANCELED: 'default',
  }
  return map[status] ?? 'default'
}

function getOutputModeLabel(mode: string) {
  return mode === 'STREAM' ? '流式输出' : '完整输出'
}

function getPrimaryActionLabel(record: AiGenerationTaskItem) {
  if (record.status === 'COMPLETED') {
    return '全部采纳'
  }
  if (record.status === 'FAILED') {
    return '重新生成'
  }
  return '查看流程'
}

function isRunningStatus(status: TaskStatus) {
  return runningStatuses.includes(status)
}

function getFailureStepLabel(step: number | null) {
  const labelMap: Record<number, string> = {
    1: '任务创建',
    2: 'AI 生成用例',
    3: 'AI 自动评审',
    4: '任务完成',
  }
  return step ? (labelMap[step] || '当前步骤') : '当前步骤'
}

function isStepDone(record: AiGenerationTaskItem | null, step: number) {
  if (!record?.currentStep) {
    return false
  }
  if (record.status === 'FAILED') {
    return step < record.currentStep
  }
  if (record.status === 'COMPLETED') {
    return step <= 4
  }
  return step < record.currentStep
}

function isStepActive(record: AiGenerationTaskItem | null, step: number) {
  return !!record?.currentStep && record.currentStep === step && isRunningStatus(record.status)
}

function isStepFailed(record: AiGenerationTaskItem | null, step: number) {
  return record?.status === 'FAILED' && record.currentStep === step
}

function getStepStatusLabel(record: AiGenerationTaskItem | null, step: number) {
  if (!record) {
    return ''
  }
  if (record.status === 'FAILED') {
    return record.currentStep === step ? '失败' : ''
  }
  if (record.status === 'COMPLETED') {
    return step === 4 ? '已完成' : ''
  }
  if (record.currentStep === step) {
    return '进行中'
  }
  return ''
}

function getEventLevelClass(event: AiGenerationTaskEventItem) {
  if (event.level === 'ERROR') {
    return 'is-error'
  }
  if (event.level === 'WARN') {
    return 'is-warning'
  }
  return 'is-info'
}

function getEventTime(value?: string | null) {
  if (!value) {
    return '--:--:--'
  }
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
}

function getCaseReviewStatusLabel(item: GeneratedAiCaseItem | null) {
  const status = item?.aiReviewStatus || 'PENDING'
  const map: Record<string, string> = {
    APPROVED: '通过',
    OPTIMIZED: '已优化',
    SUPPLEMENTED: '已补充',
    CONFIRM_REQUIRED: '建议确认',
    NOT_RECOMMENDED: '不推荐',
    SUGGESTED: '建议优化',
    REJECTED: '需重生成',
    PENDING: '待评审',
  }
  return map[status] || status
}

function getCaseReviewStatusTone(item: GeneratedAiCaseItem | null) {
  const status = item?.aiReviewStatus || 'PENDING'
  const map: Record<string, 'default' | 'primary' | 'warning' | 'success' | 'danger' | 'purple'> = {
    APPROVED: 'success',
    OPTIMIZED: 'warning',
    SUPPLEMENTED: 'primary',
    CONFIRM_REQUIRED: 'purple',
    NOT_RECOMMENDED: 'danger',
    SUGGESTED: 'warning',
    REJECTED: 'danger',
    PENDING: 'default',
  }
  return map[status] || 'default'
}

function getAiSourceLabel(item: GeneratedAiCaseItem | null) {
  const source = item?.aiSource || 'INITIAL'
  const map: Record<string, string> = {
    INITIAL: '初始生成',
    REVIEW_OPTIMIZED: '评审优化',
    REVIEW_SUPPLEMENTED: '评审补充',
  }
  return map[source] || source
}

function getAnalysisFields(item: GeneratedAiCaseItem | null) {
  if (!item) {
    return []
  }
  return [
    { label: '测试角度', value: item.testAngle },
    { label: '场景焦点', value: item.sceneFocus },
    { label: '生成原因', value: item.generationReason },
    { label: '需求依据', value: item.requirementEvidence },
    { label: 'AI 评审摘要', value: item.aiReviewSummary },
    { label: '覆盖性意见', value: item.aiCoverageComment },
    { label: '证据性意见', value: item.aiEvidenceComment },
  ].filter(field => field.value && field.value.trim())
}

function flattenDirectories(nodes: CaseDirectoryNode[], prefix = ''): DirectoryOption[] {
  return nodes.flatMap((node) => {
    const label = prefix ? `${prefix} / ${node.name}` : node.name
    return [
      { value: node.id, label },
      ...flattenDirectories(node.children ?? [], label),
    ]
  })
}

function stopPolling() {
  if (pollingTimer !== null) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
}

function startPolling() {
  stopPolling()
  pollingTimer = window.setInterval(() => {
    void loadRecords({ silent: true })
  }, 2500)
}

async function loadTaskDetail(taskId: string, workspaceCode: string) {
  return caseAiApi.getTask(workspaceCode, taskId)
}

async function refreshOpenedRecords() {
  if (processDialogVisible.value && processRecord.value) {
    processRecord.value = await loadTaskDetail(processRecord.value.taskId, processRecord.value.workspaceCode)
  }
  if (detailVisible.value && detailRecord.value) {
    detailRecord.value = await loadTaskDetail(detailRecord.value.taskId, detailRecord.value.workspaceCode)
    detailCaseIndex.value = Math.min(detailCaseIndex.value, Math.max(0, (detailRecord.value.generatedCases?.length ?? 1) - 1))
  }
  if (adoptDialogVisible.value && adoptRecord.value) {
    adoptRecord.value = await loadTaskDetail(adoptRecord.value.taskId, adoptRecord.value.workspaceCode)
  }
}

async function loadRecords(options?: { silent?: boolean }) {
  if (!options?.silent) {
    loading.value = true
  }
  errorMessage.value = ''
  try {
    records.value = await caseAiApi.listTasks(resolvedWorkspaceCode.value)
    hasLoaded.value = true
    const maxPage = Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value))
    if (pageNo.value > maxPage) {
      pageNo.value = maxPage
    }
    await refreshOpenedRecords()
    if (records.value.some(item => isRunningStatus(item.status))) {
      startPolling()
    } else {
      stopPolling()
    }
  } catch (error) {
    hasLoaded.value = true
    errorMessage.value = getRequestErrorMessage(error)
    stopPolling()
  } finally {
    if (!options?.silent) {
      loading.value = false
    }
  }
}

async function openProcessDialog(record: AiGenerationTaskItem) {
  processLoading.value = true
  processDialogVisible.value = true
  try {
    processRecord.value = await loadTaskDetail(record.taskId, record.workspaceCode)
  } catch (error) {
    processDialogVisible.value = false
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    processLoading.value = false
  }
}

async function cancelProcessTask() {
  if (!processRecord.value) {
    return
  }

  processPending.value = true
  try {
    processRecord.value = await caseAiApi.cancelTask(processRecord.value.workspaceCode, processRecord.value.taskId)
    await loadRecords({ silent: true })
    ElMessage.success('当前生成任务已取消')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    processPending.value = false
  }
}

async function retryTask(record: AiGenerationTaskItem) {
  processPending.value = true
  try {
    processRecord.value = await caseAiApi.retryTask(record.workspaceCode, record.taskId)
    processDialogVisible.value = true
    await loadRecords({ silent: true })
    ElMessage.success('已经创建新的重试任务，后台会继续执行')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    processPending.value = false
  }
}

async function cancelTask(record: AiGenerationTaskItem) {
  processPending.value = true
  try {
    await caseAiApi.cancelTask(record.workspaceCode, record.taskId)
    await loadRecords({ silent: true })
    ElMessage.success('当前生成任务已取消')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    processPending.value = false
  }
}

async function deleteTask(record: AiGenerationTaskItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除任务“${record.requirementTitle}”吗？`,
      '删除生成任务',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    )

    await caseAiApi.deleteTask(record.workspaceCode, record.taskId)
    if (processRecord.value?.taskId === record.taskId) {
      processDialogVisible.value = false
      processRecord.value = null
    }
    if (detailRecord.value?.taskId === record.taskId) {
      detailVisible.value = false
      detailRecord.value = null
    }
    if (adoptRecord.value?.taskId === record.taskId) {
      adoptDialogVisible.value = false
      adoptRecord.value = null
    }
    await loadRecords({ silent: true })
    ElMessage.success('生成任务已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

function moveDetailCase(offset: -1 | 1) {
  const nextIndex = detailCaseIndex.value + offset
  if (nextIndex < 0 || nextIndex >= detailCaseCount.value) {
    return
  }
  detailCaseIndex.value = nextIndex
}

async function openDetailDrawer(record: AiGenerationTaskItem) {
  detailLoading.value = true
  detailVisible.value = true
  detailActiveTab.value = 'detail'
  detailCaseIndex.value = 0
  try {
    detailRecord.value = await loadTaskDetail(record.taskId, record.workspaceCode)
  } catch (error) {
    detailVisible.value = false
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    detailLoading.value = false
  }
}

async function loadAdoptDirectories(workspaceCode: string) {
  const directories = await caseApi.getCaseDirectories(workspaceCode)
  const currentWorkspace = directories.find(item => item.workspaceCode === workspaceCode)
  adoptDirectoryOptions.value = flattenDirectories(currentWorkspace?.children ?? [])
}

async function openAdoptDialog(record: AiGenerationTaskItem) {
  adoptLoading.value = true
  adoptDialogVisible.value = true
  adoptPathTouched.value = false
  try {
    adoptRecord.value = await loadTaskDetail(record.taskId, record.workspaceCode)
    await loadAdoptDirectories(record.workspaceCode)
    adoptForm.directoryId = adoptRecord.value.directoryId ?? adoptDirectoryOptions.value[0]?.value ?? null
  } catch (error) {
    adoptDialogVisible.value = false
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    adoptLoading.value = false
  }
}

async function submitAdoptCases() {
  if (!adoptRecord.value) {
    return
  }
  if (adoptForm.directoryId == null) {
    adoptPathTouched.value = true
    ElMessage.warning('请选择保存目录')
    return
  }
  if (!adoptableCases.value.length) {
    ElMessage.info('当前没有可采纳的用例')
    return
  }

  adoptSubmitting.value = true
  try {
    const adoptCount = adoptableCases.value.length
    for (const entry of adoptableCases.value) {
      await caseApi.createCase(adoptRecord.value.workspaceCode, {
        workspaceCode: adoptRecord.value.workspaceCode,
        directoryId: adoptForm.directoryId,
        title: entry.item.title,
        caseType: entry.item.caseType || 'FUNCTIONAL',
        priority: entry.item.priority || 'P2',
        sourceType: 'AI生成',
        caseStatus: '草稿',
        ownerId: entry.item.ownerId ?? null,
        precondition: entry.item.precondition || '',
        steps: entry.item.steps || '',
        expectedResult: entry.item.expectedResult || '',
      })
    }

    const adoptedIndexes = new Set(adoptRecord.value.adoptedCaseIndexes ?? [])
    adoptableCases.value.forEach(entry => adoptedIndexes.add(entry.index))
    adoptRecord.value = await caseAiApi.updateTask(adoptRecord.value.workspaceCode, adoptRecord.value.taskId, {
      adoptedCaseIndexes: [...adoptedIndexes],
      savedCaseCount: adoptedIndexes.size,
    })
    adoptDialogVisible.value = false
    await loadRecords({ silent: true })
    ElMessage.success(`已采纳 ${adoptCount} 条用例到用例管理`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    adoptSubmitting.value = false
  }
}

function handlePrimaryAction(record: AiGenerationTaskItem) {
  if (record.status === 'COMPLETED') {
    void openAdoptDialog(record)
    return
  }
  if (record.status === 'FAILED') {
    void retryTask(record)
    return
  }
  void openProcessDialog(record)
}

function goToGeneratePage() {
  void router.push({
    name: 'cases-ai-generate',
    query: {
      ...route.query,
      workspace: resolvedWorkspaceCode.value,
    },
  })
}

loadTableSettings()

watch(filteredRecords, () => {
  const maxPage = Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value))
  if (pageNo.value > maxPage) {
    pageNo.value = maxPage
  }
})

watch(pageSize, () => {
  pageNo.value = 1
})

watch(() => resolvedWorkspaceCode.value, () => {
  statusFilter.value = ''
  pageNo.value = 1
  void loadRecords()
}, { immediate: true })

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <section class="case-ai-records-page">
    <div v-if="records.length" class="case-ai-records-page__stats">
      <AppCard class="case-ai-records-page__stat-card">
        <div class="case-ai-records-page__stat-value">{{ stats.total }}</div>
        <div class="case-ai-records-page__stat-label">任务总数</div>
      </AppCard>
      <AppCard class="case-ai-records-page__stat-card">
        <div class="case-ai-records-page__stat-value is-success">{{ stats.completed }}</div>
        <div class="case-ai-records-page__stat-label">已完成</div>
      </AppCard>
      <AppCard class="case-ai-records-page__stat-card">
        <div class="case-ai-records-page__stat-value is-primary">{{ stats.running }}</div>
        <div class="case-ai-records-page__stat-label">进行中</div>
      </AppCard>
      <AppCard class="case-ai-records-page__stat-card">
        <div class="case-ai-records-page__stat-value is-danger">{{ stats.failed }}</div>
        <div class="case-ai-records-page__stat-label">失败</div>
      </AppCard>
    </div>

    <AppCard class="case-ai-records-page__toolbar-card">
      <div class="case-ai-records-page__toolbar">
        <div class="case-ai-records-page__toolbar-left">
          <label class="case-ai-records-page__toolbar-label">状态筛选</label>
          <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 180px">
            <el-option label="任务创建中" value="PENDING" />
            <el-option label="生成中" value="GENERATING" />
            <el-option label="评审中" value="REVIEWING" />
            <el-option label="已完成" value="COMPLETED" />
            <el-option label="失败" value="FAILED" />
            <el-option label="已取消" value="CANCELED" />
          </el-select>
        </div>

        <div class="case-ai-records-page__toolbar-right">
          <AppButton :icon="RefreshRight" @click="loadRecords()">刷新</AppButton>
        </div>
      </div>
    </AppCard>

    <AppCard class="case-ai-records-page__table-card">
      <template v-if="errorMessage && !records.length && hasLoaded">
        <AppEmptyState
          title="生成记录加载失败"
          :description="errorMessage"
        >
          <template #actions>
            <AppButton :icon="RefreshRight" @click="loadRecords()">重试</AppButton>
          </template>
        </AppEmptyState>
      </template>

      <template v-else-if="loading && !hasLoaded">
        <AppLoadingState text="正在加载生成记录..." />
      </template>

      <template v-else-if="hasLoaded && !records.length">
        <AppEmptyState
          title="暂无生成任务"
          description="还没有 AI 生成用例任务，先去创建一个任务吧。"
        >
          <template #actions>
            <AppButton @click="goToGeneratePage">去 AI 生成用例</AppButton>
          </template>
        </AppEmptyState>
      </template>

      <template v-else>
        <div class="case-ai-records-page__table-wrap">
          <el-table
            v-loading="loading"
            :data="pagedRecords"
            row-key="taskId"
            class="case-ai-records-page__table"
          >
            <template v-for="column in visibleColumns" :key="column.key">
              <el-table-column
                :prop="column.key"
                :label="column.label"
                :width="column.width"
                :min-width="column.minWidth"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  <template v-if="column.key === 'taskId'">
                    <span class="case-ai-records-page__task-id">{{ row.taskId }}</span>
                  </template>

                  <template v-else-if="column.key === 'workspaceName'">
                    <span>{{ row.workspaceName || row.workspaceCode }}</span>
                  </template>

                  <template v-else-if="column.key === 'requirementTitle'">
                    <div class="case-ai-records-page__requirement-cell">
                      <span class="case-ai-records-page__requirement-title">{{ row.requirementTitle }}</span>
                      <span class="case-ai-records-page__requirement-subtext">
                        {{ row.createdByName || '-' }} · {{ formatDateTime(row.createdAt) }}
                      </span>
                    </div>
                  </template>

                  <template v-else-if="column.key === 'outputMode'">
                    <span>{{ getOutputModeLabel(row.outputMode) }}</span>
                  </template>

                  <template v-else-if="column.key === 'status'">
                    <AppStatusBadge
                      :label="getStatusLabel(row.status)"
                      :tone="getStatusTone(row.status)"
                    />
                  </template>

                  <template v-else-if="column.key === 'generatedCount'">
                    <span>{{ row.generatedCount ?? 0 }}</span>
                  </template>

                  <template v-else-if="column.key === 'savedCaseCount'">
                    <span>{{ row.savedCaseCount ?? 0 }}</span>
                  </template>

                  <template v-else-if="column.key === 'createdByName'">
                    <span>{{ row.createdByName || '-' }}</span>
                  </template>

                  <template v-else-if="column.key === 'createdAt'">
                    <span>{{ formatDateTime(row.createdAt) }}</span>
                  </template>

                  <template v-else-if="column.key === 'updatedAt'">
                    <span>{{ formatDateTime(row.updatedAt) }}</span>
                  </template>
                </template>
              </el-table-column>
            </template>

            <el-table-column fixed="right" width="250">
              <template #header>
                <div class="case-ai-records-page__action-header">
                  <span>操作</span>
                  <AppTableSettingsTrigger @click="settingsVisible = true" />
                </div>
              </template>

              <template #default="{ row }">
                <div class="case-ai-records-page__actions">
                  <el-button text type="primary" :icon="View" @click="openDetailDrawer(row)">
                    查看
                  </el-button>
                  <el-button text type="primary" @click="handlePrimaryAction(row)">
                    {{ getPrimaryActionLabel(row) }}
                  </el-button>

                  <el-dropdown trigger="click">
                    <el-button text type="primary" :icon="MoreFilled">
                      更多
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item
                          v-if="isRunningStatus(row.status)"
                          :icon="CircleClose"
                          @click="openProcessDialog(row)"
                        >
                          查看流程
                        </el-dropdown-item>
                        <el-dropdown-item
                          v-if="isRunningStatus(row.status)"
                          divided
                          :icon="CircleClose"
                          @click="cancelTask(row)"
                        >
                          取消任务
                        </el-dropdown-item>
                        <el-dropdown-item
                          v-if="row.status === 'FAILED'"
                          :icon="RefreshRight"
                          @click="retryTask(row)"
                        >
                          重新生成
                        </el-dropdown-item>
                        <el-dropdown-item
                          v-if="row.status === 'COMPLETED'"
                          :icon="FolderOpened"
                          @click="openAdoptDialog(row)"
                        >
                          全部采纳
                        </el-dropdown-item>
                        <el-dropdown-item
                          divided
                          :icon="Delete"
                          @click="deleteTask(row)"
                        >
                          删除
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="case-ai-records-page__pagination">
          <div class="case-ai-records-page__pagination-summary">
            共 {{ total }} 条 / {{ totalPages }} 页
          </div>
          <el-pagination
            v-model:current-page="pageNo"
            v-model:page-size="pageSize"
            :page-sizes="PAGE_SIZE_OPTIONS"
            size="small"
            layout="sizes, prev, pager, next, jumper"
            :total="total"
          />
        </div>
      </template>
    </AppCard>

    <AppTableColumnSettingsDrawer
      v-model="settingsVisible"
      :columns="drawerColumns"
      :dragging-key="draggingColumnKey"
      @toggle-column="toggleColumnVisibility"
      @drag-start="handleDragStart"
      @drag-end="handleDragEnd"
      @drop-column="moveColumnToTarget"
      @reset="resetTableSettings"
    />

    <el-dialog
      v-model="processDialogVisible"
      width="720px"
      destroy-on-close
      class="case-ai-records-page__process-dialog"
    >
      <template #header>
        <div class="case-ai-records-page__process-header">
          <div class="case-ai-records-page__process-title">生成流程</div>
          <div class="case-ai-records-page__process-subtitle">
            {{ processRecord?.requirementTitle || '正在加载任务信息...' }}
          </div>
        </div>
      </template>

      <AppLoadingState v-if="processLoading" text="正在加载流程信息..." />
      <template v-else-if="processRecord">
        <div class="case-ai-records-page__process-meta">
          <AppStatusBadge :label="getStatusLabel(processRecord.status)" :tone="getStatusTone(processRecord.status)" />
          <span>任务 ID：{{ processRecord.taskId }}</span>
          <span>更新时间：{{ formatDateTime(processRecord.updatedAt) }}</span>
        </div>

        <div class="case-ai-records-page__process-steps">
          <article
            v-for="step in processSteps"
            :key="step.index"
            :class="[
              'case-ai-records-page__process-step',
              {
                'is-active': isStepActive(processRecord, step.index),
                'is-done': isStepDone(processRecord, step.index),
                'is-failed': isStepFailed(processRecord, step.index),
              },
            ]"
          >
            <div class="case-ai-records-page__process-step-index">{{ step.index }}</div>
            <div>
              <div class="case-ai-records-page__process-step-title">
                {{ step.title }}
                <span v-if="getStepStatusLabel(processRecord, step.index)">
                  {{ getStepStatusLabel(processRecord, step.index) }}
                </span>
              </div>
              <div class="case-ai-records-page__process-step-desc">{{ step.description }}</div>
            </div>
          </article>
        </div>

        <div class="case-ai-records-page__process-current">
          <div class="case-ai-records-page__process-current-label">当前进度</div>
          <div class="case-ai-records-page__process-current-text">
            {{ processRecord.stepMessage || '等待任务执行...' }}
          </div>
        </div>

        <div v-if="processRecord.status === 'FAILED'" class="case-ai-records-page__process-failure">
          <div>失败阶段：{{ getFailureStepLabel(processRecord.currentStep ?? null) }}</div>
          <div>失败原因：{{ processRecord.errorMessage || processRecord.stepMessage || '-' }}</div>
        </div>
      </template>

      <template #footer>
        <div class="case-ai-records-page__dialog-footer">
          <AppButton
            v-if="processRecord && isRunningStatus(processRecord.status)"
            type="danger"
            :icon="CircleClose"
            :loading="processPending"
            @click="cancelProcessTask"
          >
            取消生成
          </AppButton>
          <AppButton @click="processDialogVisible = false">关闭</AppButton>
        </div>
      </template>
    </el-dialog>

    <AppDrawer
      v-model="detailVisible"
      title="生成记录详情"
      size="1080px"
      drawer-class="case-ai-records-page__detail-drawer-host"
    >
      <AppLoadingState v-if="detailLoading" text="正在加载任务详情..." />
      <template v-else-if="detailRecord">
        <div class="case-ai-records-page__detail-shell">
          <div class="case-ai-records-page__detail-header">
            <div class="case-ai-records-page__detail-title-block">
              <h3>{{ detailRecord.requirementTitle }}</h3>
              <div class="case-ai-records-page__detail-meta">
                <AppStatusBadge :label="getStatusLabel(detailRecord.status)" :tone="getStatusTone(detailRecord.status)" />
                <span>任务 ID：{{ detailRecord.taskId }}</span>
                <span>空间：{{ detailRecord.workspaceName || detailRecord.workspaceCode }}</span>
                <span>生成时间：{{ formatDateTime(detailRecord.createdAt) }}</span>
              </div>
            </div>

            <div class="case-ai-records-page__detail-actions">
              <AppButton :icon="View" @click="openProcessDialog(detailRecord)">查看流程</AppButton>
              <AppButton
                v-if="detailRecord.status === 'COMPLETED'"
                type="success"
                :icon="FolderOpened"
                @click="openAdoptDialog(detailRecord)"
              >
                全部采纳
              </AppButton>
              <AppButton
                v-else-if="detailRecord.status === 'FAILED'"
                type="warning"
                :icon="RefreshRight"
                @click="retryTask(detailRecord)"
              >
                重新生成
              </AppButton>
            </div>
          </div>

          <section v-if="detailEvents.length" class="case-ai-records-page__output-card">
            <div class="case-ai-records-page__output-head">
              <div>
                <h4>AI 输出记录</h4>
                <p>保留任务执行过程中的关键事件和生成反馈。</p>
              </div>
              <div class="case-ai-records-page__output-pills">
                <span>输出模式：{{ getOutputModeLabel(detailRecord.outputMode) }}</span>
                <span>生成用例：{{ detailRecord.generatedCount ?? 0 }}</span>
                <span>已采纳：{{ detailRecord.savedCaseCount ?? 0 }}</span>
              </div>
            </div>

            <div class="case-ai-records-page__output-log">
              <article
                v-for="event in detailEvents"
                :key="event.id"
                :class="['case-ai-records-page__output-row', getEventLevelClass(event)]"
              >
                <span class="case-ai-records-page__output-time">{{ getEventTime(event.createdAt) }}</span>
                <div class="case-ai-records-page__output-message">
                  <div>{{ event.message }}</div>
                  <small v-if="event.itemTitle">{{ event.itemTitle }}</small>
                </div>
              </article>
            </div>
          </section>

          <el-tabs v-model="detailActiveTab" class="case-ai-records-page__detail-tabs">
            <el-tab-pane label="用例详情" name="detail">
              <template v-if="activeGeneratedCase">
                <div class="case-ai-records-page__case-nav">
                  <div class="case-ai-records-page__case-nav-left">
                    <AppStatusBadge
                      :label="getCaseReviewStatusLabel(activeGeneratedCase)"
                      :tone="getCaseReviewStatusTone(activeGeneratedCase)"
                    />
                    <AppStatusBadge
                      :label="getAiSourceLabel(activeGeneratedCase)"
                      tone="default"
                    />
                  </div>
                  <div class="case-ai-records-page__case-nav-right">
                    <AppButton :disabled="!canPreviewPreviousCase" :icon="ArrowLeft" @click="moveDetailCase(-1)">
                      上一条
                    </AppButton>
                    <span>{{ detailCaseIndex + 1 }}/{{ detailCaseCount }}</span>
                    <AppButton :disabled="!canPreviewNextCase" :icon="ArrowRight" @click="moveDetailCase(1)">
                      下一条
                    </AppButton>
                  </div>
                </div>

                <div class="case-ai-records-page__detail-grid">
                  <article class="case-ai-records-page__detail-block case-ai-records-page__detail-block--full">
                    <div class="case-ai-records-page__detail-label">用例标题</div>
                    <div class="case-ai-records-page__detail-text">{{ formatMultilineText(activeGeneratedCase.title) }}</div>
                  </article>

                  <article class="case-ai-records-page__detail-block">
                    <div class="case-ai-records-page__detail-label">用例类型</div>
                    <div class="case-ai-records-page__detail-text">{{ formatMultilineText(activeGeneratedCase.caseType) }}</div>
                  </article>

                  <article class="case-ai-records-page__detail-block">
                    <div class="case-ai-records-page__detail-label">优先级</div>
                    <div class="case-ai-records-page__detail-text">{{ formatMultilineText(activeGeneratedCase.priority) }}</div>
                  </article>

                  <article class="case-ai-records-page__detail-block case-ai-records-page__detail-block--full">
                    <div class="case-ai-records-page__detail-label">前置条件</div>
                    <div class="case-ai-records-page__detail-text is-rich">{{ formatMultilineText(activeGeneratedCase.precondition) }}</div>
                  </article>

                  <article class="case-ai-records-page__detail-block case-ai-records-page__detail-block--full">
                    <div class="case-ai-records-page__detail-label">测试步骤</div>
                    <div class="case-ai-records-page__detail-text is-rich">{{ formatMultilineText(activeGeneratedCase.steps) }}</div>
                  </article>

                  <article class="case-ai-records-page__detail-block case-ai-records-page__detail-block--full">
                    <div class="case-ai-records-page__detail-label">预期结果</div>
                    <div class="case-ai-records-page__detail-text is-rich">{{ formatMultilineText(activeGeneratedCase.expectedResult) }}</div>
                  </article>
                </div>
              </template>

              <AppEmptyState
                v-else
                title="暂无生成用例"
                description="当前任务还没有可查看的生成结果。"
              />
            </el-tab-pane>

            <el-tab-pane label="AI 分析" name="analysis">
              <div class="case-ai-records-page__analysis-stack">
                <article v-if="detailRecord.reviewResult?.summary" class="case-ai-records-page__analysis-card">
                  <div class="case-ai-records-page__detail-label">总体评审结论</div>
                  <div class="case-ai-records-page__detail-text is-rich">{{ detailRecord.reviewResult.summary }}</div>
                </article>

                <article
                  v-for="field in getAnalysisFields(activeGeneratedCase)"
                  :key="field.label"
                  class="case-ai-records-page__analysis-card"
                >
                  <div class="case-ai-records-page__detail-label">{{ field.label }}</div>
                  <div class="case-ai-records-page__detail-text is-rich">{{ field.value }}</div>
                </article>

                <article
                  v-if="detailRecord.reviewResult?.issues?.length"
                  class="case-ai-records-page__analysis-card"
                >
                  <div class="case-ai-records-page__detail-label">问题项</div>
                  <ul class="case-ai-records-page__analysis-list">
                    <li v-for="item in detailRecord.reviewResult.issues" :key="item">{{ item }}</li>
                  </ul>
                </article>

                <article
                  v-if="detailRecord.reviewResult?.suggestions?.length"
                  class="case-ai-records-page__analysis-card"
                >
                  <div class="case-ai-records-page__detail-label">优化建议</div>
                  <ul class="case-ai-records-page__analysis-list">
                    <li v-for="item in detailRecord.reviewResult.suggestions" :key="item">{{ item }}</li>
                  </ul>
                </article>

                <article
                  v-if="detailRecord.reviewResult?.unresolvedCoverageGaps?.length"
                  class="case-ai-records-page__analysis-card"
                >
                  <div class="case-ai-records-page__detail-label">未覆盖缺口</div>
                  <ul class="case-ai-records-page__analysis-list">
                    <li v-for="item in detailRecord.reviewResult.unresolvedCoverageGaps" :key="item">{{ item }}</li>
                  </ul>
                </article>

                <article
                  v-if="detailRecord.invalidCases?.length"
                  class="case-ai-records-page__analysis-card"
                >
                  <div class="case-ai-records-page__detail-label">无效用例</div>
                  <ul class="case-ai-records-page__analysis-list">
                    <li v-for="item in detailRecord.invalidCases" :key="`${item.index}-${item.title}-${item.reason}`">
                      {{ item.title || `候选用例 ${item.index ?? '-'}` }}：{{ item.reason || '未提供原因' }}
                    </li>
                  </ul>
                </article>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </template>
    </AppDrawer>

    <el-dialog
      v-model="adoptDialogVisible"
      width="620px"
      destroy-on-close
      class="case-ai-records-page__adopt-dialog"
    >
      <template #header>
        <div class="case-ai-records-page__adopt-title">全部采纳</div>
      </template>

      <AppLoadingState v-if="adoptLoading" text="正在加载采纳信息..." />
      <template v-else-if="adoptRecord">
        <div class="case-ai-records-page__adopt-body">
          <div class="case-ai-records-page__adopt-notice">
            确认要采纳任务“{{ adoptRecord.requirementTitle }}”中剩余的 {{ adoptableCases.length }} 条用例吗？
          </div>

          <el-form label-position="top">
            <el-form-item required>
              <template #label>
                <span>保存目录 <span class="case-ai-records-page__required">*</span></span>
              </template>
              <el-select
                v-model="adoptForm.directoryId"
                placeholder="请选择保存目录"
                filterable
                clearable
                style="width: 100%"
                :class="{ 'is-invalid-select': adoptPathTouched && adoptForm.directoryId == null }"
              >
                <el-option
                  v-for="option in adoptDirectoryOptions"
                  :key="`${option.value}`"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <div v-if="adoptPathTouched && adoptForm.directoryId == null" class="case-ai-records-page__field-error">
                请选择保存目录
              </div>
            </el-form-item>
          </el-form>
        </div>
      </template>

      <template #footer>
        <div class="case-ai-records-page__dialog-footer">
          <AppButton @click="adoptDialogVisible = false">取消</AppButton>
          <AppButton
            type="success"
            :icon="FolderOpened"
            :loading="adoptSubmitting"
            @click="submitAdoptCases"
          >
            确认采纳
          </AppButton>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.case-ai-records-page {
  display: grid;
  align-content: start;
  gap: var(--app-space-4);
  min-width: 0;
  min-height: 0;
}

.case-ai-records-page__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-4);
}

.case-ai-records-page__stat-card :deep(.app-card__body) {
  display: grid;
  justify-items: center;
  gap: var(--app-space-2);
  padding: 24px 20px;
}

.case-ai-records-page__stat-value {
  color: var(--app-primary);
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
}

.case-ai-records-page__stat-value.is-success {
  color: var(--app-success);
}

.case-ai-records-page__stat-value.is-primary {
  color: var(--app-primary);
}

.case-ai-records-page__stat-value.is-danger {
  color: var(--app-danger);
}

.case-ai-records-page__stat-label {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-records-page__toolbar-card :deep(.app-card__body),
.case-ai-records-page__table-card :deep(.app-card__body) {
  padding: 20px 22px;
}

.case-ai-records-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  flex-wrap: wrap;
}

.case-ai-records-page__toolbar-left,
.case-ai-records-page__toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  flex-wrap: wrap;
}

.case-ai-records-page__toolbar-label {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-records-page__table-wrap {
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
}

.case-ai-records-page__table {
  width: 100%;
  min-width: 0;
}

.case-ai-records-page__table :deep(.el-table__header-wrapper th) {
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.case-ai-records-page__table :deep(.el-table__cell) {
  padding-top: 14px;
  padding-bottom: 14px;
}

.case-ai-records-page__table :deep(.el-table__fixed-right),
.case-ai-records-page__table :deep(.el-table-fixed-column--right),
.case-ai-records-page__table :deep(.el-table__fixed-right-patch) {
  background: var(--app-bg-panel);
  box-shadow: none;
}

.case-ai-records-page__table :deep(.el-table__fixed-right) {
  border-left: 1px solid var(--app-border-soft);
}

.case-ai-records-page__task-id {
  color: var(--app-text-main);
}

.case-ai-records-page__requirement-cell {
  display: grid;
  gap: 4px;
}

.case-ai-records-page__requirement-title {
  display: block;
  overflow: hidden;
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-records-page__requirement-subtext {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.case-ai-records-page__action-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.case-ai-records-page__actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.case-ai-records-page__actions :deep(.el-button) {
  margin-left: 0;
  font-size: 13px;
  font-weight: 400;
}

.case-ai-records-page__pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.case-ai-records-page__pagination-summary {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-records-page__process-header,
.case-ai-records-page__detail-title-block {
  display: grid;
  gap: 6px;
}

.case-ai-records-page__process-title,
.case-ai-records-page__adopt-title {
  color: var(--app-text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
}

.case-ai-records-page__process-subtitle {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-records-page__process-meta,
.case-ai-records-page__detail-meta,
.case-ai-records-page__output-pills {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.case-ai-records-page__process-meta,
.case-ai-records-page__detail-meta {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-records-page__process-steps {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.case-ai-records-page__process-step {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.82);
}

.case-ai-records-page__process-step.is-active {
  border-color: rgba(36, 107, 255, 0.36);
  background: rgba(233, 240, 255, 0.82);
}

.case-ai-records-page__process-step.is-done {
  border-color: rgba(20, 163, 109, 0.22);
}

.case-ai-records-page__process-step.is-failed {
  border-color: rgba(240, 68, 56, 0.26);
  background: rgba(254, 242, 242, 0.92);
}

.case-ai-records-page__process-step-index {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.case-ai-records-page__process-step-title {
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.case-ai-records-page__process-step-title span {
  margin-left: 8px;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.case-ai-records-page__process-step-desc,
.case-ai-records-page__process-current-text {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 22px;
}

.case-ai-records-page__process-current {
  margin-top: 18px;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
}

.case-ai-records-page__process-current-label,
.case-ai-records-page__detail-label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.case-ai-records-page__process-failure {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  padding: 14px;
  border: 1px solid rgba(240, 68, 56, 0.18);
  border-radius: 10px;
  background: rgba(254, 242, 242, 0.96);
  color: #7a271a;
  font-size: 13px;
  line-height: 22px;
}

.case-ai-records-page__dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.case-ai-records-page__detail-shell {
  display: grid;
  gap: 18px;
}

.case-ai-records-page__detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.case-ai-records-page__detail-title-block h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 22px;
  font-weight: 700;
  line-height: 30px;
}

.case-ai-records-page__detail-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.case-ai-records-page__output-card {
  padding: 18px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.case-ai-records-page__output-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.case-ai-records-page__output-head h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.case-ai-records-page__output-head p {
  margin: 6px 0 0;
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-records-page__output-pills {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.case-ai-records-page__output-log {
  max-height: 260px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-subtle);
}

.case-ai-records-page__output-row {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(234, 236, 240, 0.8);
}

.case-ai-records-page__output-row:last-child {
  border-bottom: 0;
}

.case-ai-records-page__output-time {
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}

.case-ai-records-page__output-message {
  display: grid;
  gap: 4px;
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 20px;
  word-break: break-word;
}

.case-ai-records-page__output-message small {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.case-ai-records-page__output-row.is-warning .case-ai-records-page__output-message {
  color: #b54708;
}

.case-ai-records-page__output-row.is-error .case-ai-records-page__output-message {
  color: #b42318;
}

.case-ai-records-page__case-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.case-ai-records-page__case-nav-left,
.case-ai-records-page__case-nav-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.case-ai-records-page__case-nav-right span {
  min-width: 56px;
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

.case-ai-records-page__detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.case-ai-records-page__detail-block,
.case-ai-records-page__analysis-card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.case-ai-records-page__detail-block--full {
  grid-column: 1 / -1;
}

.case-ai-records-page__detail-text {
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 22px;
  word-break: break-word;
}

.case-ai-records-page__detail-text.is-rich {
  min-height: 96px;
  padding: 14px 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
  white-space: pre-wrap;
}

.case-ai-records-page__analysis-stack {
  display: grid;
  gap: 14px;
}

.case-ai-records-page__analysis-list {
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 24px;
}

.case-ai-records-page__adopt-body {
  display: grid;
  gap: 18px;
}

.case-ai-records-page__adopt-notice {
  padding: 14px 16px;
  border: 1px solid rgba(59, 130, 246, 0.14);
  border-radius: 12px;
  background: rgba(239, 246, 255, 0.72);
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 22px;
}

.case-ai-records-page__required {
  color: var(--app-danger);
}

.case-ai-records-page__field-error {
  margin-top: 6px;
  color: var(--app-danger);
  font-size: 12px;
  line-height: 18px;
}

@media (max-width: 1280px) {
  .case-ai-records-page__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .case-ai-records-page__detail-header,
  .case-ai-records-page__output-head,
  .case-ai-records-page__case-nav {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 900px) {
  .case-ai-records-page__stats,
  .case-ai-records-page__detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
