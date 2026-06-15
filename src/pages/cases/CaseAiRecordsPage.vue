<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type HistoryState } from 'vue-router'
import { CircleClose, FolderOpened, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { caseAiApi, type AiGenerationTaskItem } from '@/entities/case-ai'
import { caseApi, type CaseDirectoryNode, type SaveCasePayload } from '@/entities/case'
import { useWorkspaceContext } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppCard from '@/shared/ui/app-card/AppCard.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'
import { loadCaseAiRecordListContext, saveCaseAiRecordListContext } from './caseAiRecordContext'

type TaskStatus = AiGenerationTaskItem['status']
type ColumnKey =
  | 'taskId'
  | 'workspaceName'
  | 'requirementTitle'
  | 'outputMode'
  | 'status'
  | 'generatedCount'
  | 'savedCaseCount'
  | 'createdAt'
  | 'createdByName'
  | 'updatedAt'
  | 'updatedByName'
  | 'directoryName'

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

interface PathPickerNode {
  key: string
  id: number | null
  name: string
  fullPath: string
  selectable: boolean
  children: PathPickerNode[]
}

const TABLE_SETTINGS_STORAGE_KEY = 'case-ai-record-table-settings-v2'
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50]

const route = useRoute()
const router = useRouter()
const { selectedWorkspaceCode } = useWorkspaceContext()

const tableColumns: ColumnDefinition[] = [
  { key: 'taskId', label: '任务 ID', minWidth: 180, required: true, defaultVisible: true },
  { key: 'workspaceName', label: '所属空间', minWidth: 140, defaultVisible: true },
  { key: 'requirementTitle', label: '关联需求', minWidth: 300, required: true, defaultVisible: true },
  { key: 'outputMode', label: '输出模式', width: 132, defaultVisible: true },
  { key: 'status', label: '状态', minWidth: 110, defaultVisible: true },
  { key: 'generatedCount', label: '生成用例数', width: 110, defaultVisible: true },
  { key: 'savedCaseCount', label: '已采纳数', width: 98, defaultVisible: false },
  { key: 'createdAt', label: '生成时间', minWidth: 168, defaultVisible: true },
  { key: 'createdByName', label: '创建人', minWidth: 120, defaultVisible: false },
  { key: 'updatedAt', label: '更新时间', minWidth: 168, defaultVisible: false },
  { key: 'updatedByName', label: '更新人', minWidth: 120, defaultVisible: false },
  { key: 'directoryName', label: '当前采纳路径', minWidth: 220, defaultVisible: false },
]

const processSteps = [
  { index: 1 as const, title: '任务已创建', description: '已经记录需求内容、目标空间和输出模式。' },
  { index: 2 as const, title: 'AI 生成用例', description: '正在根据需求生成候选测试用例。' },
  { index: 3 as const, title: 'AI 自动评审', description: '正在汇总评审意见、优化建议和补充结论。' },
  { index: 4 as const, title: '任务完成', description: '生成结果已经进入 AI 生成记录，可继续查看和采纳。' },
]

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
const processLoading = ref(false)
const processPending = ref(false)
const processRecord = ref<AiGenerationTaskItem | null>(null)

const adoptDialogVisible = ref(false)
const adoptPathPickerVisible = ref(false)
const adoptLoading = ref(false)
const adoptSubmitting = ref(false)
const loadingDirectories = ref(false)
const adoptRecord = ref<AiGenerationTaskItem | null>(null)
const adoptDirectoryOptions = ref<DirectoryOption[]>([])
const adoptDirectoryTree = ref<CaseDirectoryNode[]>([])
const adoptPathTouched = ref(false)
const adoptPathPickerKeyword = ref('')
const adoptPathPickerDirectoryId = ref<number | null>(null)
const adoptForm = reactive({
  directoryId: null as number | null,
})

let pollingTimer: number | null = null

const runningStatuses: TaskStatus[] = ['PENDING', 'GENERATING', 'REVIEWING']

const resolvedWorkspaceCode = computed(() => {
  const routeWorkspace = Array.isArray(route.query.workspace) ? route.query.workspace[0] : route.query.workspace
  return routeWorkspace || selectedWorkspaceCode.value || 'ALL'
})

const filteredRecords = computed(() => {
  if (!statusFilter.value) {
    return records.value
  }
  return records.value.filter(item => item.status === statusFilter.value)
})

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

const orderedColumns = computed(() => columnOrder.value
  .map(key => tableColumns.find(column => column.key === key))
  .filter((column): column is ColumnDefinition => Boolean(column)))

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

const activeRecordWorkspaceName = computed(() => (
  adoptRecord.value?.workspaceName || adoptRecord.value?.workspaceCode || ''
))

const adoptPathPickerTree = computed<PathPickerNode[]>(() => {
  if (!adoptRecord.value?.workspaceCode || !activeRecordWorkspaceName.value) {
    return []
  }

  const buildChildren = (nodes: CaseDirectoryNode[], prefix = ''): PathPickerNode[] => nodes.map((node) => {
    const fullPath = prefix ? `${prefix} / ${node.name}` : node.name
    return {
      key: `dir:${node.id}`,
      id: node.id,
      name: node.name,
      fullPath,
      selectable: true,
      children: buildChildren(node.children ?? [], fullPath),
    }
  })

  return [{
    key: `workspace:${adoptRecord.value.workspaceCode}`,
    id: null,
    name: activeRecordWorkspaceName.value,
    fullPath: activeRecordWorkspaceName.value,
    selectable: false,
    children: buildChildren(adoptDirectoryTree.value),
  }]
})

const filteredAdoptPathPickerTree = computed(() => {
  const keyword = adoptPathPickerKeyword.value.trim().toLowerCase()

  const filterNodes = (nodes: PathPickerNode[]): PathPickerNode[] => nodes.reduce<PathPickerNode[]>((result, node) => {
    const children = filterNodes(node.children ?? [])
    const matched = !keyword || node.name.toLowerCase().includes(keyword) || node.fullPath.toLowerCase().includes(keyword)
    if (matched || children.length) {
      result.push({
        ...node,
        children,
      })
    }
    return result
  }, [])

  return filterNodes(adoptPathPickerTree.value)
})

const selectedAdoptPathLabel = computed(() => {
  const selected = adoptDirectoryOptions.value.find(item => item.value === adoptForm.directoryId)
  const path = selected?.label ?? (adoptRecord.value?.directoryName || '')
  return path && activeRecordWorkspaceName.value ? `${activeRecordWorkspaceName.value} / ${path}` : path
})

const selectedAdoptPathPickerLabel = computed(() => {
  const selected = adoptDirectoryOptions.value.find(item => item.value === adoptPathPickerDirectoryId.value)
  const path = selected?.label ?? ''
  return path && activeRecordWorkspaceName.value ? `${activeRecordWorkspaceName.value} / ${path}` : path
})

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

function saveCurrentContext() {
  saveCaseAiRecordListContext({
    workspaceCode: resolvedWorkspaceCode.value,
    statusFilter: statusFilter.value,
    pageNo: pageNo.value,
    pageSize: pageSize.value,
    columnOrder: [...columnOrder.value],
    columnVisibility: Object.fromEntries(
      Object.entries(columnVisibility.value).map(([key, value]) => [key, Boolean(value)]),
    ),
  })
}

function restoreListContext() {
  const context = loadCaseAiRecordListContext()
  if (!context || context.workspaceCode !== resolvedWorkspaceCode.value) {
    return
  }

  statusFilter.value = context.statusFilter || ''
  pageNo.value = context.pageNo > 0 ? context.pageNo : 1
  pageSize.value = PAGE_SIZE_OPTIONS.includes(context.pageSize) ? context.pageSize : 10
  if (context.columnOrder.length) {
    columnOrder.value = normalizeColumnOrder(context.columnOrder.filter(isColumnKey))
  }
  if (Object.keys(context.columnVisibility).length) {
    columnVisibility.value = {
      ...columnVisibility.value,
      ...Object.fromEntries(
        Object.entries(context.columnVisibility)
          .filter(([key]) => isColumnKey(key))
          .map(([key, value]) => [key as ColumnKey, Boolean(value)]),
      ),
    }
  }
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function getStatusLabel(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    PENDING: '需求解析中',
    GENERATING: '生成中',
    REVIEWING: '评审中',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELED: '已取消',
  }
  return map[status] ?? status
}

function getStatusClass(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    PENDING: 'status-info',
    GENERATING: 'status-info',
    REVIEWING: 'status-warning',
    COMPLETED: 'status-success',
    FAILED: 'status-danger',
    CANCELED: 'status-neutral',
  }
  return map[status] ?? 'status-neutral'
}

function getOutputModeLabel(outputMode: string) {
  return outputMode === 'STREAM' ? '实时流式输出' : '完整输出'
}

function getPrimaryActionLabel(status: TaskStatus) {
  if (status === 'COMPLETED') {
    return '全部采纳'
  }
  if (status === 'FAILED') {
    return '重新生成'
  }
  return '查看流程'
}

function getPrimaryActionType(status: TaskStatus) {
  if (status === 'COMPLETED') {
    return 'success'
  }
  if (status === 'FAILED') {
    return 'warning'
  }
  return 'primary'
}

function getDefaultDirectoryPath(record: AiGenerationTaskItem) {
  if (!record.directoryName) {
    return '未设置默认路径'
  }
  const workspaceLabel = record.workspaceName || record.workspaceCode
  return workspaceLabel ? `${workspaceLabel} / ${record.directoryName}` : record.directoryName
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

function isRunningStatus(status: TaskStatus) {
  return runningStatuses.includes(status)
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

async function refreshOpenedDialogs() {
  if (processDialogVisible.value && processRecord.value) {
    processRecord.value = await loadTaskDetail(processRecord.value.taskId, processRecord.value.workspaceCode)
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
    await refreshOpenedDialogs()
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

function openDetailPage(record: AiGenerationTaskItem) {
  saveCurrentContext()
  void router.push({
    name: 'cases-ai-record-detail',
    params: { taskId: record.taskId },
    query: { workspace: record.workspaceCode },
    state: {
      recordSnapshot: JSON.parse(JSON.stringify(record)) as Record<string, unknown>,
    } as unknown as HistoryState,
  })
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
    ElMessage.success('已取消当前生成任务')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    processPending.value = false
  }
}

async function retryTask(record: AiGenerationTaskItem) {
  try {
    processRecord.value = await caseAiApi.retryTask(record.workspaceCode, record.taskId)
    processDialogVisible.value = true
    await loadRecords({ silent: true })
    ElMessage.success('已创建新的重试任务，后台会继续执行')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
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

async function deleteTask(record: AiGenerationTaskItem) {
  await ElMessageBox.confirm(
    '确定删除本次生成任务和所有用例吗？',
    '删除生成任务',
    {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
    },
  )

  try {
    await caseAiApi.deleteTask(record.workspaceCode, record.taskId)
    if (processRecord.value?.taskId === record.taskId) {
      processDialogVisible.value = false
      processRecord.value = null
    }
    if (adoptRecord.value?.taskId === record.taskId) {
      adoptDialogVisible.value = false
      adoptRecord.value = null
    }
    await loadRecords({ silent: true })
    ElMessage.success('生成任务已删除')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function loadDirectoryOptions(record: AiGenerationTaskItem) {
  loadingDirectories.value = true
  try {
    const workspaces = await caseApi.getCaseDirectories(record.workspaceCode)
    const current = workspaces.find(item => item.workspaceCode === record.workspaceCode)
    adoptDirectoryTree.value = current?.children ?? []
    adoptDirectoryOptions.value = flattenDirectories(adoptDirectoryTree.value)
    adoptForm.directoryId = record.directoryId ?? adoptDirectoryOptions.value[0]?.value ?? null
  } catch (error) {
    adoptDirectoryTree.value = []
    adoptDirectoryOptions.value = []
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingDirectories.value = false
  }
}

async function openAdoptDialog(record: AiGenerationTaskItem) {
  adoptLoading.value = true
  adoptDialogVisible.value = true
  adoptPathTouched.value = false
  adoptPathPickerVisible.value = false
  adoptPathPickerKeyword.value = ''
  adoptPathPickerDirectoryId.value = null

  try {
    adoptRecord.value = await loadTaskDetail(record.taskId, record.workspaceCode)
    await loadDirectoryOptions(adoptRecord.value)
    adoptPathPickerDirectoryId.value = adoptForm.directoryId
  } catch (error) {
    adoptDialogVisible.value = false
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    adoptLoading.value = false
  }
}

function openAdoptPathPicker() {
  adoptPathPickerKeyword.value = ''
  adoptPathPickerDirectoryId.value = adoptForm.directoryId
  adoptPathPickerVisible.value = true
}

function handleAdoptPathPickerNodeSelect(node: PathPickerNode) {
  if (!node.selectable) {
    return
  }
  adoptPathPickerDirectoryId.value = node.id
}

function confirmAdoptPathPicker() {
  if (adoptPathPickerDirectoryId.value == null) {
    ElMessage.warning('请选择保存路径')
    return
  }
  adoptPathTouched.value = true
  adoptForm.directoryId = adoptPathPickerDirectoryId.value
  adoptPathPickerVisible.value = false
}

async function submitAdoptCases() {
  if (!adoptRecord.value) {
    ElMessage.warning('当前任务记录不存在，请关闭弹窗后重试')
    return
  }
  if (adoptForm.directoryId == null) {
    adoptPathTouched.value = true
    ElMessage.warning('请选择保存路径')
    return
  }
  if (!adoptableCases.value.length) {
    ElMessage.info('当前没有可采纳的用例')
    return
  }

  const adoptCount = adoptableCases.value.length
  adoptSubmitting.value = true

  try {
    for (const entry of adoptableCases.value) {
      const payload: SaveCasePayload = {
        directoryId: adoptForm.directoryId,
        title: entry.item.title,
        caseType: entry.item.caseType || '功能测试',
        priority: entry.item.priority || 'P2',
        sourceType: 'AI生成',
        caseStatus: '草稿',
        ownerId: null,
        precondition: entry.item.precondition || '',
        steps: entry.item.steps || '',
        expectedResult: entry.item.expectedResult || '',
      }
      await caseApi.createCase(adoptRecord.value.workspaceCode, payload)
    }

    const adoptedIndexes = new Set(adoptRecord.value.adoptedCaseIndexes ?? [])
    adoptableCases.value.forEach(entry => adoptedIndexes.add(entry.index))
    adoptRecord.value = await caseAiApi.updateTask(adoptRecord.value.workspaceCode, adoptRecord.value.taskId, {
      directoryId: adoptForm.directoryId,
      directoryName: adoptDirectoryOptions.value.find(item => item.value === adoptForm.directoryId)?.label ?? adoptRecord.value.directoryName,
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

watch(filteredRecords, () => {
  const maxPage = Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value))
  if (pageNo.value > maxPage) {
    pageNo.value = maxPage
  }
  if (pageNo.value < 1) {
    pageNo.value = 1
  }
})

watch(
  () => [resolvedWorkspaceCode.value, statusFilter.value, pageNo.value, pageSize.value, columnOrder.value.join(','), JSON.stringify(columnVisibility.value)],
  () => {
    saveCurrentContext()
  },
)

watch(resolvedWorkspaceCode, () => {
  restoreListContext()
  pageNo.value = 1
  void loadRecords()
})

onMounted(() => {
  loadTableSettings()
  restoreListContext()
  void loadRecords()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <section class="case-ai-records-page">
    <AppCard v-if="records.length" class="case-ai-records-page__stats-card">
      <div class="case-ai-records-page__stats">
        <div class="case-ai-records-page__stat-item">
          <div class="case-ai-records-page__stat-value">{{ stats.total }}</div>
          <div class="case-ai-records-page__stat-label">任务总数</div>
        </div>
        <div class="case-ai-records-page__stat-item">
          <div class="case-ai-records-page__stat-value is-success">{{ stats.completed }}</div>
          <div class="case-ai-records-page__stat-label">已完成</div>
        </div>
        <div class="case-ai-records-page__stat-item">
          <div class="case-ai-records-page__stat-value is-primary">{{ stats.running }}</div>
          <div class="case-ai-records-page__stat-label">进行中</div>
        </div>
        <div class="case-ai-records-page__stat-item">
          <div class="case-ai-records-page__stat-value is-danger">{{ stats.failed }}</div>
          <div class="case-ai-records-page__stat-label">失败</div>
        </div>
      </div>
    </AppCard>

    <AppCard class="case-ai-records-page__filter-card">
      <div class="case-ai-records-page__filter-row">
        <div class="case-ai-records-page__filter-item">
          <span class="case-ai-records-page__filter-label">状态筛选：</span>
          <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 180px">
            <el-option label="需求解析中" value="PENDING" />
            <el-option label="生成中" value="GENERATING" />
            <el-option label="评审中" value="REVIEWING" />
            <el-option label="已完成" value="COMPLETED" />
            <el-option label="失败" value="FAILED" />
            <el-option label="已取消" value="CANCELED" />
          </el-select>
          <el-button :icon="RefreshRight" @click="loadRecords">刷新</el-button>
        </div>
      </div>
    </AppCard>

    <AppCard class="case-ai-records-page__table-card">
      <AppLoadingState v-if="loading && !hasLoaded" text="正在加载生成记录..." />

      <div v-else-if="errorMessage && !records.length" class="case-ai-records-page__state">
        <AppEmptyState title="加载生成记录失败" :description="errorMessage">
          <template #actions>
            <AppButton @click="loadRecords">重试</AppButton>
          </template>
        </AppEmptyState>
      </div>

      <div v-else-if="records.length" class="case-ai-records-page__table-shell">
        <div class="case-ai-records-page__table-wrap">
          <el-table
            :data="pagedRecords"
            class="case-ai-records-page__table"
            row-key="taskId"
            border
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
                    </div>
                  </template>

                  <template v-else-if="column.key === 'outputMode'">
                    <span>{{ getOutputModeLabel(row.outputMode) }}</span>
                  </template>

                  <template v-else-if="column.key === 'status'">
                    <span class="case-ai-records-page__status-pill" :class="getStatusClass(row.status)">
                      {{ getStatusLabel(row.status) }}
                    </span>
                  </template>

                  <template v-else-if="column.key === 'generatedCount'">
                    <span class="case-ai-records-page__count-pill">{{ row.generatedCount ?? 0 }}</span>
                  </template>

                  <template v-else-if="column.key === 'savedCaseCount'">
                    <span class="case-ai-records-page__count-pill case-ai-records-page__count-pill--success">
                      {{ row.savedCaseCount ?? 0 }}
                    </span>
                  </template>

                  <template v-else-if="column.key === 'createdAt'">
                    <span>{{ formatDateTime(row.createdAt) }}</span>
                  </template>

                  <template v-else-if="column.key === 'createdByName'">
                    <span>{{ row.createdByName || '-' }}</span>
                  </template>

                  <template v-else-if="column.key === 'updatedAt'">
                    <span>{{ formatDateTime(row.updatedAt) }}</span>
                  </template>

                  <template v-else-if="column.key === 'updatedByName'">
                    <span>{{ row.updatedByName || '-' }}</span>
                  </template>

                  <template v-else-if="column.key === 'directoryName'">
                    <span class="case-ai-records-page__muted-text">{{ getDefaultDirectoryPath(row) }}</span>
                  </template>
                </template>
              </el-table-column>
            </template>

            <el-table-column width="220" fixed="right" align="center">
              <template #header>
                <div class="case-ai-records-page__action-header">
                  <span>操作</span>
                  <AppTableSettingsTrigger @click="settingsVisible = true" />
                </div>
              </template>
              <template #default="{ row }">
                <div class="case-ai-records-page__actions">
                  <el-button text type="primary" @click="openDetailPage(row)">查看详情</el-button>
                  <el-button
                    text
                    :type="getPrimaryActionType(row.status)"
                    @click="handlePrimaryAction(row)"
                  >
                    {{ getPrimaryActionLabel(row.status) }}
                  </el-button>
                  <el-button text type="danger" @click="deleteTask(row)">删除</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="case-ai-records-page__pagination">
          <div class="case-ai-records-page__pagination-summary">共 {{ total }} 条 / {{ totalPages }} 页</div>
          <el-pagination
            v-model:current-page="pageNo"
            v-model:page-size="pageSize"
            :page-sizes="PAGE_SIZE_OPTIONS"
            :pager-count="7"
            size="small"
            layout="sizes, prev, pager, next, jumper"
            :total="total"
          />
        </div>
      </div>

      <div v-else class="case-ai-records-page__state">
        <AppEmptyState
          title="暂无生成任务"
          description="还没有 AI 生成用例任务，先去 AI 生成用例页创建一个任务。"
        >
          <template #actions>
            <AppButton @click="router.push({ name: 'cases-ai-generate', query: { workspace: resolvedWorkspaceCode } })">
              去 AI 生成用例
            </AppButton>
          </template>
        </AppEmptyState>
      </div>
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
          <span class="case-ai-records-page__status-pill" :class="getStatusClass(processRecord.status)">
            {{ getStatusLabel(processRecord.status) }}
          </span>
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
          <div class="case-ai-records-page__detail-label">当前进度</div>
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
            <div class="case-ai-records-page__adopt-copy">
              {{ `确定要全部采纳任务 "${adoptRecord.requirementTitle}" 的 ${adoptableCases.length} 条用例吗？` }}
            </div>
            <div class="case-ai-records-page__adopt-subcopy">
              采纳后会把本次任务中可用的生成用例统一保存到用例管理中。
            </div>
          </div>

          <div class="case-ai-records-page__adopt-form-card">
            <div class="case-ai-records-page__adopt-form-title">保存配置</div>
            <el-form label-position="top">
              <el-form-item required>
                <template #label>
                  <span>保存路径 <span class="case-ai-records-page__required">*</span></span>
                </template>
                <div class="case-ai-records-page__path-trigger" :class="{ 'is-invalid': adoptPathTouched && adoptForm.directoryId == null }">
                  <div class="case-ai-records-page__path-trigger-value">
                    {{ selectedAdoptPathLabel || '请选择保存路径' }}
                  </div>
                  <el-tooltip content="选择保存路径" placement="top">
                    <button type="button" class="case-ai-records-page__path-trigger-button" @click="openAdoptPathPicker">
                      <el-icon><FolderOpened /></el-icon>
                    </button>
                  </el-tooltip>
                </div>
                <div v-if="adoptPathTouched && adoptForm.directoryId == null" class="case-ai-records-page__field-error">
                  请选择保存路径
                </div>
              </el-form-item>
            </el-form>
          </div>
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

    <el-dialog
      v-model="adoptPathPickerVisible"
      width="720px"
      destroy-on-close
      class="case-ai-records-page__path-picker-dialog"
    >
      <template #header>
        <div class="case-ai-records-page__adopt-title">选择保存路径</div>
      </template>

      <div class="case-ai-records-page__path-picker-layout">
        <el-input
          v-model="adoptPathPickerKeyword"
          clearable
          placeholder="搜索目录名称"
          class="case-ai-records-page__path-picker-search"
        />

        <div class="case-ai-records-page__path-picker-tree-panel">
          <div v-if="loadingDirectories" class="case-ai-records-page__path-picker-empty">正在加载目录...</div>
          <div v-else-if="!filteredAdoptPathPickerTree.length" class="case-ai-records-page__path-picker-empty">
            未找到匹配的目录
          </div>
          <el-tree
            v-else
            :data="filteredAdoptPathPickerTree"
            node-key="key"
            highlight-current
            :expand-on-click-node="false"
            :default-expanded-keys="adoptRecord?.workspaceCode ? [`workspace:${adoptRecord.workspaceCode}`] : []"
            :current-node-key="adoptPathPickerDirectoryId != null ? `dir:${adoptPathPickerDirectoryId}` : undefined"
            class="case-ai-records-page__path-picker-tree"
            @node-click="handleAdoptPathPickerNodeSelect"
          >
            <template #default="{ data }">
              <div class="case-ai-records-page__path-picker-node" :class="{ 'is-workspace': !data.selectable }">
                <span>{{ data.name }}</span>
              </div>
            </template>
          </el-tree>
        </div>

        <div class="case-ai-records-page__path-picker-selected">
          <div class="case-ai-records-page__path-picker-selected-label">已选路径</div>
          <div class="case-ai-records-page__path-picker-selected-value">
            {{ selectedAdoptPathPickerLabel || '请在上方目录树中选择保存路径' }}
          </div>
        </div>
      </div>

      <template #footer>
        <div class="case-ai-records-page__dialog-footer">
          <AppButton @click="adoptPathPickerVisible = false">取消</AppButton>
          <AppButton
            type="primary"
            :icon="FolderOpened"
            :disabled="adoptPathPickerDirectoryId == null"
            @click="confirmAdoptPathPicker"
          >
            确认选择
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
  gap: 16px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.case-ai-records-page :deep(.app-card__body) {
  padding: 20px 22px;
}

.case-ai-records-page__stats-card,
.case-ai-records-page__filter-card,
.case-ai-records-page__table-card {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.case-ai-records-page__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.case-ai-records-page__stat-item {
  text-align: center;
}

.case-ai-records-page__stat-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  color: var(--app-primary);
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
  margin-top: 10px;
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-records-page__filter-row,
.case-ai-records-page__filter-item,
.case-ai-records-page__actions,
.case-ai-records-page__dialog-footer,
.case-ai-records-page__process-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.case-ai-records-page__filter-label {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-records-page__state {
  min-height: 420px;
  display: grid;
  align-items: center;
}

.case-ai-records-page__table-shell {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.case-ai-records-page__table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-gutter: stable;
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

.case-ai-records-page__task-id,
.case-ai-records-page__requirement-title {
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-records-page__requirement-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-records-page__muted-text {
  color: var(--app-text-muted);
}

.case-ai-records-page__status-pill,
.case-ai-records-page__count-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.case-ai-records-page__count-pill {
  min-width: 34px;
  padding: 0 10px;
  background: rgba(59, 130, 246, 0.12);
  color: var(--app-primary-hover);
}

.case-ai-records-page__count-pill--success {
  background: rgba(22, 163, 74, 0.12);
  color: #067647;
}

.status-info {
  background: rgba(219, 234, 254, 0.92);
  color: #175cd3;
}

.status-warning {
  background: rgba(255, 245, 223, 0.92);
  color: #b54708;
}

.status-success {
  background: rgba(233, 248, 241, 0.92);
  color: #067647;
}

.status-danger {
  background: rgba(254, 228, 226, 0.92);
  color: #b42318;
}

.status-neutral {
  background: rgba(242, 244, 247, 0.96);
  color: #475467;
}

.case-ai-records-page__action-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.case-ai-records-page__actions {
  justify-content: center;
  flex-wrap: nowrap;
  gap: 0;
}

.case-ai-records-page__actions :deep(.el-button) {
  margin-left: 0;
  font-size: 13px;
}

.case-ai-records-page__table :deep(.el-table__fixed-right .cell) {
  padding-left: 8px;
  padding-right: 8px;
}

.case-ai-records-page__pagination {
  display: flex;
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

.case-ai-records-page__process-header {
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

.case-ai-records-page__process-subtitle,
.case-ai-records-page__process-step-desc,
.case-ai-records-page__process-current-text,
.case-ai-records-page__adopt-copy,
.case-ai-records-page__adopt-subcopy {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 22px;
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

.case-ai-records-page__process-current {
  margin-top: 18px;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
}

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

.case-ai-records-page__adopt-body {
  display: grid;
  gap: 18px;
}

.case-ai-records-page__adopt-notice {
  padding: 14px 16px;
  border: 1px solid rgba(59, 130, 246, 0.14);
  border-radius: 12px;
  background: rgba(239, 246, 255, 0.72);
}

.case-ai-records-page__adopt-subcopy {
  margin-top: 8px;
}

.case-ai-records-page__adopt-form-card {
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: #ffffff;
}

.case-ai-records-page__adopt-form-title {
  margin-bottom: 14px;
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 700;
}

.case-ai-records-page__required {
  color: var(--app-danger);
}

.case-ai-records-page__path-trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  background: #ffffff;
}

.case-ai-records-page__path-trigger.is-invalid {
  border-color: var(--app-danger);
}

.case-ai-records-page__path-trigger-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-records-page__path-trigger-button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.case-ai-records-page__path-trigger-button:hover {
  background: rgba(15, 23, 42, 0.06);
  color: #175cd3;
}

.case-ai-records-page__field-error {
  margin-top: 6px;
  color: var(--app-danger);
  font-size: 12px;
  line-height: 18px;
}

.case-ai-records-page__path-picker-layout {
  display: grid;
  gap: 16px;
}

.case-ai-records-page__path-picker-tree-panel {
  min-height: 320px;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: #ffffff;
}

.case-ai-records-page__path-picker-empty {
  min-height: 296px;
  display: grid;
  place-items: center;
  color: var(--app-text-subtle);
  font-size: 13px;
  text-align: center;
}

.case-ai-records-page__path-picker-node {
  display: flex;
  align-items: center;
  min-height: 34px;
  width: 100%;
  color: var(--app-text-main);
  font-size: 13px;
}

.case-ai-records-page__path-picker-node.is-workspace {
  font-weight: 700;
  color: var(--app-text-primary);
}

.case-ai-records-page__path-picker-selected {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.case-ai-records-page__path-picker-selected-label {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.case-ai-records-page__path-picker-selected-value {
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 22px;
  word-break: break-word;
}

@media (max-width: 1200px) {
  .case-ai-records-page__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .case-ai-records-page__stats {
    grid-template-columns: 1fr;
  }
}
</style>
