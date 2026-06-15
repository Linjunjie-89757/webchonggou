<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type HistoryState } from 'vue-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CircleClose,
  CopyDocument,
  Download,
  FolderOpened,
  Memo,
  RefreshRight,
  View,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { caseAiApi, type AiGenerationTaskItem, type GeneratedAiCaseItem } from '@/entities/case-ai'
import { caseApi, type CaseDirectoryNode, type SaveCasePayload } from '@/entities/case'
import { useSession } from '@/entities/session'
import { useWorkspaceContext } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppCard from '@/shared/ui/app-card/AppCard.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'

type DetailCaseRow = GeneratedAiCaseItem & {
  index: number
  adopted: boolean
  deleted: boolean
}

type CaseReviewState = 'PENDING' | 'ADOPTED' | 'DISCARDED'
type DetailColumnKey =
  | 'title'
  | 'precondition'
  | 'steps'
  | 'expectedResult'
  | 'savedDirectoryName'
  | 'priority'
  | 'aiReview'
  | 'status'
  | 'manualEdited'
  | 'manualEditedByName'

interface ColumnDefinition {
  key: DetailColumnKey
  label: string
  width?: number
  minWidth?: number
  required?: boolean
  defaultVisible?: boolean
}

interface PersistedTableSettings {
  columnVisibility?: Partial<Record<DetailColumnKey, boolean>>
  columnOrder?: DetailColumnKey[]
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

const TABLE_SETTINGS_STORAGE_KEY = 'case-ai-record-detail-table-settings-v1'

const route = useRoute()
const router = useRouter()
const { selectedWorkspaceCode } = useWorkspaceContext()
const { currentUser } = useSession()

const detailColumns: ColumnDefinition[] = [
  { key: 'title', label: '用例标题', minWidth: 220, required: true, defaultVisible: true },
  { key: 'precondition', label: '前置条件', minWidth: 220, required: true, defaultVisible: true },
  { key: 'steps', label: '操作步骤', minWidth: 260, required: true, defaultVisible: true },
  { key: 'expectedResult', label: '预期结果', minWidth: 240, required: true, defaultVisible: true },
  { key: 'savedDirectoryName', label: '最终保存路径', minWidth: 180, defaultVisible: true },
  { key: 'priority', label: '优先级', width: 88, defaultVisible: true },
  { key: 'aiReview', label: 'AI评审', width: 132, defaultVisible: true },
  { key: 'status', label: '状态', width: 100, defaultVisible: true },
  { key: 'manualEdited', label: '人工修改', width: 88, defaultVisible: false },
  { key: 'manualEditedByName', label: '操作人', width: 120, defaultVisible: false },
]

const processSteps = [
  { key: 'GENERATING', label: '用例生成' },
  { key: 'REVIEWING', label: 'AI评审' },
]

const loading = ref(true)
const errorMessage = ref('')
const detailRecord = ref<AiGenerationTaskItem | null>(null)
const requirementExpanded = ref(false)
const previewVisible = ref(false)
const previewActiveTab = ref<'detail' | 'analysis'>('detail')
const activeCaseCursor = ref(-1)
const selectedCaseIndexes = ref<number[]>([])

const settingsVisible = ref(false)
const draggingColumnKey = ref<DetailColumnKey | null>(null)
const columnVisibility = ref<Partial<Record<DetailColumnKey, boolean>>>({})
const columnOrder = ref<DetailColumnKey[]>([])

const processDialogVisible = ref(false)
const processLoading = ref(false)
const processPending = ref(false)
const processRecord = ref<AiGenerationTaskItem | null>(null)

const pathDialogVisible = ref(false)
const pathDialogLoading = ref(false)
const pathSubmitting = ref(false)
const pathTouched = ref(false)
const pathPickerVisible = ref(false)
const pathPickerKeyword = ref('')
const pathPickerDirectoryId = ref<number | null>(null)
const pathDirectoryTree = ref<CaseDirectoryNode[]>([])
const pathDirectoryOptions = ref<DirectoryOption[]>([])
const pathForm = reactive({
  directoryId: null as number | null,
})

const adoptDialogVisible = ref(false)
const adoptDialogLoading = ref(false)
const adoptSubmitting = ref(false)
const adoptDialogMode = ref<'all' | 'selected'>('selected')
const adoptDirectoryTree = ref<CaseDirectoryNode[]>([])
const adoptDirectoryOptions = ref<DirectoryOption[]>([])
const adoptPathTouched = ref(false)
const adoptPickerVisible = ref(false)
const adoptPickerKeyword = ref('')
const adoptPickerDirectoryId = ref<number | null>(null)
const adoptForm = reactive({
  directoryId: null as number | null,
})

const caseEditing = ref(false)
const savingCaseEdit = ref(false)
const caseEditForm = reactive({
  title: '',
  priority: 'P2',
  precondition: '',
  steps: '',
  expectedResult: '',
})

let pollingTimer: number | null = null

const resolvedWorkspaceCode = computed(() => {
  const queryWorkspace = Array.isArray(route.query.workspace) ? route.query.workspace[0] : route.query.workspace
  const snapshotWorkspace = (window.history.state?.recordSnapshot as AiGenerationTaskItem | undefined)?.workspaceCode
  return queryWorkspace || snapshotWorkspace || selectedWorkspaceCode.value || 'ALL'
})

const orderedColumns = computed(() => columnOrder.value
  .map(key => detailColumns.find(column => column.key === key))
  .filter((column): column is ColumnDefinition => Boolean(column)))

const visibleColumns = computed(() => orderedColumns.value.filter(column => (
  column.required || Boolean(columnVisibility.value[column.key])
)))

const dataGridTemplateColumns = computed(() => [
  '52px',
  '72px',
  ...visibleColumns.value.map((column) => {
    if (typeof column.width === 'number') {
      return `${column.width}px`
    }
    if (typeof column.minWidth === 'number') {
      return `${column.minWidth}px`
    }
    return '120px'
  }),
].join(' '))

const dataGridMinWidth = computed(() => {
  const width = visibleColumns.value.reduce((total, column) => {
    if (typeof column.width === 'number') {
      return total + column.width
    }
    if (typeof column.minWidth === 'number') {
      return total + column.minWidth
    }
    return total + 120
  }, 52 + 72)
  return `${width}px`
})

const drawerColumns = computed(() => orderedColumns.value.map(column => ({
  key: column.key,
  label: column.label,
  required: Boolean(column.required),
  visible: column.required ? true : Boolean(columnVisibility.value[column.key]),
  draggable: !column.required,
})))

const detailCases = computed<DetailCaseRow[]>(() => {
  const record = detailRecord.value
  if (!record) {
    return []
  }
  const adoptedIndexes = new Set(record.adoptedCaseIndexes ?? [])
  const deletedIndexes = new Set(record.deletedCaseIndexes ?? [])
  return record.generatedCases.map((item, index) => ({
    ...item,
    index,
    adopted: adoptedIndexes.has(index),
    deleted: deletedIndexes.has(index),
  }))
})

const activeCase = computed(() => detailCases.value[activeCaseCursor.value] ?? null)
const canPreviewPreviousCase = computed(() => activeCaseCursor.value > 0)
const canPreviewNextCase = computed(() => activeCaseCursor.value >= 0 && activeCaseCursor.value < detailCases.value.length - 1)
const selectedCases = computed(() => detailCases.value.filter(item => selectedCaseIndexes.value.includes(item.index)))
const allCurrentPageSelected = computed(() => detailCases.value.length > 0
  && detailCases.value.every(item => selectedCaseIndexes.value.includes(item.index)))
const currentPageSelectionIndeterminate = computed(() => selectedCaseIndexes.value.length > 0 && !allCurrentPageSelected.value)
const selectedAdoptableCases = computed(() => selectedCases.value.filter(item => getCaseReviewState(item) === 'PENDING'))
const selectedDiscardableCases = computed(() => selectedCases.value.filter(item => getCaseReviewState(item) === 'PENDING'))
const adoptableCases = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'PENDING'))
const pendingCaseCount = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'PENDING').length)
const adoptedCaseCount = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'ADOPTED').length)
const discardedCaseCount = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'DISCARDED').length)
const initialCaseCount = computed(() => detailCases.value.filter(item => item.aiSource === 'INITIAL').length)
const optimizedCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'OPTIMIZED').length)
const supplementedCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'SUPPLEMENTED' || item.aiSource === 'REVIEW_SUPPLEMENTED').length)
const confirmRequiredCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'CONFIRM_REQUIRED').length)
const notRecommendedCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'NOT_RECOMMENDED').length)

const outputEvents = computed(() => [...(detailRecord.value?.events ?? [])].sort((left, right) => (left.seq ?? 0) - (right.seq ?? 0)))
const showTaskOutputBoard = computed(() => Boolean(detailRecord.value && (
  detailRecord.value.status === 'FAILED'
  || detailRecord.value.status === 'COMPLETED'
  || ['PENDING', 'GENERATING', 'REVIEWING'].includes(detailRecord.value.status)
)))

const generationModelInfo = computed(() => {
  const event = [...outputEvents.value].reverse().find(item => item.phase === 'GENERATING' && (item.provider || item.model))
  return {
    provider: event?.provider || detailRecord.value?.provider || '',
    model: event?.model || detailRecord.value?.model || '',
  }
})

const reviewModelInfo = computed(() => {
  const event = [...outputEvents.value].reverse().find(item => item.phase === 'REVIEWING' && (item.provider || item.model))
  return {
    provider: event?.provider || '',
    model: event?.model || '',
  }
})

const outputConnectionLabel = computed(() => {
  if (!detailRecord.value) {
    return '-'
  }
  if (['PENDING', 'GENERATING', 'REVIEWING'].includes(detailRecord.value.status)) {
    return detailRecord.value.outputMode === 'STREAM' ? '实时流式' : '轮询刷新'
  }
  return '未连接'
})

const outputTimeline = computed(() => {
  const currentStep = detailRecord.value?.currentStep ?? 1
  return processSteps.map((item, index) => ({
    ...item,
    active: currentStep === index + 2 && detailRecord.value?.status !== 'COMPLETED' && detailRecord.value?.status !== 'FAILED',
    done: detailRecord.value?.status === 'COMPLETED'
      ? true
      : currentStep > index + 2,
  }))
})

const adoptPathPickerTree = computed<PathPickerNode[]>(() => {
  if (!detailRecord.value?.workspaceCode) {
    return []
  }
  return [{
    key: `workspace:${detailRecord.value.workspaceCode}`,
    id: null,
    name: detailRecord.value.workspaceName || detailRecord.value.workspaceCode,
    fullPath: detailRecord.value.workspaceName || detailRecord.value.workspaceCode,
    selectable: false,
    children: buildPathPickerChildren(adoptDirectoryTree.value),
  }]
})

const filteredAdoptPathPickerTree = computed(() => {
  const keyword = adoptPickerKeyword.value.trim().toLowerCase()
  return filterPathPickerTree(adoptPathPickerTree.value, keyword)
})

const pathPickerTree = computed<PathPickerNode[]>(() => {
  if (!detailRecord.value?.workspaceCode) {
    return []
  }
  return [{
    key: `workspace:${detailRecord.value.workspaceCode}`,
    id: null,
    name: detailRecord.value.workspaceName || detailRecord.value.workspaceCode,
    fullPath: detailRecord.value.workspaceName || detailRecord.value.workspaceCode,
    selectable: false,
    children: buildPathPickerChildren(pathDirectoryTree.value),
  }]
})

const filteredPathPickerTree = computed(() => {
  const keyword = pathPickerKeyword.value.trim().toLowerCase()
  return filterPathPickerTree(pathPickerTree.value, keyword)
})

function buildPathPickerChildren(nodes: CaseDirectoryNode[], prefix = ''): PathPickerNode[] {
  return nodes.map((node) => {
    const fullPath = prefix ? `${prefix} / ${node.name}` : node.name
    return {
      key: `dir:${node.id}`,
      id: node.id,
      name: node.name,
      fullPath,
      selectable: true,
      children: buildPathPickerChildren(node.children ?? [], fullPath),
    }
  })
}

function filterPathPickerTree(nodes: PathPickerNode[], keyword: string): PathPickerNode[] {
  return nodes.reduce<PathPickerNode[]>((result, node) => {
    const children = filterPathPickerTree(node.children ?? [], keyword)
    const matched = !keyword || node.name.toLowerCase().includes(keyword) || node.fullPath.toLowerCase().includes(keyword)
    if (matched || children.length) {
      result.push({ ...node, children })
    }
    return result
  }, [])
}

function getDefaultColumnOrder() {
  const required = detailColumns.filter(column => column.required).map(column => column.key)
  const optional = detailColumns.filter(column => !column.required).map(column => column.key)
  return [...required, ...optional]
}

function normalizeColumnOrder(nextOrder?: DetailColumnKey[]) {
  const requiredKeys = detailColumns.filter(column => column.required).map(column => column.key)
  const optionalKeys = detailColumns.filter(column => !column.required).map(column => column.key)
  const preferredOptionalOrder = (nextOrder ?? []).filter(key => optionalKeys.includes(key))
  const remainingOptionalKeys = optionalKeys.filter(key => !preferredOptionalOrder.includes(key))
  return [...requiredKeys, ...preferredOptionalOrder, ...remainingOptionalKeys]
}

function buildDefaultColumnVisibility() {
  return detailColumns.reduce<Partial<Record<DetailColumnKey, boolean>>>((result, column) => {
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
    columnVisibility.value = detailColumns.reduce<Partial<Record<DetailColumnKey, boolean>>>((result, column) => {
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

function isColumnKey(key: string): key is DetailColumnKey {
  return detailColumns.some(column => column.key === key)
}

function toggleColumnVisibility(key: string, value: boolean | string | number) {
  if (!isColumnKey(key)) {
    return
  }
  const column = detailColumns.find(item => item.key === key)
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
  const column = detailColumns.find(item => item.key === key)
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

  const sourceColumn = detailColumns.find(item => item.key === sourceKey)
  const targetColumn = detailColumns.find(item => item.key === targetKey)
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

function formatTime(value?: string | null) {
  if (!value) {
    return '--:--:--'
  }
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
}

function formatMultilineText(value?: string | null) {
  return value?.trim() || '-'
}

function formatCaseCellText(value?: string | null) {
  return value?.trim() || '-'
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    PENDING: '需求解析中',
    GENERATING: '生成中',
    REVIEWING: '评审中',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELED: '已取消',
  }
  return map[status] || status
}

function getStatusClass(status: string) {
  const map: Record<string, string> = {
    PENDING: 'status-info',
    GENERATING: 'status-info',
    REVIEWING: 'status-warning',
    COMPLETED: 'status-success',
    FAILED: 'status-danger',
    CANCELED: 'status-neutral',
  }
  return map[status] || 'status-neutral'
}

function getOutputModeLabel(outputMode?: string | null) {
  return outputMode === 'STREAM' ? '实时流式输出' : '完整输出'
}

function formatModelDisplay(provider?: string | null, model?: string | null) {
  const parts = [provider, model].filter(Boolean)
  return parts.length ? parts.join(' / ') : '-'
}

function getOutputConnectionClass() {
  if (!detailRecord.value) {
    return 'status-neutral'
  }
  if (['PENDING', 'GENERATING', 'REVIEWING'].includes(detailRecord.value.status)) {
    return detailRecord.value.outputMode === 'STREAM' ? 'status-success' : 'status-warning'
  }
  return 'status-neutral'
}

function getOutputEventClass(level?: string | null) {
  if (level === 'ERROR') {
    return 'is-error'
  }
  if (level === 'WARN') {
    return 'is-warn'
  }
  if (level === 'SUCCESS') {
    return 'is-success'
  }
  return 'is-info'
}

function getFailureStageLabel(record: AiGenerationTaskItem) {
  const labelMap: Record<number, string> = {
    1: '任务创建',
    2: 'AI 生成用例',
    3: 'AI 自动评审',
    4: '任务完成',
  }
  return labelMap[record.currentStep ?? 0] || '当前阶段'
}

function getFailureSuggestions(record: AiGenerationTaskItem) {
  const list = [
    '先检查 AI 配置页里的生成模型和评审模型是否可用。',
    '如果需求过长，先精简需求描述，再重新生成。',
    '如果是模型波动，可直接点击“重新生成”再试一次。',
  ]
  if (record.cancelRequested) {
    return ['当前任务已标记为取消，确认不需要继续生成后可关闭此记录。']
  }
  return list
}

function getCaseReviewState(row: DetailCaseRow | null | undefined): CaseReviewState {
  if (!row) {
    return 'PENDING'
  }
  if (row.adopted) {
    return 'ADOPTED'
  }
  if (row.deleted) {
    return 'DISCARDED'
  }
  return 'PENDING'
}

function getCaseReviewStateLabel(row: DetailCaseRow | null | undefined) {
  const state = getCaseReviewState(row)
  if (state === 'ADOPTED') {
    return '已采纳'
  }
  if (state === 'DISCARDED') {
    return '已弃用'
  }
  return '未处理'
}

function getCaseReviewStateClass(row: DetailCaseRow | null | undefined) {
  const state = getCaseReviewState(row)
  if (state === 'ADOPTED') {
    return 'status-success'
  }
  if (state === 'DISCARDED') {
    return 'status-neutral'
  }
  return 'status-info'
}

function getAiReviewListLabel(row: DetailCaseRow) {
  const map: Record<string, string> = {
    APPROVED: '通过',
    OPTIMIZED: '已优化',
    SUPPLEMENTED: '已补充',
    CONFIRM_REQUIRED: '建议确认',
    NOT_RECOMMENDED: '不推荐',
    PENDING: '待评审',
  }
  return map[row.aiReviewStatus || 'PENDING'] || (row.aiReviewStatus || '待评审')
}

function getAiReviewListClass(row: DetailCaseRow) {
  const map: Record<string, string> = {
    APPROVED: 'status-success',
    OPTIMIZED: 'status-warning',
    SUPPLEMENTED: 'status-info',
    CONFIRM_REQUIRED: 'status-purple',
    NOT_RECOMMENDED: 'status-danger',
    PENDING: 'status-neutral',
  }
  return map[row.aiReviewStatus || 'PENDING'] || 'status-neutral'
}

function getAiSourceLabel(row: DetailCaseRow | null | undefined) {
  const source = row?.aiSource || 'INITIAL'
  const map: Record<string, string> = {
    INITIAL: '初始生成',
    REVIEW_OPTIMIZED: '评审优化',
    REVIEW_SUPPLEMENTED: '评审补充',
  }
  return map[source] || source
}

function getCaseSavedDirectoryName(row: DetailCaseRow) {
  if (row.adopted) {
    return detailRecord.value?.directoryName || '当前任务默认路径'
  }
  return detailRecord.value?.directoryName || '未采纳'
}

function getAnalysisFields(row: DetailCaseRow | null) {
  if (!row) {
    return []
  }

  return [
    { label: '测试角度', value: row.testAngle },
    { label: '生成原因', value: row.generationReason },
    { label: '需求依据', value: row.requirementEvidence },
    { label: '评审意见', value: row.reviewComment },
    { label: '优化原因', value: row.optimizationReason },
    { label: '补充原因', value: row.supplementReason },
    { label: '覆盖缺口', value: row.coverageGap },
    { label: 'AI 评审摘要', value: row.aiReviewSummary },
    { label: '覆盖性意见', value: row.aiCoverageComment },
    { label: '证据性意见', value: row.aiEvidenceComment },
    { label: '风险提示', value: row.riskNotes },
  ].filter(field => field.value && field.value.trim())
}

function getDefaultDirectoryPath(record: AiGenerationTaskItem) {
  if (!record.directoryName) {
    return '未设置默认路径'
  }
  const workspaceLabel = record.workspaceName || record.workspaceCode
  return workspaceLabel ? `${workspaceLabel} / ${record.directoryName}` : record.directoryName
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function syncCaseEditForm(row: DetailCaseRow | null) {
  caseEditForm.title = row?.title || ''
  caseEditForm.priority = row?.priority || 'P2'
  caseEditForm.precondition = row?.precondition || ''
  caseEditForm.steps = row?.steps || ''
  caseEditForm.expectedResult = row?.expectedResult || ''
}

function stopPolling() {
  if (pollingTimer != null) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
}

function startPolling() {
  stopPolling()
  pollingTimer = window.setInterval(() => {
    void loadRecord({ silent: true })
  }, 2500)
}

async function loadRecord(options?: { silent?: boolean }) {
  const taskId = String(route.params.taskId || '')
  if (!taskId) {
    errorMessage.value = '缺少任务 ID'
    loading.value = false
    return
  }

  if (!options?.silent) {
    loading.value = true
  }
  errorMessage.value = ''

  try {
    detailRecord.value = await caseAiApi.getTask(resolvedWorkspaceCode.value, taskId)
    if (!detailCases.value.length) {
      activeCaseCursor.value = -1
      previewVisible.value = false
    } else if (activeCaseCursor.value < 0) {
      activeCaseCursor.value = 0
    } else if (activeCaseCursor.value >= detailCases.value.length) {
      activeCaseCursor.value = detailCases.value.length - 1
    }

    if (['PENDING', 'GENERATING', 'REVIEWING'].includes(detailRecord.value.status)) {
      startPolling()
    } else {
      stopPolling()
    }
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
    detailRecord.value = null
    stopPolling()
  } finally {
    if (!options?.silent) {
      loading.value = false
    }
  }
}

function goBack() {
  void router.push({
    name: 'cases-ai-records',
    query: {
      workspace: resolvedWorkspaceCode.value !== 'ALL' ? resolvedWorkspaceCode.value : undefined,
    },
  })
}

async function copyRequirementContent() {
  if (!detailRecord.value?.requirementContent) {
    return
  }
  try {
    await navigator.clipboard.writeText(detailRecord.value.requirementContent)
    ElMessage.success('需求描述已复制')
  } catch {
    ElMessage.error('复制失败，请稍后重试')
  }
}

async function openProcessDialog() {
  if (!detailRecord.value) {
    return
  }
  processLoading.value = true
  processDialogVisible.value = true
  try {
    processRecord.value = await caseAiApi.getTask(detailRecord.value.workspaceCode, detailRecord.value.taskId)
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
    await loadRecord({ silent: true })
    ElMessage.success('已取消当前生成任务')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    processPending.value = false
  }
}

async function retryTask() {
  if (!detailRecord.value) {
    return
  }
  try {
    const next = await caseAiApi.retryTask(detailRecord.value.workspaceCode, detailRecord.value.taskId)
    void router.replace({
      name: 'cases-ai-record-detail',
      params: { taskId: next.taskId },
      query: { workspace: next.workspaceCode },
      state: {
        recordSnapshot: JSON.parse(JSON.stringify(next)) as Record<string, unknown>,
      } as unknown as HistoryState,
    })
    await loadRecord()
    ElMessage.success('已创建新的重试任务，后台会继续执行')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function loadDirectoryOptions(target: 'path' | 'adopt') {
  if (!detailRecord.value) {
    return
  }

  const workspaces = await caseApi.getCaseDirectories(detailRecord.value.workspaceCode)
  const current = workspaces.find(item => item.workspaceCode === detailRecord.value?.workspaceCode)
  const tree = current?.children ?? []
  const options = flattenDirectories(tree)

  if (target === 'path') {
    pathDirectoryTree.value = tree
    pathDirectoryOptions.value = options
    pathForm.directoryId = detailRecord.value.directoryId ?? options[0]?.value ?? null
  } else {
    adoptDirectoryTree.value = tree
    adoptDirectoryOptions.value = options
    adoptForm.directoryId = detailRecord.value.directoryId ?? options[0]?.value ?? null
  }
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

async function openPathDialog() {
  if (!detailRecord.value) {
    return
  }
  pathDialogLoading.value = true
  pathDialogVisible.value = true
  pathTouched.value = false
  pathPickerVisible.value = false
  pathPickerKeyword.value = ''
  pathPickerDirectoryId.value = null

  try {
    await loadDirectoryOptions('path')
    pathPickerDirectoryId.value = pathForm.directoryId
  } catch (error) {
    pathDialogVisible.value = false
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    pathDialogLoading.value = false
  }
}

function openPathPicker() {
  pathPickerKeyword.value = ''
  pathPickerDirectoryId.value = pathForm.directoryId
  pathPickerVisible.value = true
}

function handlePathPickerNodeSelect(node: PathPickerNode) {
  if (!node.selectable) {
    return
  }
  pathPickerDirectoryId.value = node.id
}

function confirmPathPickerSelection() {
  if (pathPickerDirectoryId.value == null) {
    ElMessage.warning('请先选择保存路径')
    return
  }
  pathTouched.value = true
  pathForm.directoryId = pathPickerDirectoryId.value
  pathPickerVisible.value = false
}

async function submitPathChange() {
  if (!detailRecord.value) {
    return
  }
  if (pathForm.directoryId == null) {
    pathTouched.value = true
    ElMessage.warning('请选择保存路径')
    return
  }

  pathSubmitting.value = true
  try {
    const directoryName = pathDirectoryOptions.value.find(item => item.value === pathForm.directoryId)?.label ?? detailRecord.value.directoryName
    detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
      directoryId: pathForm.directoryId,
      directoryName,
    })
    pathDialogVisible.value = false
    ElMessage.success('保存路径已更新')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    pathSubmitting.value = false
  }
}

async function openAdoptDialog(mode: 'all' | 'selected' = 'selected') {
  if (!detailRecord.value) {
    return
  }
  if (mode === 'selected' && !selectedAdoptableCases.value.length) {
    ElMessage.info(selectedCaseIndexes.value.length ? '当前选中的用例里没有可采纳项' : '请先勾选需要采纳的用例')
    return
  }

  adoptDialogMode.value = mode
  adoptDialogLoading.value = true
  adoptDialogVisible.value = true
  adoptPathTouched.value = false
  adoptPickerVisible.value = false
  adoptPickerKeyword.value = ''
  adoptPickerDirectoryId.value = null

  try {
    detailRecord.value = await caseAiApi.getTask(detailRecord.value.workspaceCode, detailRecord.value.taskId)
    await loadDirectoryOptions('adopt')
    adoptPickerDirectoryId.value = adoptForm.directoryId
  } catch (error) {
    adoptDialogVisible.value = false
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    adoptDialogLoading.value = false
  }
}

function openAdoptPicker() {
  adoptPickerKeyword.value = ''
  adoptPickerDirectoryId.value = adoptForm.directoryId
  adoptPickerVisible.value = true
}

function handleAdoptPickerNodeSelect(node: PathPickerNode) {
  if (!node.selectable) {
    return
  }
  adoptPickerDirectoryId.value = node.id
}

function confirmAdoptPickerSelection() {
  if (adoptPickerDirectoryId.value == null) {
    ElMessage.warning('请先选择保存路径')
    return
  }
  adoptPathTouched.value = true
  adoptForm.directoryId = adoptPickerDirectoryId.value
  adoptPickerVisible.value = false
}

function getCasesToAdopt() {
  return adoptDialogMode.value === 'selected' ? selectedAdoptableCases.value : adoptableCases.value
}

async function submitAdoptCases() {
  if (!detailRecord.value) {
    ElMessage.warning('当前任务记录不存在，请刷新后重试')
    return
  }
  if (adoptForm.directoryId == null) {
    adoptPathTouched.value = true
    ElMessage.warning('请选择保存路径')
    return
  }

  const casesToAdopt = getCasesToAdopt()
  if (!casesToAdopt.length) {
    ElMessage.info('当前没有可采纳的用例')
    return
  }

  adoptSubmitting.value = true
  try {
    for (const row of casesToAdopt) {
      const payload: SaveCasePayload = {
        directoryId: adoptForm.directoryId,
        title: row.title,
        caseType: row.caseType || '功能测试',
        priority: row.priority || 'P2',
        sourceType: 'AI生成',
        caseStatus: '草稿',
        ownerId: null,
        precondition: row.precondition || '',
        steps: row.steps || '',
        expectedResult: row.expectedResult || '',
      }
      await caseApi.createCase(detailRecord.value.workspaceCode, payload)
    }

    const adoptedIndexes = new Set(detailRecord.value.adoptedCaseIndexes ?? [])
    const deletedIndexes = new Set(detailRecord.value.deletedCaseIndexes ?? [])
    casesToAdopt.forEach(row => {
      adoptedIndexes.add(row.index)
      deletedIndexes.delete(row.index)
    })

    detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
      directoryId: adoptForm.directoryId,
      directoryName: adoptDirectoryOptions.value.find(item => item.value === adoptForm.directoryId)?.label ?? detailRecord.value.directoryName,
      adoptedCaseIndexes: [...adoptedIndexes],
      deletedCaseIndexes: [...deletedIndexes],
      savedCaseCount: adoptedIndexes.size,
    })
    selectedCaseIndexes.value = selectedCaseIndexes.value.filter(index => !casesToAdopt.some(row => row.index === index))
    adoptDialogVisible.value = false
    ElMessage.success(`已采纳 ${casesToAdopt.length} 条用例`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    adoptSubmitting.value = false
  }
}

async function discardSingleCase(row: DetailCaseRow) {
  if (!detailRecord.value || getCaseReviewState(row) !== 'PENDING') {
    return
  }
  const deleted = new Set(detailRecord.value.deletedCaseIndexes ?? [])
  deleted.add(row.index)
  detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
    deletedCaseIndexes: [...deleted],
  })
  ElMessage.success('用例已弃用')
}

async function discardSelectedCases() {
  if (!detailRecord.value) {
    return
  }
  if (!selectedDiscardableCases.value.length) {
    ElMessage.info(selectedCaseIndexes.value.length ? '当前选中的用例里没有可弃用项' : '请先勾选需要弃用的用例')
    return
  }

  await ElMessageBox.confirm(
    `确定弃用已选中的 ${selectedDiscardableCases.value.length} 条生成用例吗？弃用后仍可恢复。`,
    '批量弃用用例',
    {
      type: 'warning',
      confirmButtonText: '确认弃用',
      cancelButtonText: '取消',
    },
  )

  const deleted = new Set(detailRecord.value.deletedCaseIndexes ?? [])
  selectedDiscardableCases.value.forEach(row => deleted.add(row.index))
  detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
    deletedCaseIndexes: [...deleted],
  })
  selectedCaseIndexes.value = selectedCaseIndexes.value.filter(index => !selectedDiscardableCases.value.some(row => row.index === index))
  ElMessage.success(`已弃用 ${selectedDiscardableCases.value.length} 条生成用例`)
}

async function restoreSingleCase(row: DetailCaseRow) {
  if (!detailRecord.value || getCaseReviewState(row) !== 'DISCARDED') {
    return
  }
  const deleted = new Set(detailRecord.value.deletedCaseIndexes ?? [])
  deleted.delete(row.index)
  detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
    deletedCaseIndexes: [...deleted],
  })
  ElMessage.success('已取消弃用')
}

async function adoptSingleCase(row: DetailCaseRow) {
  if (!detailRecord.value || getCaseReviewState(row) !== 'PENDING') {
    return
  }
  if (!detailRecord.value.directoryId) {
    ElMessage.warning('请先设置保存路径，再采纳用例')
    return
  }

  const payload: SaveCasePayload = {
    directoryId: detailRecord.value.directoryId,
    title: row.title,
    caseType: row.caseType || '功能测试',
    priority: row.priority || 'P2',
    sourceType: 'AI生成',
    caseStatus: '草稿',
    ownerId: null,
    precondition: row.precondition || '',
    steps: row.steps || '',
    expectedResult: row.expectedResult || '',
  }

  await caseApi.createCase(detailRecord.value.workspaceCode, payload)
  const adopted = new Set(detailRecord.value.adoptedCaseIndexes ?? [])
  const discarded = new Set(detailRecord.value.deletedCaseIndexes ?? [])
  adopted.add(row.index)
  discarded.delete(row.index)
  detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
    adoptedCaseIndexes: [...adopted],
    deletedCaseIndexes: [...discarded],
    savedCaseCount: adopted.size,
  })
  ElMessage.success('用例已采纳')
}

function openCasePreview(row: DetailCaseRow) {
  const targetIndex = detailCases.value.findIndex(item => item.index === row.index)
  if (targetIndex < 0) {
    return
  }
  activeCaseCursor.value = targetIndex
  previewActiveTab.value = 'detail'
  caseEditing.value = false
  syncCaseEditForm(detailCases.value[targetIndex])
  previewVisible.value = true
}

function moveCasePreview(delta: number) {
  const nextIndex = activeCaseCursor.value + delta
  if (nextIndex < 0 || nextIndex >= detailCases.value.length) {
    return
  }
  activeCaseCursor.value = nextIndex
  caseEditing.value = false
  syncCaseEditForm(detailCases.value[nextIndex])
}

function startCaseEdit() {
  if (!activeCase.value) {
    return
  }
  syncCaseEditForm(activeCase.value)
  caseEditing.value = true
}

function cancelCaseEdit() {
  caseEditing.value = false
  syncCaseEditForm(activeCase.value)
}

async function saveCaseEdit() {
  if (!detailRecord.value || !activeCase.value) {
    return
  }
  const title = caseEditForm.title.trim()
  if (!title) {
    ElMessage.warning('请输入用例标题')
    return
  }

  savingCaseEdit.value = true
  try {
    const targetIndex = activeCase.value.index
    const now = new Date().toISOString()
    const editorName = currentUser.value?.displayName || currentUser.value?.username || detailRecord.value.updatedByName || '当前用户'
    detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
      generatedCases: detailRecord.value.generatedCases.map((item, index) => (
        index === targetIndex
          ? {
              ...item,
              title,
              priority: caseEditForm.priority,
              precondition: caseEditForm.precondition,
              steps: caseEditForm.steps,
              expectedResult: caseEditForm.expectedResult,
              manualEdited: true,
              manualEditedByName: editorName,
              manualEditedAt: now,
            }
          : item
      )),
    })
    caseEditing.value = false
    syncCaseEditForm(activeCase.value)
    ElMessage.success('用例内容已更新')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingCaseEdit.value = false
  }
}

function isCaseSelected(index: number) {
  return selectedCaseIndexes.value.includes(index)
}

function toggleCaseSelected(index: number, checked: boolean) {
  const next = new Set(selectedCaseIndexes.value)
  if (checked) {
    next.add(index)
  } else {
    next.delete(index)
  }
  selectedCaseIndexes.value = [...next]
}

function toggleCurrentPageSelection(checked: boolean) {
  selectedCaseIndexes.value = checked ? detailCases.value.map(item => item.index) : []
}

function exportExcel() {
  if (!detailRecord.value) {
    return
  }

  const rows = detailCases.value.map(item => `
    <tr>
      <td>${escapeHtml(`CASE_${String(item.index + 1).padStart(3, '0')}`)}</td>
      <td>${escapeHtml(item.title ?? '')}</td>
      <td>${escapeHtml(item.precondition ?? '')}</td>
      <td>${escapeHtml(item.steps ?? '')}</td>
      <td>${escapeHtml(item.expectedResult ?? '')}</td>
      <td>${escapeHtml(item.priority ?? '')}</td>
      <td>${escapeHtml(getCaseReviewStateLabel(item))}</td>
    </tr>
  `).join('')

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8" /></head>
      <body>
        <table border="1">
          <tr><th colspan="7">AI生成用例记录</th></tr>
          <tr><td>任务ID</td><td colspan="6">${escapeHtml(detailRecord.value.taskId)}</td></tr>
          <tr><td>所属空间</td><td colspan="6">${escapeHtml(detailRecord.value.workspaceName || detailRecord.value.workspaceCode)}</td></tr>
          <tr><td>关联需求</td><td colspan="6">${escapeHtml(detailRecord.value.requirementTitle)}</td></tr>
          <tr><td>默认保存路径</td><td colspan="6">${escapeHtml(getDefaultDirectoryPath(detailRecord.value))}</td></tr>
          <tr><td>状态</td><td colspan="6">${escapeHtml(getStatusLabel(detailRecord.value.status))}</td></tr>
          <tr><td>生成时间</td><td colspan="6">${escapeHtml(formatDateTime(detailRecord.value.createdAt))}</td></tr>
          <tr><td>需求描述</td><td colspan="6">${escapeHtml(detailRecord.value.requirementContent || '')}</td></tr>
          <tr>
            <th>测试用例编号</th>
            <th>测试场景</th>
            <th>前置条件</th>
            <th>操作步骤</th>
            <th>预期结果</th>
            <th>优先级</th>
            <th>用例状态</th>
          </tr>
          ${rows}
        </table>
      </body>
    </html>
  `

  const blob = new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${detailRecord.value.requirementTitle || 'ai-cases'}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

watch(() => route.params.taskId, () => {
  previewVisible.value = false
  selectedCaseIndexes.value = []
  void loadRecord()
})

watch(previewVisible, (visible) => {
  if (!visible) {
    caseEditing.value = false
  }
})

onMounted(() => {
  loadTableSettings()
  const snapshot = window.history.state?.recordSnapshot as AiGenerationTaskItem | undefined
  if (snapshot?.taskId === route.params.taskId) {
    detailRecord.value = snapshot
    loading.value = false
  }
  void loadRecord()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <section class="case-ai-record-detail-page">
    <AppLoadingState v-if="loading" text="正在加载生成记录详情..." />

    <div v-else-if="errorMessage" class="case-ai-record-detail-page__state">
      <AppEmptyState title="加载生成记录失败" :description="errorMessage">
        <template #actions>
          <AppButton @click="loadRecord">重试</AppButton>
          <AppButton @click="goBack">返回记录页</AppButton>
        </template>
      </AppEmptyState>
    </div>

    <template v-else-if="detailRecord">
      <div class="case-ai-record-detail-page__header">
        <div class="case-ai-record-detail-page__header-row">
          <el-button class="case-ai-record-detail-page__back-button" text :icon="ArrowLeft" @click="goBack">
            返回记录页
          </el-button>
          <div class="case-ai-record-detail-page__header-right">
            <div class="case-ai-record-detail-page__path">
              <span class="case-ai-record-detail-page__path-label">当前采纳保存路径：</span>
              <span class="case-ai-record-detail-page__path-value">{{ getDefaultDirectoryPath(detailRecord) }}</span>
              <el-button class="case-ai-record-detail-page__path-edit" text @click="openPathDialog">修改保存路径</el-button>
            </div>
            <div class="case-ai-record-detail-page__header-actions">
              <el-button :icon="View" @click="openProcessDialog">查看流程</el-button>
              <el-button
                v-if="detailRecord.status === 'FAILED'"
                type="warning"
                :icon="RefreshRight"
                @click="retryTask"
              >
                重新生成
              </el-button>
              <el-button type="primary" :icon="Download" @click="exportExcel">导出 Excel</el-button>
            </div>
          </div>
        </div>
      </div>

      <AppCard class="case-ai-record-detail-page__summary-card">
        <button class="case-ai-record-detail-page__summary-toggle" type="button" @click="requirementExpanded = !requirementExpanded">
          <div class="case-ai-record-detail-page__summary-header">
            <div class="case-ai-record-detail-page__summary-title-row">
              <el-icon class="case-ai-record-detail-page__summary-icon"><Memo /></el-icon>
              <span class="case-ai-record-detail-page__summary-title">{{ detailRecord.requirementTitle }}</span>
              <span class="case-ai-record-detail-page__summary-tip">点击展开查看完整需求内容</span>
            </div>
            <el-icon class="case-ai-record-detail-page__summary-arrow">
              <component :is="requirementExpanded ? ArrowUp : ArrowDown" />
            </el-icon>
          </div>
        </button>

        <div v-if="requirementExpanded" class="case-ai-record-detail-page__summary-expanded">
          <div class="case-ai-record-detail-page__summary-content-shell">
            <div class="case-ai-record-detail-page__summary-content">{{ detailRecord.requirementContent || '-' }}</div>
          </div>
          <div class="case-ai-record-detail-page__summary-actions">
            <el-button :icon="CopyDocument" @click="copyRequirementContent">复制需求描述</el-button>
          </div>
        </div>
      </AppCard>

      <AppCard v-if="showTaskOutputBoard" class="case-ai-record-detail-page__output-card" :class="{ 'is-failed': detailRecord.status === 'FAILED' }">
        <div class="case-ai-record-detail-page__output-header">
          <div>
            <div class="case-ai-record-detail-page__output-title">
              {{ detailRecord.status === 'FAILED' ? '任务失败详情' : detailRecord.status === 'COMPLETED' ? 'AI 输出记录' : '实时输出' }}
            </div>
            <div v-if="detailRecord.status !== 'COMPLETED'" class="case-ai-record-detail-page__output-subtitle">
              {{ detailRecord.stepMessage || '等待任务执行...' }}
            </div>
          </div>
          <div class="case-ai-record-detail-page__output-pills">
            <span class="case-ai-record-detail-page__status-pill" :class="getStatusClass(detailRecord.status)">
              {{ getStatusLabel(detailRecord.status) }}
            </span>
            <span class="case-ai-record-detail-page__status-pill" :class="getOutputConnectionClass()">
              {{ outputConnectionLabel }}
            </span>
          </div>
        </div>

        <template v-if="detailRecord.status === 'FAILED'">
          <div class="case-ai-record-detail-page__failure-grid">
            <div class="case-ai-record-detail-page__failure-item">
              <div class="case-ai-record-detail-page__failure-label">失败阶段</div>
              <div class="case-ai-record-detail-page__failure-value">{{ getFailureStageLabel(detailRecord) }}</div>
            </div>
            <div class="case-ai-record-detail-page__failure-item">
              <div class="case-ai-record-detail-page__failure-label">结束时间</div>
              <div class="case-ai-record-detail-page__failure-value">{{ formatDateTime(detailRecord.finishedAt) }}</div>
            </div>
            <div class="case-ai-record-detail-page__failure-item case-ai-record-detail-page__failure-item--full">
              <div class="case-ai-record-detail-page__failure-label">失败原因</div>
              <div class="case-ai-record-detail-page__failure-value case-ai-record-detail-page__failure-value--danger">
                {{ detailRecord.errorMessage || detailRecord.stepMessage || '-' }}
              </div>
            </div>
            <div class="case-ai-record-detail-page__failure-item case-ai-record-detail-page__failure-item--full">
              <div class="case-ai-record-detail-page__failure-label">建议处理</div>
              <ul class="case-ai-record-detail-page__failure-list">
                <li v-for="item in getFailureSuggestions(detailRecord)" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="case-ai-record-detail-page__output-meta">
            <span>输出模式：{{ getOutputModeLabel(detailRecord.outputMode) }}</span>
            <span>生成用例：{{ detailRecord.generatedCount ?? 0 }}</span>
            <span>已采纳：{{ detailRecord.savedCaseCount ?? 0 }}</span>
            <span>生成模型：{{ formatModelDisplay(generationModelInfo.provider, generationModelInfo.model) }}</span>
            <span v-if="reviewModelInfo.provider || reviewModelInfo.model">评审模型：{{ formatModelDisplay(reviewModelInfo.provider, reviewModelInfo.model) }}</span>
          </div>
          <div class="case-ai-record-detail-page__output-body">
            <div class="case-ai-record-detail-page__timeline">
              <div
                v-for="item in outputTimeline"
                :key="item.key"
                class="case-ai-record-detail-page__timeline-item"
                :class="{ 'is-active': item.active, 'is-done': item.done }"
              >
                <span class="case-ai-record-detail-page__timeline-dot" />
                <div class="case-ai-record-detail-page__timeline-label">{{ item.label }}</div>
              </div>
            </div>
            <div class="case-ai-record-detail-page__output-log">
              <div v-if="!outputEvents.length" class="case-ai-record-detail-page__output-empty">等待任务输出事件...</div>
              <div
                v-for="event in outputEvents"
                :key="event.id"
                class="case-ai-record-detail-page__output-row"
                :class="getOutputEventClass(event.level)"
              >
                <span class="case-ai-record-detail-page__output-time">{{ formatTime(event.createdAt) }}</span>
                <span class="case-ai-record-detail-page__output-message">{{ event.message }}</span>
              </div>
            </div>
          </div>
        </template>
      </AppCard>

      <AppCard class="case-ai-record-detail-page__toolbar-card">
        <div class="case-ai-record-detail-page__toolbar-row">
          <div class="case-ai-record-detail-page__toolbar-meta">
            <span>最终用例数：{{ detailRecord.generatedCases.length }}</span>
            <span>初始生成：{{ initialCaseCount }}</span>
            <span>已优化：{{ optimizedCaseCount }}</span>
            <span>已补充：{{ supplementedCaseCount }}</span>
            <span>建议确认：{{ confirmRequiredCaseCount }}</span>
            <span>不推荐：{{ notRecommendedCaseCount }}</span>
            <span>待处理：{{ pendingCaseCount }}</span>
            <span>已采纳：{{ adoptedCaseCount }}</span>
            <span>已弃用：{{ discardedCaseCount }}</span>
          </div>
          <div class="case-ai-record-detail-page__toolbar-actions">
            <el-button
              class="case-ai-record-detail-page__batch-button case-ai-record-detail-page__batch-button--success"
              :disabled="selectedAdoptableCases.length === 0"
              :icon="Check"
              @click="openAdoptDialog('selected')"
            >
              批量采纳（{{ selectedAdoptableCases.length }}）
            </el-button>
            <el-button
              class="case-ai-record-detail-page__batch-button case-ai-record-detail-page__batch-button--danger"
              :disabled="selectedDiscardableCases.length === 0"
              :icon="CircleClose"
              @click="discardSelectedCases"
            >
              批量弃用（{{ selectedDiscardableCases.length }}）
            </el-button>
          </div>
        </div>
      </AppCard>

      <AppCard class="case-ai-record-detail-page__table-card">
        <div class="case-ai-record-detail-page__table-shell">
          <div class="case-ai-record-detail-page__table-data">
            <div class="case-ai-record-detail-page__table-scroll">
              <div
                class="case-ai-record-detail-page__grid case-ai-record-detail-page__grid--header"
                :style="{ gridTemplateColumns: dataGridTemplateColumns, minWidth: dataGridMinWidth }"
              >
                <div class="case-ai-record-detail-page__cell case-ai-record-detail-page__cell--selection">
                  <el-checkbox
                    :model-value="allCurrentPageSelected"
                    :indeterminate="currentPageSelectionIndeterminate"
                    aria-label="选择当前页用例"
                    @change="toggleCurrentPageSelection(Boolean($event))"
                  />
                </div>
                <div class="case-ai-record-detail-page__cell case-ai-record-detail-page__cell--index">序号</div>
                <div
                  v-for="column in visibleColumns"
                  :key="`header-${column.key}`"
                  :class="['case-ai-record-detail-page__cell', `case-ai-record-detail-page__cell--${column.key}`]"
                >
                  {{ column.key === 'savedDirectoryName' ? '最终保存路径' : column.label }}
                </div>
              </div>

              <div
                v-for="row in detailCases"
                :key="row.index"
                class="case-ai-record-detail-page__grid case-ai-record-detail-page__grid--row"
                :style="{ gridTemplateColumns: dataGridTemplateColumns, minWidth: dataGridMinWidth }"
              >
                <div class="case-ai-record-detail-page__cell case-ai-record-detail-page__cell--selection">
                  <el-checkbox
                    :model-value="isCaseSelected(row.index)"
                    :aria-label="`选择第 ${row.index + 1} 条用例`"
                    @change="toggleCaseSelected(row.index, Boolean($event))"
                  />
                </div>
                <div class="case-ai-record-detail-page__cell case-ai-record-detail-page__cell--index">
                  {{ row.index + 1 }}
                </div>
                <div
                  v-for="column in visibleColumns"
                  :key="`${row.index}-${column.key}`"
                  :class="['case-ai-record-detail-page__cell', `case-ai-record-detail-page__cell--${column.key}`]"
                >
                  <span v-if="column.key === 'title'" class="case-ai-record-detail-page__cell-clamp">{{ formatCaseCellText(row.title) }}</span>
                  <span v-else-if="column.key === 'precondition'" class="case-ai-record-detail-page__cell-clamp">{{ formatCaseCellText(row.precondition) }}</span>
                  <span v-else-if="column.key === 'steps'" class="case-ai-record-detail-page__cell-clamp">{{ formatCaseCellText(row.steps) }}</span>
                  <span v-else-if="column.key === 'expectedResult'" class="case-ai-record-detail-page__cell-clamp">{{ formatCaseCellText(row.expectedResult) }}</span>
                  <span v-else-if="column.key === 'savedDirectoryName'">{{ getCaseSavedDirectoryName(row) }}</span>
                  <span v-else-if="column.key === 'priority'" class="case-ai-record-detail-page__priority-chip" :class="`priority-${(row.priority || 'P2').toLowerCase()}`">
                    {{ row.priority || 'P2' }}
                  </span>
                  <span v-else-if="column.key === 'aiReview'" class="case-ai-record-detail-page__status-pill" :class="getAiReviewListClass(row)">
                    {{ getAiReviewListLabel(row) }}
                  </span>
                  <span v-else-if="column.key === 'status'" class="case-ai-record-detail-page__status-pill" :class="getCaseReviewStateClass(row)">
                    {{ getCaseReviewStateLabel(row) }}
                  </span>
                  <span v-else-if="column.key === 'manualEdited'">{{ row.manualEdited ? '是' : '否' }}</span>
                  <span v-else-if="column.key === 'manualEditedByName'">{{ row.manualEditedByName || '-' }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="case-ai-record-detail-page__table-actions-fixed">
            <div class="case-ai-record-detail-page__action-header">
              <span>操作</span>
              <AppTableSettingsTrigger @click="settingsVisible = true" />
            </div>
            <div
              v-for="row in detailCases"
              :key="`action-${row.index}`"
              class="case-ai-record-detail-page__actions-row"
            >
              <div class="case-ai-record-detail-page__row-actions">
                <el-button text type="primary" @click="openCasePreview(row)">查看详情</el-button>
                <el-button
                  v-if="getCaseReviewState(row) === 'PENDING'"
                  text
                  type="success"
                  @click="adoptSingleCase(row)"
                >
                  采纳
                </el-button>
                <el-button
                  v-if="getCaseReviewState(row) === 'PENDING'"
                  text
                  type="danger"
                  @click="discardSingleCase(row)"
                >
                  弃用
                </el-button>
                  <el-button v-if="getCaseReviewState(row) === 'DISCARDED'" text class="case-ai-record-detail-page__action-link-neutral" @click="restoreSingleCase(row)">
                    取消弃用
                  </el-button>
                </div>
              </div>
          </div>
        </div>
      </AppCard>
    </template>

    <AppDrawer
      v-model="previewVisible"
      size="760px"
      title="用例详情"
      drawer-class="case-ai-record-detail-page__preview-drawer"
    >
      <template v-if="activeCase">
        <div class="case-ai-record-detail-page__preview-shell">
          <div class="case-ai-record-detail-page__preview-header">
            <div class="case-ai-record-detail-page__preview-statuses">
              <span class="case-ai-record-detail-page__status-pill" :class="getCaseReviewStateClass(activeCase)">
                {{ getCaseReviewStateLabel(activeCase) }}
              </span>
              <span class="case-ai-record-detail-page__status-pill status-neutral">{{ getAiSourceLabel(activeCase) }}</span>
            </div>
            <div class="case-ai-record-detail-page__preview-nav">
              <AppButton size="small" :disabled="!canPreviewPreviousCase" :icon="ArrowLeft" @click="moveCasePreview(-1)">上一条</AppButton>
              <span>{{ activeCaseCursor + 1 }}/{{ detailCases.length }}</span>
              <AppButton size="small" :disabled="!canPreviewNextCase" :icon="ArrowRight" @click="moveCasePreview(1)">下一条</AppButton>
            </div>
          </div>

          <el-tabs v-model="previewActiveTab" class="case-ai-record-detail-page__preview-tabs">
            <el-tab-pane label="用例详情" name="detail">
              <div v-if="!caseEditing" class="case-ai-record-detail-page__preview-grid">
                <article class="case-ai-record-detail-page__preview-block case-ai-record-detail-page__preview-block--full">
                  <div class="case-ai-record-detail-page__detail-label">用例标题</div>
                  <div class="case-ai-record-detail-page__detail-text">{{ formatMultilineText(activeCase.title) }}</div>
                </article>
                <article class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">优先级</div>
                  <div class="case-ai-record-detail-page__detail-text">{{ formatMultilineText(activeCase.priority) }}</div>
                </article>
                <article class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">AI来源</div>
                  <div class="case-ai-record-detail-page__detail-text">{{ getAiSourceLabel(activeCase) }}</div>
                </article>
                <article class="case-ai-record-detail-page__preview-block case-ai-record-detail-page__preview-block--full">
                  <div class="case-ai-record-detail-page__detail-label">前置条件</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatMultilineText(activeCase.precondition) }}</div>
                </article>
                <article class="case-ai-record-detail-page__preview-block case-ai-record-detail-page__preview-block--full">
                  <div class="case-ai-record-detail-page__detail-label">操作步骤</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatMultilineText(activeCase.steps) }}</div>
                </article>
                <article class="case-ai-record-detail-page__preview-block case-ai-record-detail-page__preview-block--full">
                  <div class="case-ai-record-detail-page__detail-label">预期结果</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatMultilineText(activeCase.expectedResult) }}</div>
                </article>
              </div>

              <el-form v-else label-position="top" class="case-ai-record-detail-page__edit-form">
                <el-form-item label="用例标题">
                  <el-input v-model="caseEditForm.title" />
                </el-form-item>
                <el-form-item label="优先级">
                  <el-select v-model="caseEditForm.priority" style="width: 180px">
                    <el-option label="P0" value="P0" />
                    <el-option label="P1" value="P1" />
                    <el-option label="P2" value="P2" />
                    <el-option label="P3" value="P3" />
                    <el-option label="P4" value="P4" />
                  </el-select>
                </el-form-item>
                <el-form-item label="前置条件">
                  <el-input v-model="caseEditForm.precondition" type="textarea" :rows="4" />
                </el-form-item>
                <el-form-item label="操作步骤">
                  <el-input v-model="caseEditForm.steps" type="textarea" :rows="5" />
                </el-form-item>
                <el-form-item label="预期结果">
                  <el-input v-model="caseEditForm.expectedResult" type="textarea" :rows="4" />
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="AI 分析" name="analysis">
              <div class="case-ai-record-detail-page__analysis-stack">
                <article
                  v-for="field in getAnalysisFields(activeCase)"
                  :key="field.label"
                  class="case-ai-record-detail-page__preview-block"
                >
                  <div class="case-ai-record-detail-page__detail-label">{{ field.label }}</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ field.value }}</div>
                </article>
                <article
                  v-if="activeCase.warnings?.length"
                  class="case-ai-record-detail-page__preview-block"
                >
                  <div class="case-ai-record-detail-page__detail-label">提示项</div>
                  <ul class="case-ai-record-detail-page__analysis-list">
                    <li v-for="item in activeCase.warnings" :key="item">{{ item }}</li>
                  </ul>
                </article>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </template>

      <template #footer>
        <template v-if="activeCase">
          <AppButton v-if="!caseEditing" @click="startCaseEdit">编辑</AppButton>
          <AppButton v-else @click="cancelCaseEdit">取消编辑</AppButton>
          <AppButton v-if="caseEditing" type="primary" :loading="savingCaseEdit" @click="saveCaseEdit">保存</AppButton>
          <AppButton
            v-if="!caseEditing && getCaseReviewState(activeCase) === 'PENDING'"
            type="success"
            @click="adoptSingleCase(activeCase)"
          >
            采纳
          </AppButton>
          <AppButton
            v-if="!caseEditing && getCaseReviewState(activeCase) === 'PENDING'"
            type="danger"
            @click="discardSingleCase(activeCase)"
          >
            弃用
          </AppButton>
          <AppButton
            v-if="!caseEditing && getCaseReviewState(activeCase) === 'DISCARDED'"
            @click="restoreSingleCase(activeCase)"
          >
            取消弃用
          </AppButton>
        </template>
      </template>
    </AppDrawer>

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

    <el-dialog v-model="processDialogVisible" width="720px" destroy-on-close class="case-ai-record-detail-page__dialog">
      <template #header>
        <div class="case-ai-record-detail-page__dialog-title-block">
          <div class="case-ai-record-detail-page__dialog-title">生成流程</div>
          <div class="case-ai-record-detail-page__dialog-subtitle">
            {{ processRecord?.requirementTitle || '正在加载任务信息...' }}
          </div>
        </div>
      </template>

      <AppLoadingState v-if="processLoading" text="正在加载流程信息..." />
      <template v-else-if="processRecord">
        <div class="case-ai-record-detail-page__process-meta">
          <span class="case-ai-record-detail-page__status-pill" :class="getStatusClass(processRecord.status)">
            {{ getStatusLabel(processRecord.status) }}
          </span>
          <span>任务 ID：{{ processRecord.taskId }}</span>
          <span>更新时间：{{ formatDateTime(processRecord.updatedAt) }}</span>
        </div>

        <div class="case-ai-record-detail-page__process-steps">
          <article
            v-for="step in [
              { index: 1, title: '任务已创建', description: '已经记录需求内容、目标空间和输出模式。' },
              { index: 2, title: 'AI 生成用例', description: '正在根据需求生成候选测试用例。' },
              { index: 3, title: 'AI 自动评审', description: '正在汇总评审意见、优化建议和补充结论。' },
              { index: 4, title: '任务完成', description: '生成结果已经进入 AI 生成记录，可继续查看和采纳。' },
            ]"
            :key="step.index"
            :class="[
              'case-ai-record-detail-page__process-step',
              {
                'is-active': processRecord.currentStep === step.index && ['PENDING', 'GENERATING', 'REVIEWING'].includes(processRecord.status),
                'is-done': processRecord.status === 'COMPLETED' ? step.index <= 4 : (processRecord.currentStep || 0) > step.index,
                'is-failed': processRecord.status === 'FAILED' && processRecord.currentStep === step.index,
              },
            ]"
          >
            <div class="case-ai-record-detail-page__process-step-index">{{ step.index }}</div>
            <div>
              <div class="case-ai-record-detail-page__process-step-title">{{ step.title }}</div>
              <div class="case-ai-record-detail-page__process-step-desc">{{ step.description }}</div>
            </div>
          </article>
        </div>
      </template>

      <template #footer>
        <div class="case-ai-record-detail-page__dialog-footer">
          <AppButton
            v-if="processRecord && ['PENDING', 'GENERATING', 'REVIEWING'].includes(processRecord.status)"
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

    <el-dialog v-model="pathDialogVisible" width="620px" destroy-on-close class="case-ai-record-detail-page__dialog">
      <template #header>
        <div class="case-ai-record-detail-page__dialog-title">修改保存路径</div>
      </template>
      <AppLoadingState v-if="pathDialogLoading" text="正在加载目录..." />
      <template v-else>
        <div class="case-ai-record-detail-page__form-card">
          <el-form label-position="top">
            <el-form-item required>
              <template #label>
                <span>保存路径 <span class="case-ai-record-detail-page__required">*</span></span>
              </template>
              <div class="case-ai-record-detail-page__path-trigger" :class="{ 'is-invalid': pathTouched && pathForm.directoryId == null }">
                <div class="case-ai-record-detail-page__path-trigger-value">
                  {{ pathDirectoryOptions.find(item => item.value === pathForm.directoryId)?.label || '请选择保存路径' }}
                </div>
                <button type="button" class="case-ai-record-detail-page__path-trigger-button" @click="openPathPicker">
                  <el-icon><FolderOpened /></el-icon>
                </button>
              </div>
              <div v-if="pathTouched && pathForm.directoryId == null" class="case-ai-record-detail-page__field-error">请选择保存路径</div>
            </el-form-item>
          </el-form>
        </div>
      </template>
      <template #footer>
        <div class="case-ai-record-detail-page__dialog-footer">
          <AppButton @click="pathDialogVisible = false">取消</AppButton>
          <AppButton type="primary" :loading="pathSubmitting" @click="submitPathChange">确认修改</AppButton>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="pathPickerVisible" width="720px" destroy-on-close class="case-ai-record-detail-page__dialog">
      <template #header>
        <div class="case-ai-record-detail-page__dialog-title">选择保存路径</div>
      </template>
      <div class="case-ai-record-detail-page__picker-layout">
        <el-input v-model="pathPickerKeyword" clearable placeholder="搜索目录名称" />
        <div class="case-ai-record-detail-page__picker-tree-panel">
          <div v-if="!filteredPathPickerTree.length" class="case-ai-record-detail-page__picker-empty">未找到匹配的目录</div>
          <el-tree
            v-else
            :data="filteredPathPickerTree"
            node-key="key"
            highlight-current
            :expand-on-click-node="false"
            :default-expanded-keys="detailRecord?.workspaceCode ? [`workspace:${detailRecord.workspaceCode}`] : []"
            :current-node-key="pathPickerDirectoryId != null ? `dir:${pathPickerDirectoryId}` : undefined"
            class="case-ai-record-detail-page__picker-tree"
            @node-click="handlePathPickerNodeSelect"
          >
            <template #default="{ data }">
              <div class="case-ai-record-detail-page__picker-node" :class="{ 'is-workspace': !data.selectable }">
                <span>{{ data.name }}</span>
              </div>
            </template>
          </el-tree>
        </div>
      </div>
      <template #footer>
        <div class="case-ai-record-detail-page__dialog-footer">
          <AppButton @click="pathPickerVisible = false">取消</AppButton>
          <AppButton type="primary" :disabled="pathPickerDirectoryId == null" @click="confirmPathPickerSelection">确认选择</AppButton>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="adoptDialogVisible" width="620px" destroy-on-close class="case-ai-record-detail-page__dialog">
      <template #header>
        <div class="case-ai-record-detail-page__dialog-title">{{ adoptDialogMode === 'selected' ? '批量采纳' : '全部采纳' }}</div>
      </template>
      <AppLoadingState v-if="adoptDialogLoading" text="正在加载采纳信息..." />
      <template v-else-if="detailRecord">
        <div class="case-ai-record-detail-page__adopt-body">
          <div class="case-ai-record-detail-page__adopt-notice">
            <div class="case-ai-record-detail-page__adopt-copy">
              {{ `确定要${adoptDialogMode === 'selected' ? '批量采纳' : '全部采纳'}任务 "${detailRecord.requirementTitle}" 的 ${getCasesToAdopt().length} 条用例吗？` }}
            </div>
            <div class="case-ai-record-detail-page__adopt-subcopy">采纳后会把可用的生成用例保存到用例管理中。</div>
          </div>
          <div class="case-ai-record-detail-page__form-card">
            <el-form label-position="top">
              <el-form-item required>
                <template #label>
                  <span>保存路径 <span class="case-ai-record-detail-page__required">*</span></span>
                </template>
                <div class="case-ai-record-detail-page__path-trigger" :class="{ 'is-invalid': adoptPathTouched && adoptForm.directoryId == null }">
                  <div class="case-ai-record-detail-page__path-trigger-value">
                    {{ adoptDirectoryOptions.find(item => item.value === adoptForm.directoryId)?.label || '请选择保存路径' }}
                  </div>
                  <button type="button" class="case-ai-record-detail-page__path-trigger-button" @click="openAdoptPicker">
                    <el-icon><FolderOpened /></el-icon>
                  </button>
                </div>
                <div v-if="adoptPathTouched && adoptForm.directoryId == null" class="case-ai-record-detail-page__field-error">请选择保存路径</div>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="case-ai-record-detail-page__dialog-footer">
          <AppButton @click="adoptDialogVisible = false">取消</AppButton>
          <AppButton type="success" :loading="adoptSubmitting" @click="submitAdoptCases">确认采纳</AppButton>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="adoptPickerVisible" width="720px" destroy-on-close class="case-ai-record-detail-page__dialog">
      <template #header>
        <div class="case-ai-record-detail-page__dialog-title">选择保存路径</div>
      </template>
      <div class="case-ai-record-detail-page__picker-layout">
        <el-input v-model="adoptPickerKeyword" clearable placeholder="搜索目录名称" />
        <div class="case-ai-record-detail-page__picker-tree-panel">
          <div v-if="!filteredAdoptPathPickerTree.length" class="case-ai-record-detail-page__picker-empty">未找到匹配的目录</div>
          <el-tree
            v-else
            :data="filteredAdoptPathPickerTree"
            node-key="key"
            highlight-current
            :expand-on-click-node="false"
            :default-expanded-keys="detailRecord?.workspaceCode ? [`workspace:${detailRecord.workspaceCode}`] : []"
            :current-node-key="adoptPickerDirectoryId != null ? `dir:${adoptPickerDirectoryId}` : undefined"
            class="case-ai-record-detail-page__picker-tree"
            @node-click="handleAdoptPickerNodeSelect"
          >
            <template #default="{ data }">
              <div class="case-ai-record-detail-page__picker-node" :class="{ 'is-workspace': !data.selectable }">
                <span>{{ data.name }}</span>
              </div>
            </template>
          </el-tree>
        </div>
      </div>
      <template #footer>
        <div class="case-ai-record-detail-page__dialog-footer">
          <AppButton @click="adoptPickerVisible = false">取消</AppButton>
          <AppButton type="primary" :disabled="adoptPickerDirectoryId == null" @click="confirmAdoptPickerSelection">确认选择</AppButton>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.case-ai-record-detail-page {
  display: grid;
  align-content: start;
  gap: 16px;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.case-ai-record-detail-page__state {
  min-height: 420px;
  display: grid;
  align-items: center;
}

.case-ai-record-detail-page__header-row,
.case-ai-record-detail-page__header-right,
.case-ai-record-detail-page__header-actions,
.case-ai-record-detail-page__toolbar-row,
.case-ai-record-detail-page__toolbar-actions,
.case-ai-record-detail-page__output-header,
.case-ai-record-detail-page__preview-header,
.case-ai-record-detail-page__preview-statuses,
.case-ai-record-detail-page__preview-nav,
.case-ai-record-detail-page__dialog-footer,
.case-ai-record-detail-page__process-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.case-ai-record-detail-page__header-row {
  justify-content: space-between;
}

.case-ai-record-detail-page__header-right {
  justify-content: space-between;
  flex: 1;
  gap: 16px;
}

.case-ai-record-detail-page__back-button,
.case-ai-record-detail-page__path-edit {
  padding: 0;
}

.case-ai-record-detail-page__back-button {
  width: fit-content;
  min-height: 38px;
  padding: 0 10px 0 0;
  color: #344054;
  font-size: 15px;
}

.case-ai-record-detail-page__path {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 14px;
  color: #344054;
}

.case-ai-record-detail-page__path-label {
  color: #667085;
}

.case-ai-record-detail-page__path-value {
  color: #101828;
  font-weight: 600;
}

.case-ai-record-detail-page__path-edit {
  font-size: 13px;
  font-weight: 600;
  color: #175cd3;
}

.case-ai-record-detail-page__header-actions {
  gap: 10px;
}

.case-ai-record-detail-page__header-actions :deep(.el-button) {
  min-height: 32px;
  padding-inline: 14px;
}

.case-ai-record-detail-page__summary-toggle {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.case-ai-record-detail-page__summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.case-ai-record-detail-page__summary-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.case-ai-record-detail-page__summary-title {
  color: var(--app-text-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.case-ai-record-detail-page__summary-tip,
.case-ai-record-detail-page__summary-arrow {
  color: var(--app-text-muted);
  font-size: 13px;
}

.case-ai-record-detail-page__summary-expanded {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.case-ai-record-detail-page__summary-content-shell {
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-bg-subtle);
}

.case-ai-record-detail-page__summary-content {
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 24px;
  white-space: pre-wrap;
}

.case-ai-record-detail-page__summary-actions {
  display: flex;
  justify-content: flex-end;
}

.case-ai-record-detail-page__output-card {
  padding: 16px 18px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-bg-panel);
}

.case-ai-record-detail-page__output-card.is-failed {
  border-color: rgba(240, 68, 56, 0.22);
}

.case-ai-record-detail-page__output-title {
  color: var(--app-text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
}

.case-ai-record-detail-page__output-card.is-failed .case-ai-record-detail-page__output-title {
  color: #7a271a;
}

.case-ai-record-detail-page__output-subtitle,
.case-ai-record-detail-page__output-meta,
.case-ai-record-detail-page__timeline-label,
.case-ai-record-detail-page__output-empty {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-record-detail-page__output-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
  font-size: 14px;
  color: #344054;
  line-height: 1.4;
}

.case-ai-record-detail-page__output-pills {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.case-ai-record-detail-page__output-body {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 16px;
  margin-top: 14px;
}

.case-ai-record-detail-page__timeline {
  display: grid;
  gap: 10px;
}

.case-ai-record-detail-page__timeline-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
}

.case-ai-record-detail-page__timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--app-border-strong);
}

.case-ai-record-detail-page__timeline-item.is-active .case-ai-record-detail-page__timeline-dot {
  background: var(--app-primary);
}

.case-ai-record-detail-page__timeline-item.is-done .case-ai-record-detail-page__timeline-dot {
  background: var(--app-success);
}

.case-ai-record-detail-page__output-log {
  max-height: 260px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-bg-subtle);
}

.case-ai-record-detail-page__output-row {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(229, 231, 235, 0.8);
}

.case-ai-record-detail-page__output-row:last-child {
  border-bottom: 0;
}

.case-ai-record-detail-page__output-row.is-info .case-ai-record-detail-page__output-message {
  color: #175cd3;
}

.case-ai-record-detail-page__output-row.is-warn .case-ai-record-detail-page__output-message {
  color: #b54708;
}

.case-ai-record-detail-page__output-row.is-error .case-ai-record-detail-page__output-message {
  color: #b42318;
}

.case-ai-record-detail-page__output-row.is-success .case-ai-record-detail-page__output-message {
  color: #067647;
}

.case-ai-record-detail-page__output-time {
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 20px;
}

.case-ai-record-detail-page__output-message {
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 20px;
  word-break: break-word;
}

.case-ai-record-detail-page__failure-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.case-ai-record-detail-page__failure-item {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid rgba(240, 68, 56, 0.16);
  border-radius: 12px;
  background: rgba(254, 242, 242, 0.78);
}

.case-ai-record-detail-page__failure-item--full {
  grid-column: 1 / -1;
}

.case-ai-record-detail-page__failure-label {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.case-ai-record-detail-page__failure-value {
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 22px;
}

.case-ai-record-detail-page__failure-value--danger {
  color: #b42318;
}

.case-ai-record-detail-page__failure-list {
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 24px;
}

.case-ai-record-detail-page__toolbar-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  color: #344054;
  font-size: 14px;
  line-height: 1.4;
}

.case-ai-record-detail-page__toolbar-meta > span {
  position: relative;
  padding-right: 12px;
}

.case-ai-record-detail-page__toolbar-meta > span:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 0;
  width: 1px;
  height: 12px;
  background: rgba(152, 162, 179, 0.35);
  transform: translateY(-50%);
}

.case-ai-record-detail-page__toolbar-row {
  min-height: 68px;
  padding: 16px 2px;
}

.case-ai-record-detail-page__toolbar-actions {
  gap: 14px;
}

.case-ai-record-detail-page__toolbar-actions :deep(.case-ai-record-detail-page__batch-button) {
  min-width: 132px;
  height: 40px;
  padding: 0 18px;
  border-width: 1px;
  border-style: solid;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
}

.case-ai-record-detail-page__toolbar-actions :deep(.case-ai-record-detail-page__batch-button.is-disabled),
.case-ai-record-detail-page__toolbar-actions :deep(.case-ai-record-detail-page__batch-button:disabled) {
  background: #c9ced6;
  border-color: #c9ced6;
  color: #ffffff;
  opacity: 1;
}

.case-ai-record-detail-page__toolbar-actions :deep(.case-ai-record-detail-page__batch-button--success:not(.is-disabled)) {
  background: #28b463;
  border-color: #28b463;
  color: #ffffff;
}

.case-ai-record-detail-page__toolbar-actions :deep(.case-ai-record-detail-page__batch-button--danger:not(.is-disabled)) {
  background: #ef4d3f;
  border-color: #ef4d3f;
  color: #ffffff;
}

.case-ai-record-detail-page__table-card {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.case-ai-record-detail-page__table-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 156px;
  min-width: 0;
  overflow: hidden;
  border-top: 1px solid var(--app-border-soft);
}

.case-ai-record-detail-page__table-data {
  min-width: 0;
}

.case-ai-record-detail-page__table-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-gutter: stable;
}

.case-ai-record-detail-page__table-scroll::-webkit-scrollbar {
  height: 10px;
}

.case-ai-record-detail-page__table-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.case-ai-record-detail-page__table-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
}

.case-ai-record-detail-page__grid {
  display: grid;
}

.case-ai-record-detail-page__grid--header {
  min-height: 48px;
  border-bottom: 1px solid var(--app-border);
  background: #f8fafc;
  color: #344054;
  font-size: 13px;
  font-weight: 600;
}

.case-ai-record-detail-page__grid--row {
  min-height: 80px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
  transition: background-color 160ms ease;
}

.case-ai-record-detail-page__grid--row:hover {
  background: #f8fbff;
}

.case-ai-record-detail-page__cell {
  display: flex;
  min-width: 0;
  align-items: center;
  padding: 14px 16px;
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-record-detail-page__cell--selection,
.case-ai-record-detail-page__cell--index,
.case-ai-record-detail-page__cell--priority,
.case-ai-record-detail-page__cell--aiReview,
.case-ai-record-detail-page__cell--status,
.case-ai-record-detail-page__cell--manualEdited {
  justify-content: center;
}

.case-ai-record-detail-page__cell--selection {
  padding-inline: 12px;
}

.case-ai-record-detail-page__cell--index {
  color: var(--app-text-secondary);
  font-variant-numeric: tabular-nums;
}

.case-ai-record-detail-page__cell-clamp {
  display: block;
  width: 100%;
  overflow: hidden;
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-record-detail-page__action-header {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 48px;
  border-bottom: 1px solid var(--app-border);
  background: #f8fafc;
  color: #344054;
  font-size: 13px;
  font-weight: 700;
}

.case-ai-record-detail-page__table-actions-fixed {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-left: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
  box-shadow: -6px 0 12px rgba(15, 23, 42, 0.05);
}

.case-ai-record-detail-page__actions-row {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
  transition: background-color 160ms ease;
}

.case-ai-record-detail-page__actions-row:hover {
  background: #f8fbff;
}

.case-ai-record-detail-page__row-actions {
  display: grid;
  justify-items: center;
  align-content: center;
  grid-auto-rows: 24px;
  gap: 4px;
  min-height: 80px;
  max-width: 100%;
  overflow: hidden;
}

.case-ai-record-detail-page__row-actions :deep(.el-button) {
  width: 72px;
  height: 24px;
  padding: 0;
  justify-content: center;
  overflow: hidden;
  margin-left: 0;
  font-size: 13px;
  white-space: nowrap;
}

.case-ai-record-detail-page__action-link-neutral {
  color: #667085;
}

.case-ai-record-detail-page__action-link-neutral:hover,
.case-ai-record-detail-page__action-link-neutral:focus-visible {
  color: #475467;
}

.case-ai-record-detail-page__priority-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.case-ai-record-detail-page__priority-chip.priority-p0,
.case-ai-record-detail-page__priority-chip.priority-p1 {
  background: rgba(254, 228, 226, 0.92);
  color: #b42318;
}

.case-ai-record-detail-page__priority-chip.priority-p2 {
  background: rgba(255, 245, 223, 0.92);
  color: #b54708;
}

.case-ai-record-detail-page__priority-chip.priority-p3,
.case-ai-record-detail-page__priority-chip.priority-p4 {
  background: rgba(219, 234, 254, 0.92);
  color: #175cd3;
}

.case-ai-record-detail-page__ai-review-cell {
  display: flex;
  justify-content: center;
}

.case-ai-record-detail-page__status-pill {
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

.status-purple {
  background: rgba(243, 232, 255, 0.96);
  color: #7e22ce;
}

.case-ai-record-detail-page__preview-shell {
  display: grid;
  gap: 16px;
}

.case-ai-record-detail-page__preview-nav span {
  min-width: 56px;
  color: var(--app-text-muted);
  font-size: 13px;
  text-align: center;
}

.case-ai-record-detail-page__preview-grid,
.case-ai-record-detail-page__analysis-stack {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.case-ai-record-detail-page__preview-block {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-bg-panel);
}

.case-ai-record-detail-page__preview-block--full {
  grid-column: 1 / -1;
}

.case-ai-record-detail-page__detail-label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.case-ai-record-detail-page__detail-text {
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 22px;
  word-break: break-word;
}

.case-ai-record-detail-page__detail-text.is-rich {
  min-height: 96px;
  padding: 14px 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  background: var(--app-bg-muted);
  white-space: pre-wrap;
}

.case-ai-record-detail-page__analysis-list {
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 24px;
}

.case-ai-record-detail-page__edit-form {
  display: grid;
}

.case-ai-record-detail-page__dialog-title,
.case-ai-record-detail-page__dialog-title-block .case-ai-record-detail-page__dialog-title {
  color: var(--app-text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
}

.case-ai-record-detail-page__dialog-subtitle {
  margin-top: 4px;
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-record-detail-page__process-steps {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.case-ai-record-detail-page__process-step {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.82);
}

.case-ai-record-detail-page__process-step.is-active {
  border-color: rgba(36, 107, 255, 0.36);
  background: rgba(233, 240, 255, 0.82);
}

.case-ai-record-detail-page__process-step.is-done {
  border-color: rgba(20, 163, 109, 0.22);
}

.case-ai-record-detail-page__process-step.is-failed {
  border-color: rgba(240, 68, 56, 0.26);
  background: rgba(254, 242, 242, 0.92);
}

.case-ai-record-detail-page__process-step-index {
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

.case-ai-record-detail-page__process-step-title {
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.case-ai-record-detail-page__process-step-desc {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-record-detail-page__form-card {
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: #ffffff;
}

.case-ai-record-detail-page__adopt-body {
  display: grid;
  gap: 18px;
}

.case-ai-record-detail-page__adopt-notice {
  padding: 14px 16px;
  border: 1px solid rgba(59, 130, 246, 0.14);
  border-radius: 12px;
  background: rgba(239, 246, 255, 0.72);
}

.case-ai-record-detail-page__adopt-copy,
.case-ai-record-detail-page__adopt-subcopy {
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 22px;
}

.case-ai-record-detail-page__adopt-subcopy {
  margin-top: 8px;
  color: var(--app-text-muted);
}

.case-ai-record-detail-page__path-trigger {
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

.case-ai-record-detail-page__path-trigger.is-invalid {
  border-color: var(--app-danger);
}

.case-ai-record-detail-page__path-trigger-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.case-ai-record-detail-page__path-trigger-button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
}

.case-ai-record-detail-page__field-error,
.case-ai-record-detail-page__required {
  color: var(--app-danger);
}

.case-ai-record-detail-page__field-error {
  margin-top: 6px;
  font-size: 12px;
  line-height: 18px;
}

.case-ai-record-detail-page__picker-layout {
  display: grid;
  gap: 16px;
}

.case-ai-record-detail-page__picker-tree-panel {
  min-height: 320px;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: #ffffff;
}

.case-ai-record-detail-page__picker-empty {
  min-height: 296px;
  display: grid;
  place-items: center;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.case-ai-record-detail-page__picker-node {
  display: flex;
  align-items: center;
  min-height: 34px;
  width: 100%;
  color: var(--app-text-main);
  font-size: 13px;
}

.case-ai-record-detail-page__picker-node.is-workspace {
  font-weight: 700;
  color: var(--app-text-primary);
}

@media (max-width: 1280px) {
  .case-ai-record-detail-page__header-row,
  .case-ai-record-detail-page__header-right,
  .case-ai-record-detail-page__toolbar-row,
  .case-ai-record-detail-page__output-header,
  .case-ai-record-detail-page__preview-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .case-ai-record-detail-page__output-body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .case-ai-record-detail-page__failure-grid,
  .case-ai-record-detail-page__preview-grid,
  .case-ai-record-detail-page__analysis-stack {
    grid-template-columns: 1fr;
  }
}
</style>
