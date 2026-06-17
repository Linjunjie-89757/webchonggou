<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Close,
  Delete,
  DocumentCopy,
  Fold,
  Folder,
  FolderOpened,
  MoreFilled,
  Plus,
  Search,
  VideoPlay,
  Upload,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  apiAutomationApi,
  apiMethodOptions,
  type ApiAiCaseGenerationEvent,
  type ApiAiCaseGenerationOptionPayload,
  type ApiAiGeneratedCaseDraft,
  type ApiAutomationEnvironmentItem,
  type ApiAutomationVariableSetItem,
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiDefinitionDetail,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
  type ApiKeyValueInput,
  type ApiRequestConfigInput,
  type ApiRunHistoryDetail,
  type ApiRunHistoryItem,
  type ApiRunResult,
  type ApiRunStepResult,
  type SaveApiDefinitionCasePayload,
  type SaveApiDefinitionPayload,
} from '@/entities/api-automation'
import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'
import ApiCaseCreateEditDialog from '@/features/api-case-create-edit/ApiCaseCreateEditDialog.vue'
import { getRequestErrorMessage } from '@/shared/api/error'

type RequestContentTab = 'headers' | 'body' | 'params' | 'cookies' | 'auth' | 'pre' | 'post' | 'extractors' | 'tests' | 'settings' | 'cases'
type ResponseTab = 'body' | 'header' | 'console' | 'actualRequest' | 'assertions'
type DirectoryNodeType = 'root' | 'module' | 'request' | 'unassigned'
type BodyType = 'NONE' | 'FORM_DATA' | 'FORM_URLENCODED' | 'RAW_JSON' | 'RAW_XML' | 'RAW_TEXT' | 'BINARY'
type BatchAddTarget = 'query' | 'header' | 'cookie' | 'body-form' | 'assertion' | 'extractor'
type ApiCaseDialogMode = 'create' | 'edit'
type ApiCaseDrawerTab = 'detail' | 'history' | 'changes'
type ApiAiCaseGenerationStatus = 'idle' | 'running' | 'done' | 'failed'
type ApiAiGeneratedCaseStatus = 'pending' | 'accepted' | 'discarded' | 'failed'
type ApiAiCaseResultFilter = 'all' | 'pending' | 'accepted' | 'discarded'

interface ApiAiGeneratedCaseResult {
  id: string
  status: ApiAiGeneratedCaseStatus
  draft: ApiAiGeneratedCaseDraft
  message?: string | null
}

interface ApiAssertionConfig {
  id?: string
  assertionType?: string
  type?: string
  name?: string
  enabled?: boolean
  subject?: string
  expressionType?: string
  expression?: string
  condition?: string
  operator?: string
  expectedValue?: string
  script?: string | null
  description?: string | null
  assertionBodyType?: ApiAssertionExpressionType
  scriptLanguage?: string | null
  assertions?: ApiAssertionItemConfig[]
  jsonPathAssertion?: ApiAssertionGroupConfig
  xpathAssertion?: ApiAssertionGroupConfig
  regexAssertion?: ApiAssertionGroupConfig
  variableAssertionItems?: ApiAssertionItemConfig[]
}

type ApiAssertionExpressionType = 'JSON_PATH' | 'X_PATH' | 'REGEX' | 'HEADER' | 'VARIABLE' | 'SCRIPT'

interface ApiAssertionItemConfig {
  enabled?: boolean
  header?: string | null
  variableName?: string | null
  expression?: string | null
  condition?: string | null
  operator?: string | null
  expectedValue?: string | null
  description?: string | null
}

interface ApiAssertionGroupConfig {
  assertions: ApiAssertionItemConfig[]
  responseFormat?: string | null
}

interface ApiExtractorConfig {
  id?: string
  name?: string
  enabled?: boolean
  source?: string
  sourceType?: string
  extractType?: string
  expressionType?: string
  expression?: string
  variableName?: string
  defaultValue?: string | null
  required?: boolean
  failOnMissing?: boolean
  description?: string | null
}

interface ApiProcessorConfig {
  id?: string
  processorType?: string
  name?: string
  enabled?: boolean
  script?: string | null
  sql?: string | null
  dataSourceName?: string | null
  delayMs?: number | null
  expression?: string | null
  variableName?: string | null
  sourceType?: string | null
  extractType?: string | null
  description?: string | null
  extractors?: ApiProcessorExtractItem[]
}

interface ApiProcessorExtractItem {
  id?: string
  enabled?: boolean
  name?: string | null
  variableName?: string | null
  description?: string | null
  variableType?: string | null
  sourceType?: string | null
  extractType?: string | null
  expression?: string | null
}

interface DirectoryNode {
  key: string
  type: DirectoryNodeType
  label: string
  count: number
  moduleId: number | null
  workspaceCode: string
  definitionId: number | null
  method?: string
  definition?: ApiDefinitionItem
  children: DirectoryNode[]
}

interface EditorTab {
  key: string
  definitionId: number | null
  title: string
  method: string
  dirty: boolean
  activeTab: RequestContentTab
  responseTab: ResponseTab
  detail: ApiDefinitionDetail
  runResult: ApiRunResult | null
  runError: string
  loading: boolean
}

const props = defineProps<{
  workspaceCode: string
  workspaceReady?: boolean
}>()

const emit = defineEmits<{
  loaded: [payload: { definitions: ApiDefinitionItem[]; modules: ApiDefinitionModuleItem[]; cases: ApiDefinitionCaseItem[] }]
}>()

const activeTopTab = ref('definitions')
const loading = ref(false)
const moduleLoading = ref(false)
const definitionLoading = ref(false)
const moduleErrorMessage = ref('')
const definitionErrorMessage = ref('')
const modules = ref<ApiDefinitionModuleItem[]>([])
const definitions = ref<ApiDefinitionItem[]>([])
const cases = ref<ApiDefinitionCaseItem[]>([])
const environments = ref<ApiAutomationEnvironmentItem[]>([])
const variableSets = ref<ApiAutomationVariableSetItem[]>([])
const runOptionsLoading = ref(false)
const runOptionsErrorMessage = ref('')
const selectedEnvironmentId = ref<number | null>(null)
const selectedVariableSetId = ref<number | null>(null)
const directoryKeyword = ref('')
const selectedDirectoryKey = ref('definition-root')
const expandedKeys = ref<string[]>(['definition-root'])
const tabs = ref<EditorTab[]>([])
const activeEditorKey = ref('')
const urlInputRef = ref<{ focus: () => void } | null>(null)
const saving = ref(false)
const sending = ref(false)
const batchAddVisible = ref(false)
const batchAddTarget = ref<BatchAddTarget>('query')
const batchAddText = ref('')
const activeAssertionId = ref('')
const importDialogVisible = ref(false)
const caseDialogVisible = ref(false)
const caseDialogMode = ref<ApiCaseDialogMode>('create')
const caseDialogSaving = ref(false)
const caseDetailLoading = ref(false)
const caseDetailErrorMessage = ref('')
const editingCaseItem = ref<ApiDefinitionCaseItem | null>(null)
const editingCaseDetail = ref<ApiDefinitionCaseDetail | null>(null)
const caseRunningId = ref<number | null>(null)
const caseDetailDrawerVisible = ref(false)
const caseDetailDrawerTab = ref<ApiCaseDrawerTab>('detail')
const viewingCaseItem = ref<ApiDefinitionCaseItem | null>(null)
const viewingCaseDetail = ref<ApiDefinitionCaseDetail | null>(null)
const viewingCaseDetailLoading = ref(false)
const viewingCaseDetailErrorMessage = ref('')
const caseRunHistories = ref<ApiRunHistoryItem[]>([])
const caseRunHistoryLoading = ref(false)
const caseRunHistoryErrorMessage = ref('')
const selectedCaseRunHistoryId = ref<number | null>(null)
const selectedCaseRunHistoryDetail = ref<ApiRunHistoryDetail | null>(null)
const caseRunHistoryDetailLoading = ref(false)
const caseRunHistoryDetailErrorMessage = ref('')
const maxDebugFileBytes = 5 * 1024 * 1024
const aiCaseDrawerVisible = ref(false)
const aiCaseProviders = ref<AiProviderConnectionItem[]>([])
const aiCaseProvidersLoading = ref(false)
const aiCaseProviderErrorMessage = ref('')
const aiCaseSelectedProviderId = ref<number | null>(null)
const aiCaseCount = ref('AUTO')
const aiCaseNoDuplicate = ref(true)
const aiCasePrompt = ref('')
const aiCaseSelectedOptionKeys = ref<string[]>(['positive-basic', 'negative-required', 'boundary-value'])
const aiCaseGenerationStatus = ref<ApiAiCaseGenerationStatus>('idle')
const aiCaseGenerationMessage = ref('')
const aiCaseGenerationLogs = ref<string[]>([])
const aiCaseGeneratedResults = ref<ApiAiGeneratedCaseResult[]>([])
const aiCaseSavingId = ref('')
const aiCaseResultFilter = ref<ApiAiCaseResultFilter>('pending')
const aiCaseResultKeyword = ref('')
const aiCaseResultGroup = ref('')
const aiCaseResultType = ref('')
const aiCaseSelectedResultIds = ref<string[]>([])
const aiCaseDetailVisible = ref(false)
const aiCaseDetailResult = ref<ApiAiGeneratedCaseResult | null>(null)
const responsePanelHeight = ref(250)
const responsePanelMinHeight = 220
const responsePanelMaxHeight = 520
const responsePanelHeightStorageKey = 'api-interface-response-panel-height'
let responseResizeStartY = 0
let responseResizeStartHeight = 0

const bodyModes: Array<{ label: string; value: BodyType }> = [
  { label: 'none', value: 'NONE' },
  { label: 'form-data', value: 'FORM_DATA' },
  { label: 'x-www-form-urlencoded', value: 'FORM_URLENCODED' },
  { label: 'json', value: 'RAW_JSON' },
  { label: 'xml', value: 'RAW_XML' },
  { label: 'raw', value: 'RAW_TEXT' },
  { label: 'binary', value: 'BINARY' },
]

function bodyModeLabel(type?: string | null) {
  return bodyModes.find(item => item.value === type)?.label || type || 'none'
}

const aiCaseGenerationOptions: ApiAiCaseGenerationOptionPayload[] = [
  { id: 'positive-basic', key: 'positive-basic', group: 'positive', groupLabel: '正向场景', label: '基础成功路径' },
  { id: 'positive-variant', key: 'positive-variant', group: 'positive', groupLabel: '正向场景', label: '参数组合成功' },
  { id: 'negative-required', key: 'negative-required', group: 'negative', groupLabel: '异常场景', label: '必填缺失' },
  { id: 'negative-format', key: 'negative-format', group: 'negative', groupLabel: '异常场景', label: '格式错误' },
  { id: 'boundary-value', key: 'boundary-value', group: 'boundary', groupLabel: '边界场景', label: '边界值' },
  { id: 'security-basic', key: 'security-basic', group: 'security', groupLabel: '安全场景', label: '鉴权与越权' },
]

const aiCaseCountOptions = [
  { label: '智能数量', value: 'AUTO' },
  { label: '10 条', value: '10' },
  { label: '20 条', value: '20' },
  { label: '40 条', value: '40' },
]

const importCapabilityItems = [
  { name: 'Swagger / OpenAPI', description: '需要后端解析 OpenAPI 文档并批量创建接口定义', status: '待后端接口' },
  { name: 'Postman Collection', description: '需要后端解析 Collection v2.0 / v2.1', status: '待后端接口' },
  { name: 'HAR 文件', description: '需要后端解析浏览器 HTTP Archive 文件', status: '待后端接口' },
]

const paramTypeOptions = ['string', 'integer', 'number', 'boolean', 'array', 'json', 'file']
const assertionTypeOptions = [
  { label: '状态码', value: 'RESPONSE_CODE' },
  { label: '响应头', value: 'RESPONSE_HEADER' },
  { label: '响应体', value: 'RESPONSE_BODY' },
  { label: '响应时间', value: 'RESPONSE_TIME' },
  { label: '变量', value: 'VARIABLE' },
  { label: '脚本', value: 'SCRIPT' },
]
const assertionConditionOptions = [
  { label: '等于', value: 'EQUALS' },
  { label: '不等于', value: 'NOT_EQUALS' },
  { label: '包含', value: 'CONTAINS' },
  { label: '不包含', value: 'NOT_CONTAINS' },
  { label: '为空', value: 'EMPTY' },
  { label: '不为空', value: 'NOT_EMPTY' },
  { label: '开头是', value: 'START_WITH' },
  { label: '结尾是', value: 'END_WITH' },
  { label: '正则匹配', value: 'REGEX' },
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GT_OR_EQUALS' },
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LT_OR_EQUALS' },
  { label: '不校验', value: 'UNCHECKED' },
]

const extractorSourceOptions = [
  { label: '响应体', value: 'RESPONSE_BODY' },
  { label: '响应头', value: 'RESPONSE_HEADER' },
  { label: 'Cookie', value: 'COOKIE' },
]

const extractorExpressionTypeOptions = [
  { label: 'JSONPath', value: 'JSON_PATH' },
  { label: 'XPath', value: 'X_PATH' },
  { label: 'Regex', value: 'REGEX' },
  { label: 'Header name', value: 'HEADER' },
]

function assertionConditionLabel(value?: string | null) {
  return assertionConditionOptions.find(item => item.value === value)?.label || value || '-'
}

function assertionResultLabel(success?: boolean | null) {
  return success ? '通过' : '不通过'
}

function assertionResultClass(success?: boolean | null) {
  return success ? 'is-passed' : 'is-failed'
}

function extractionResultValue(row: unknown, key: string) {
  if (!row || typeof row !== 'object') return undefined
  return (row as Record<string, unknown>)[key]
}

function extractionResultText(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function formatExtractionResults(rows: unknown[]) {
  if (!rows.length) return ''
  const lines = ['提取结果']
  rows.forEach((row, index) => {
    const name = extractionResultText(extractionResultValue(row, 'name') ?? extractionResultValue(row, 'variableName') ?? `提取器 ${index + 1}`)
    const success = extractionResultValue(row, 'success')
    const value = extractionResultText(extractionResultValue(row, 'value') ?? extractionResultValue(row, 'actualValue'))
    const message = extractionResultText(extractionResultValue(row, 'message') ?? extractionResultValue(row, 'errorMessage'))
    lines.push(`[${index + 1}] ${name} / ${success === false ? '失败' : '成功'} / ${value}${message !== '-' ? ` / ${message}` : ''}`)
  })
  return lines.join('\n')
}

function formatProcessorResults(rows: unknown[]) {
  if (!rows.length) return ''
  const lines = ['处理器结果']
  rows.forEach((row, index) => {
    const name = extractionResultText(extractionResultValue(row, 'name') ?? extractionResultValue(row, 'processorName') ?? `处理器 ${index + 1}`)
    const type = extractionResultText(extractionResultValue(row, 'type') ?? extractionResultValue(row, 'processorType'))
    const success = extractionResultValue(row, 'success')
    const message = extractionResultText(extractionResultValue(row, 'message') ?? extractionResultValue(row, 'errorMessage') ?? extractionResultValue(row, 'result'))
    lines.push(`[${index + 1}] ${name}${type !== '-' ? ` / ${type}` : ''} / ${success === false ? '失败' : '成功'}${message !== '-' ? ` / ${message}` : ''}`)
  })
  return lines.join('\n')
}

const processorTypeOptions = [
  { label: '脚本', value: 'SCRIPT' },
  { label: 'SQL', value: 'SQL' },
  { label: '等待', value: 'TIME_WAITING' },
  { label: '提取', value: 'EXTRACT' },
]

const processorExtractVariableTypeOptions = [
  { label: '临时变量', value: 'TEMPORARY' },
  { label: '全局变量', value: 'GLOBAL' },
  { label: '环境变量', value: 'ENVIRONMENT' },
]

const contentTabs = computed<Array<{ label: string; value: RequestContentTab; count?: number }>>(() => [
  { label: '请求头', value: 'headers', count: enabledRows(activeEditor.value?.detail.requestConfig.headers).length },
  { label: '请求体', value: 'body' },
  { label: 'Params', value: 'params', count: enabledRows(activeEditor.value?.detail.requestConfig.queryParams).length },
  { label: 'Cookie', value: 'cookies', count: enabledRows(activeEditor.value?.detail.requestConfig.cookies).length },
  { label: 'Auth', value: 'auth' },
  { label: '前置处理', value: 'pre' },
  { label: '后置处理', value: 'post' },
  { label: '提取器', value: 'extractors', count: activeEditor.value?.detail.extractors.length || undefined },
  { label: '断言', value: 'tests', count: activeEditor.value?.detail.assertions.length || undefined },
  { label: '设置', value: 'settings' },
  { label: '用例', value: 'cases', count: activeDefinitionCases.value.length || undefined },
])

const activeEditor = computed(() => tabs.value.find(item => item.key === activeEditorKey.value) || null)
const activeDetail = computed(() => activeEditor.value?.detail || null)
const activeDefinitionCases = computed(() => {
  const id = activeEditor.value?.definitionId
  return id ? cases.value.filter(item => item.definitionId === id) : []
})
const aiCaseAvailableProviders = computed(() =>
  aiCaseProviders.value.filter(item => item.status !== 0 && Boolean(item.modelName)),
)
const aiCaseSelectedProvider = computed(() =>
  aiCaseAvailableProviders.value.find(item => item.id === aiCaseSelectedProviderId.value) || null,
)
const aiCaseCanGenerate = computed(() =>
  Boolean(activeEditor.value?.definitionId)
  && Boolean(aiCaseSelectedProvider.value)
  && aiCaseSelectedOptionKeys.value.length > 0
  && aiCaseGenerationStatus.value !== 'running',
)
const aiCaseGenerationStatusText = computed(() => {
  if (aiCaseGenerationStatus.value === 'running') return '生成中'
  if (aiCaseGenerationStatus.value === 'done') return '已完成'
  if (aiCaseGenerationStatus.value === 'failed') return '失败'
  return '待生成'
})
const aiCasePendingResults = computed(() =>
  aiCaseGeneratedResults.value.filter(item => item.status === 'pending'),
)
const aiCaseAcceptedResults = computed(() =>
  aiCaseGeneratedResults.value.filter(item => item.status === 'accepted'),
)
const aiCaseDiscardedResults = computed(() =>
  aiCaseGeneratedResults.value.filter(item => item.status === 'discarded'),
)
const aiCaseFilteredResults = computed(() => {
  const keyword = aiCaseResultKeyword.value.trim().toLowerCase()
  return aiCaseGeneratedResults.value.filter((item) => {
    if (aiCaseResultFilter.value !== 'all' && item.status !== aiCaseResultFilter.value) return false
    if (aiCaseResultGroup.value && (item.draft.groupKey || item.draft.group || '') !== aiCaseResultGroup.value) return false
    if (aiCaseResultType.value && (item.draft.typeKey || item.draft.type || '') !== aiCaseResultType.value) return false
    if (!keyword) return true
    return [
      item.draft.name,
      item.draft.description,
      item.draft.expected,
      item.draft.group,
      item.draft.type,
      item.message,
    ].some(value => String(value || '').toLowerCase().includes(keyword))
  })
})
const aiCaseResultFilterOptions = computed<Array<{ label: string; value: ApiAiCaseResultFilter; count: number }>>(() => [
  { label: '全部', value: 'all', count: aiCaseGeneratedResults.value.length },
  { label: '待处理', value: 'pending', count: aiCasePendingResults.value.length },
  { label: '已采纳', value: 'accepted', count: aiCaseAcceptedResults.value.length },
  { label: '已弃用', value: 'discarded', count: aiCaseDiscardedResults.value.length },
])
const aiCaseResultGroupOptions = computed(() => {
  const options = new Map<string, string>()
  aiCaseGeneratedResults.value.forEach((item) => {
    const value = item.draft.groupKey || item.draft.group || ''
    if (value) options.set(value, item.draft.group || value)
  })
  return Array.from(options, ([value, label]) => ({ value, label }))
})
const aiCaseResultTypeOptions = computed(() => {
  const options = new Map<string, string>()
  aiCaseGeneratedResults.value.forEach((item) => {
    const value = item.draft.typeKey || item.draft.type || ''
    if (value) options.set(value, item.draft.type || value)
  })
  return Array.from(options, ([value, label]) => ({ value, label }))
})
const selectedPendingAiCaseResults = computed(() =>
  aiCasePendingResults.value.filter(item => aiCaseSelectedResultIds.value.includes(item.id)),
)

const filteredDefinitions = computed(() => {
  const keyword = directoryKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return definitions.value
  }

  return definitions.value.filter((item) => {
    return [
      item.name,
      item.path,
      item.method,
      item.directoryName || '',
      ...(item.tags || []),
    ].some(value => String(value).toLowerCase().includes(keyword))
  })
})

const directoryTree = computed<DirectoryNode[]>(() => {
  const moduleNodes = modules.value.map(mapModuleNode)
  const buckets = new Map<string, DirectoryNode>()

  function index(nodes: DirectoryNode[]) {
    nodes.forEach((node) => {
      if (node.type === 'module') {
        buckets.set(node.label, node)
        const shortName = node.label.split('/').pop()
        if (shortName) {
          buckets.set(shortName, node)
        }
      }
      index(node.children)
    })
  }

  index(moduleNodes)

  const unassigned: DirectoryNode = {
    key: 'definition-unassigned',
    type: 'unassigned',
    label: '未规划请求',
    count: 0,
    moduleId: null,
    workspaceCode: props.workspaceCode,
    definitionId: null,
    children: [],
  }

  filteredDefinitions.value.forEach((item) => {
    const requestNode: DirectoryNode = {
      key: `request:${item.id}`,
      type: 'request',
      label: item.name,
      count: 0,
      moduleId: null,
      workspaceCode: item.workspaceCode,
      definitionId: item.id,
      method: item.method,
      definition: item,
      children: [],
    }
    const target = item.directoryName ? buckets.get(item.directoryName) : null
    if (target) {
      target.children.push(requestNode)
      target.count += 1
    } else {
      unassigned.children.push(requestNode)
      unassigned.count += 1
    }
  })

  function rollupCount(nodes: DirectoryNode[]) {
    nodes.forEach((node) => {
      rollupCount(node.children)
      if (node.type === 'module') {
        node.count += node.children
          .filter(child => child.type === 'module')
          .reduce((sum, child) => sum + child.count, 0)
      }
    })
  }

  rollupCount(moduleNodes)

  const children = unassigned.children.length ? [...moduleNodes, unassigned] : moduleNodes
  return [{
    key: 'definition-root',
    type: 'root',
    label: '全部',
    count: filteredDefinitions.value.length,
    moduleId: null,
    workspaceCode: props.workspaceCode,
    definitionId: null,
    children,
  }]
})

function collectExpandableDirectoryKeys(nodes: DirectoryNode[]) {
  const keys: string[] = []
  function walk(node: DirectoryNode) {
    if (node.children.length) {
      keys.push(node.key)
      node.children.forEach(walk)
    }
  }
  nodes.forEach(walk)
  return keys
}

watch(
  () => [directoryKeyword.value, directoryTree.value],
  () => {
    if (directoryKeyword.value.trim()) {
      expandedKeys.value = Array.from(new Set(collectExpandableDirectoryKeys(directoryTree.value)))
    }
  },
)

const currentStep = computed<ApiRunStepResult | null>(() => activeEditor.value?.runResult?.stepResults?.[0] || null)
const caseDetailPreviewStep = computed<ApiRunStepResult | null>(() => selectedCaseRunHistoryDetail.value?.stepResults?.[0] || null)
const selectedEnvironment = computed(() => environments.value.find(item => item.id === selectedEnvironmentId.value) || null)
const selectedVariableSet = computed(() => variableSets.value.find(item => item.id === selectedVariableSetId.value) || null)
const responseStatus = computed(() => currentStep.value?.response?.statusCode ?? null)
const responseDuration = computed(() => currentStep.value?.durationMs ?? null)
const responseBody = computed(() => currentStep.value?.response?.body ?? '')
const responseBodyPretty = computed(() => {
  if (!currentStep.value && activeEditor.value?.runError) {
    return activeEditor.value.runError
  }
  return toPrettyJson(responseBody.value)
})
const responseHeaders = computed(() => JSON.stringify(currentStep.value?.response?.headers ?? {}, null, 2))
const actualRequest = computed(() => JSON.stringify({
  request: currentStep.value?.request ?? null,
  runOptions: {
    environmentId: selectedEnvironmentId.value,
    environmentName: selectedEnvironment.value?.name ?? null,
    variableSetId: selectedVariableSetId.value,
    variableSetName: selectedVariableSet.value?.name ?? null,
  },
}, null, 2))
const responseConsole = computed(() => {
  if (activeEditor.value?.runError) {
    return activeEditor.value.runError
  }
  if (!currentStep.value) {
    return ''
  }
  const lines = [currentStep.value.errorMessage || activeEditor.value?.runResult?.failureSummary || '请求执行完成']
  const extractionText = formatExtractionResults(currentStep.value.extractionResults ?? [])
  if (extractionText) {
    lines.push('', extractionText)
  }
  const processorText = formatProcessorResults(currentStep.value.processorResults ?? [])
  if (processorText) {
    lines.push('', processorText)
  }
  return lines.join('\n')
})
const assertionRows = computed(() => currentStep.value?.assertionResults ?? [])
const extractionRows = computed(() => currentStep.value?.extractionResults ?? [])
const processorRows = computed(() => currentStep.value?.processorResults ?? [])
const responseSize = computed(() => {
  const text = responseBody.value || ''
  if (!text) {
    return '-'
  }
  const bytes = new Blob([text]).size
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`
})
const showResponseEmpty = computed(() => !currentStep.value && !activeEditor.value?.runError)
const batchAddTitle = computed(() => {
  if (batchAddTarget.value === 'assertion') return '批量添加断言'
  if (batchAddTarget.value === 'extractor') return '批量添加提取器'
  if (batchAddTarget.value === 'cookie') return '批量添加 Cookie'
  if (batchAddTarget.value === 'header') return '批量添加请求头'
  if (batchAddTarget.value === 'body-form') return '批量添加表单项'
  return '批量添加 Query 参数'
})
const batchAddHint = computed(() => {
  if (batchAddTarget.value === 'extractor') return '每行一条，左侧为变量名，右侧为表达式，例如 token=$.data.token。'
  if (batchAddTarget.value === 'assertion') return '每行一条，左侧为断言名称，右侧为期望值，例如 status=200。'
  return '每行一条，支持 key=value、key: value 或 tab 分隔。'
})
const batchAddPlaceholder = computed(() => {
  if (batchAddTarget.value === 'extractor') return 'token=$.data.token\ntraceId=$.headers.traceId'
  if (batchAddTarget.value === 'assertion') return '状态码=200\n响应包含=success'
  return 'token=abc\nContent-Type: application/json'
})

function mapModuleNode(item: ApiDefinitionModuleItem): DirectoryNode {
  return {
    key: `module:${item.id}`,
    type: 'module',
    label: item.fullPath || item.name,
    count: 0,
    moduleId: item.id,
    workspaceCode: item.workspaceCode,
    definitionId: null,
    children: item.children.map(mapModuleNode),
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function emptyKeyValue(extra: Partial<ApiKeyValueInput> = {}): ApiKeyValueInput {
  return {
    key: '',
    value: '',
    description: '',
    enabled: true,
    paramType: 'string',
    required: false,
    encode: true,
    minLength: null,
    maxLength: null,
    fileName: null,
    fileSize: null,
    contentType: null,
    fileBase64: null,
    ...extra,
  }
}

function emptyRequestConfig(method = 'GET'): ApiRequestConfigInput {
  return {
    method,
    path: '',
    timeoutMs: 10000,
    queryParams: [emptyKeyValue()],
    headers: [emptyKeyValue()],
    cookies: [],
    body: {
      type: 'NONE',
      rawText: '',
      formItems: [emptyKeyValue()],
      contentType: null,
      fileName: null,
      fileSize: null,
      binaryBase64: null,
    },
    authConfig: {
      authType: 'NONE',
      basicAuth: { userName: '', password: '' },
      digestAuth: { userName: '', password: '' },
    },
  }
}

function createDraftDetail(): ApiDefinitionDetail {
  return {
    id: 0,
    workspaceCode: props.workspaceCode,
    workspaceName: props.workspaceCode,
    name: '新建请求',
    method: 'GET',
    path: '',
    directoryName: null,
    description: '',
    tags: [],
    lastRunResult: null,
    lastRunAt: null,
    updatedAt: null,
    requestConfig: emptyRequestConfig(),
    assertions: [],
    extractors: [],
    preProcessors: [],
    postProcessors: [],
    createdAt: null,
  }
}

function editorTitle(detail: ApiDefinitionDetail) {
  return detail.name?.trim() || detail.requestConfig.path?.trim() || '新建请求'
}

function enabledRows(rows?: ApiKeyValueInput[]) {
  return (rows || []).filter(row => row.enabled !== false && row.key.trim())
}

function markDirty() {
  if (activeEditor.value) {
    activeEditor.value.dirty = true
    activeEditor.value.method = activeEditor.value.detail.requestConfig.method
    activeEditor.value.title = editorTitle(activeEditor.value.detail)
  }
}

function requestMethodClass(method?: string) {
  return `method-${String(method || 'GET').toLowerCase()}`
}

function statusTone(status: number | null) {
  if (status == null) return 'empty'
  if (status >= 200 && status < 300) return 'success'
  if (status >= 400) return 'danger'
  return 'warning'
}

function formatFileSize(size?: number | null) {
  if (!size) return '-'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function formatDuration(value?: number | null) {
  if (value == null) return '-'
  return `${value} ms`
}

function formatResponseSize(value?: number | null) {
  return formatFileSize(value)
}

function runResultLabel(result?: string | null) {
  if (!result) return '-'
  const normalized = String(result).toUpperCase()
  if (['PASSED', 'SUCCESS', 'DONE'].includes(normalized)) return '通过'
  if (['FAILED', 'FAILURE', 'ERROR'].includes(normalized)) return '失败'
  if (['RUNNING', 'PENDING'].includes(normalized)) return '执行中'
  if (normalized === 'NO_ASSERTION') return '无断言'
  return result
}

function runResultClass(result?: string | null) {
  const normalized = String(result || '').toUpperCase()
  if (['PASSED', 'SUCCESS', 'DONE'].includes(normalized)) return 'is-passed'
  if (['FAILED', 'FAILURE', 'ERROR'].includes(normalized)) return 'is-failed'
  return 'is-neutral'
}

function toPrettyJson(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function readFileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

async function readDebugFile(file: File) {
  if (file.size > maxDebugFileBytes) {
    ElMessage.warning(`文件过大，请选择 ${formatFileSize(maxDebugFileBytes)} 以内的文件`)
    return null
  }
  return {
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || 'application/octet-stream',
    base64: await readFileBase64(file),
  }
}

async function handleFormFileChange(row: ApiKeyValueInput, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const payload = await readDebugFile(file)
    if (!payload) return
    row.fileName = payload.fileName
    row.fileSize = payload.fileSize
    row.contentType = payload.contentType
    row.fileBase64 = payload.base64
    row.value = payload.fileName
    markDirty()
  } catch {
    ElMessage.error('文件读取失败')
  }
}

function clearFormFile(row: ApiKeyValueInput) {
  row.fileName = null
  row.fileSize = null
  row.contentType = null
  row.fileBase64 = null
  row.value = ''
  markDirty()
}

async function handleBinaryFileChange(event: Event) {
  if (!activeEditor.value) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const payload = await readDebugFile(file)
    if (!payload) return
    const body = activeEditor.value.detail.requestConfig.body
    body.fileName = payload.fileName
    body.fileSize = payload.fileSize
    body.contentType = payload.contentType
    body.binaryBase64 = payload.base64
    markDirty()
  } catch {
    ElMessage.error('文件读取失败')
  }
}

function clearBinaryFile() {
  if (!activeEditor.value) return
  const body = activeEditor.value.detail.requestConfig.body
  body.fileName = null
  body.fileSize = null
  body.contentType = null
  body.binaryBase64 = null
  markDirty()
}

function assertionRowsFor(detail: ApiDefinitionDetail): ApiAssertionConfig[] {
  const rows = detail.assertions as ApiAssertionConfig[]
  rows.forEach(normalizeAssertion)
  return rows
}

function normalizeAssertion(assertion: ApiAssertionConfig) {
  const type = normalizeAssertionType(assertion.assertionType || assertion.type)
  assertion.id = assertion.id || `assertion-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  assertion.enabled = assertion.enabled !== false
  assertion.assertionType = type
  assertion.type = type
  assertion.name = assertion.name || defaultAssertionName(type)
  assertion.condition = normalizeAssertionCondition(assertion.condition || assertion.operator)
  assertion.operator = assertion.operator || assertion.condition
  assertion.expressionType = assertion.expressionType || defaultAssertionExpressionType(type)
  assertion.expression = assertion.expression || ''
  assertion.expectedValue = assertion.expectedValue || ''
  if (type === 'RESPONSE_CODE') {
    assertion.expectedValue = assertion.expectedValue || '200'
  }
  if (type === 'RESPONSE_HEADER') {
    assertion.expressionType = 'HEADER'
    assertion.assertions = normalizeAssertionItems(assertion.assertions, {
      header: assertion.subject || assertion.expression || '',
      condition: assertion.condition,
      expectedValue: assertion.expectedValue,
    })
  }
  if (type === 'RESPONSE_BODY') {
    assertion.assertionBodyType = normalizeAssertionExpressionType(assertion.assertionBodyType || assertion.expressionType)
    assertion.expressionType = assertion.assertionBodyType
    assertion.jsonPathAssertion = normalizeAssertionGroup(assertion.jsonPathAssertion, assertion, 'JSON_PATH')
    assertion.xpathAssertion = normalizeAssertionGroup(assertion.xpathAssertion, assertion, 'X_PATH')
    assertion.regexAssertion = normalizeAssertionGroup(assertion.regexAssertion, assertion, 'REGEX')
  }
  if (type === 'RESPONSE_TIME') {
    assertion.condition = normalizeAssertionCondition(assertion.condition || 'LT_OR_EQUALS')
    assertion.expectedValue = assertion.expectedValue || '1000'
  }
  if (type === 'VARIABLE') {
    assertion.expressionType = 'VARIABLE'
    assertion.variableAssertionItems = normalizeAssertionItems(assertion.variableAssertionItems, {
      variableName: assertion.subject || assertion.expression || '',
      condition: assertion.condition,
      expectedValue: assertion.expectedValue,
    })
  }
  if (type === 'SCRIPT') {
    assertion.expressionType = 'SCRIPT'
    assertion.scriptLanguage = assertion.scriptLanguage || 'JavaScript'
    assertion.script = assertion.script ?? ''
  }
}

function normalizeAssertionType(type?: string | null) {
  const value = (type || 'RESPONSE_CODE').toUpperCase()
  if (value === 'STATUS_CODE') return 'RESPONSE_CODE'
  if (value === 'HEADER_EQUALS' || value === 'HEADER_CONTAINS') return 'RESPONSE_HEADER'
  if (value === 'BODY_JSONPATH_EQUALS' || value === 'BODY_JSONPATH_CONTAINS') return 'RESPONSE_BODY'
  if (value === 'RESPONSE_TIME_LE') return 'RESPONSE_TIME'
  return assertionTypeOptions.some(item => item.value === value) ? value : 'RESPONSE_CODE'
}

function normalizeAssertionCondition(condition?: string | null) {
  const value = (condition || 'EQUALS').toUpperCase()
  if (value === 'HEADER_CONTAINS' || value === 'BODY_JSONPATH_CONTAINS') return 'CONTAINS'
  if (value === 'RESPONSE_TIME_LE') return 'LT_OR_EQUALS'
  return assertionConditionOptions.some(item => item.value === value) ? value : 'EQUALS'
}

function normalizeAssertionExpressionType(type?: string | null): ApiAssertionExpressionType {
  const value = (type || 'JSON_PATH').toUpperCase()
  if (value === 'XPATH') return 'X_PATH'
  if (value === 'X_PATH' || value === 'REGEX') return value
  return 'JSON_PATH'
}

function defaultAssertionName(type?: string | null) {
  return assertionTypeLabel(type) || '断言'
}

function assertionTypeLabel(type?: string | null) {
  return assertionTypeOptions.find(item => item.value === normalizeAssertionType(type))?.label || '断言'
}

function defaultAssertionExpressionType(type?: string | null): ApiAssertionExpressionType {
  const normalizedType = normalizeAssertionType(type)
  if (normalizedType === 'RESPONSE_HEADER') return 'HEADER'
  if (normalizedType === 'VARIABLE') return 'VARIABLE'
  if (normalizedType === 'SCRIPT') return 'SCRIPT'
  return 'JSON_PATH'
}

function defaultAssertionExpression(type?: ApiAssertionExpressionType | string | null) {
  if (type === 'X_PATH') return '/root'
  if (type === 'REGEX') return '.+'
  return '$.data'
}

function normalizeAssertionItem(item: ApiAssertionItemConfig): ApiAssertionItemConfig {
  Object.assign(item, {
    enabled: item.enabled !== false,
    condition: normalizeAssertionCondition(item.condition || item.operator),
    operator: normalizeAssertionCondition(item.condition || item.operator),
    expectedValue: item.expectedValue ?? '',
  })
  return item
}

function normalizeAssertionItems(items: ApiAssertionItemConfig[] | undefined, fallback: ApiAssertionItemConfig): ApiAssertionItemConfig[] {
  const source = items?.length ? items : [fallback]
  source.forEach(normalizeAssertionItem)
  return source
}

function normalizeAssertionGroup(group: ApiAssertionGroupConfig | undefined, assertion: ApiAssertionConfig, type: ApiAssertionExpressionType): ApiAssertionGroupConfig {
  const fallbackExpression = type === 'JSON_PATH'
    ? assertion.expression || defaultAssertionExpression(type)
    : defaultAssertionExpression(type)
  const next = group || { assertions: [] }
  next.responseFormat = next.responseFormat || 'XML'
  next.assertions = normalizeAssertionItems(next.assertions, {
    expression: fallbackExpression,
    condition: assertion.condition,
    expectedValue: type === 'JSON_PATH' ? assertion.expectedValue : '',
  })
  return next
}

function activeAssertionRows() {
  return activeEditor.value ? assertionRowsFor(activeEditor.value.detail) : []
}

const activeAssertion = computed(() => {
  const rows = activeAssertionRows()
  if (!rows.length) return null
  return rows.find(item => item.id === activeAssertionId.value) || rows[0]
})

function extractorRowsFor(detail: ApiDefinitionDetail): ApiExtractorConfig[] {
  const rows = detail.extractors as ApiExtractorConfig[]
  rows.forEach(normalizeExtractor)
  return rows
}

function normalizeExtractor(extractor: ApiExtractorConfig) {
  extractor.enabled = extractor.enabled !== false
  extractor.source = extractor.source || extractor.sourceType || 'RESPONSE_BODY'
  extractor.sourceType = extractor.sourceType || extractor.source
  extractor.extractType = extractor.extractType || extractor.expressionType || 'JSON_PATH'
  extractor.expressionType = extractor.expressionType || extractor.extractType
  extractor.name = extractor.name || extractor.variableName || '响应提取'
  extractor.variableName = extractor.variableName || extractor.name
  extractor.expression = extractor.expression || '$.data'
}

function processorRowsFor(detail: ApiDefinitionDetail, stage: 'pre' | 'post'): ApiProcessorConfig[] {
  const rows = (stage === 'pre' ? detail.preProcessors : detail.postProcessors) as ApiProcessorConfig[]
  rows.forEach(row => normalizeProcessorDefaults(row, stage))
  return rows
}

function normalizeProcessorDefaults(processor: ApiProcessorConfig, stage: 'pre' | 'post') {
  const type = processor.processorType || 'SCRIPT'
  processor.id = processor.id || `${stage}-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  processor.enabled = processor.enabled !== false
  processor.name = processor.name || processorDefaultName(stage, type)
  if (type === 'TIME_WAITING') {
    processor.delayMs = processor.delayMs || 1000
  }
  if (type === 'SCRIPT') {
    processor.script = processor.script ?? ''
  }
  if (type === 'SQL') {
    processor.sql = processor.sql ?? processor.script ?? ''
    processor.script = processor.sql
    processor.dataSourceName = processor.dataSourceName ?? ''
  }
  if (type === 'EXTRACT') {
    processor.sourceType = processor.sourceType || 'RESPONSE_BODY'
    processor.extractType = processor.extractType || 'JSON_PATH'
    processor.expression = processor.expression ?? processor.script ?? ''
    processor.variableName = processor.variableName ?? ''
    processor.script = processor.expression
    processor.extractors = normalizeProcessorExtractItems(processor.extractors, processor)
  }
}

function createAssertion(type = 'RESPONSE_CODE', name?: string, expectedValue?: string): ApiAssertionConfig {
  const normalizedType = normalizeAssertionType(type)
  const assertion: ApiAssertionConfig = {
    id: `assertion-${normalizedType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    assertionType: normalizedType,
    type: normalizedType,
    name: name || defaultAssertionName(normalizedType),
    enabled: true,
    subject: '',
    expressionType: defaultAssertionExpressionType(normalizedType),
    expression: '',
    condition: normalizedType === 'RESPONSE_TIME' ? 'LT_OR_EQUALS' : 'EQUALS',
    operator: normalizedType === 'RESPONSE_TIME' ? 'LT_OR_EQUALS' : 'EQUALS',
    expectedValue: expectedValue || (normalizedType === 'RESPONSE_CODE' ? '200' : normalizedType === 'RESPONSE_TIME' ? '1000' : ''),
    script: null,
  }
  normalizeAssertion(assertion)
  return assertion
}

function addAssertion(type = 'RESPONSE_CODE') {
  if (!activeEditor.value) return
  const assertion = createAssertion(type)
  assertionRowsFor(activeEditor.value.detail).push(assertion)
  activeAssertionId.value = assertion.id || ''
  markDirty()
}

function addAssertionFromCommand(command: string | number | object) {
  addAssertion(String(command))
}

function removeAssertion(index: number) {
  if (!activeEditor.value) return
  const rows = assertionRowsFor(activeEditor.value.detail)
  const removed = rows.splice(index, 1)
  if (removed.some(item => item.id === activeAssertionId.value)) {
    activeAssertionId.value = rows[Math.min(index, rows.length - 1)]?.id || ''
  }
  markDirty()
}

function selectAssertion(assertion: ApiAssertionConfig) {
  activeAssertionId.value = assertion.id || ''
}

function copyAssertion(index: number) {
  if (!activeEditor.value) return
  const rows = assertionRowsFor(activeEditor.value.detail)
  const source = rows[index]
  if (!source) return
  const copied = {
    ...clone(source),
    id: `assertion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `${source.name || '断言'} 副本`,
  }
  rows.splice(index + 1, 0, copied)
  activeAssertionId.value = copied.id || ''
  markDirty()
}

function moveAssertion(index: number, direction: -1 | 1) {
  if (!activeEditor.value) return
  const rows = assertionRowsFor(activeEditor.value.detail)
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(targetIndex, 0, row)
  markDirty()
}

function activeAssertionBodyGroup(assertion: ApiAssertionConfig): ApiAssertionGroupConfig {
  normalizeAssertion(assertion)
  if (assertion.assertionBodyType === 'X_PATH') return assertion.xpathAssertion!
  if (assertion.assertionBodyType === 'REGEX') return assertion.regexAssertion!
  return assertion.jsonPathAssertion!
}

function addAssertionItem(items: ApiAssertionItemConfig[], fallback: ApiAssertionItemConfig = {}) {
  items.push(normalizeAssertionItem({
    enabled: true,
    condition: 'EQUALS',
    expectedValue: '',
    ...fallback,
  }))
  markDirty()
}

function copyAssertionItem(items: ApiAssertionItemConfig[], index: number) {
  const source = items[index]
  if (!source) return
  items.splice(index + 1, 0, clone(source))
  markDirty()
}

function removeAssertionItem(items: ApiAssertionItemConfig[], index: number, fallback: ApiAssertionItemConfig) {
  items.splice(index, 1)
  if (!items.length) {
    items.push(normalizeAssertionItem(fallback))
  }
  markDirty()
}

function normalizeAssertionForType(assertion: ApiAssertionConfig) {
  assertion.assertionType = normalizeAssertionType(assertion.assertionType)
  assertion.type = assertion.assertionType
  assertion.name = assertion.name || defaultAssertionName(assertion.assertionType)
  assertion.expressionType = defaultAssertionExpressionType(assertion.assertionType)
  normalizeAssertion(assertion)
  markDirty()
}

function testAssertionExpression(assertion: ApiAssertionConfig, item?: ApiAssertionItemConfig) {
  if (!currentStep.value) {
    ElMessage.info('请先发送请求，再测试表达式')
    return
  }
  if (assertion.assertionType === 'RESPONSE_CODE') {
    ElMessage.success(`当前响应码：${currentStep.value.response?.statusCode ?? '-'}`)
    return
  }
  if (assertion.assertionType === 'RESPONSE_HEADER') {
    const key = item?.header || assertion.expression || assertion.subject || ''
    const value = key ? (currentStep.value.response?.headers as Record<string, unknown> | undefined)?.[key] : undefined
    ElMessage.info(value == null ? '未在最近响应头中找到该字段' : `匹配值：${String(value)}`)
    return
  }
  if (assertion.assertionType === 'RESPONSE_TIME') {
    ElMessage.info(`最近耗时：${currentStep.value.durationMs ?? '-'} ms`)
    return
  }
  if (assertion.assertionType === 'RESPONSE_BODY' && (assertion.assertionBodyType || assertion.expressionType) === 'JSON_PATH') {
    try {
      const body = JSON.parse(String(currentStep.value.response?.body || '{}')) as Record<string, unknown>
      const expression = item?.expression || assertion.expression || ''
      const key = expression.replace(/^\$\./, '')
      const value = key ? key.split('.').reduce<unknown>((acc, part) => {
        if (!acc || typeof acc !== 'object') return undefined
        return (acc as Record<string, unknown>)[part]
      }, body) : body
      ElMessage.info(value == null ? '未在最近响应体中匹配到值' : `匹配值：${String(value)}`)
    } catch {
      ElMessage.warning('最近响应体不是可解析的 JSON')
    }
    return
  }
  ElMessage.info('当前表达式类型需要后端执行时验证')
}

function fillAssertionFromResponse(assertion: ApiAssertionConfig, item?: ApiAssertionItemConfig) {
  if (!currentStep.value) {
    ElMessage.info('请先发送请求，再从响应快速提取')
    return
  }
  const bodyText = String(currentStep.value.response?.body || '')
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>
    const firstKey = ['message', 'code', 'success', 'data'].find(key => key in body)
    if (!firstKey) {
      ElMessage.info('最近响应体没有可快速提取的常见字段')
      return
    }
    assertion.assertionType = 'RESPONSE_BODY'
    assertion.type = 'RESPONSE_BODY'
    assertion.expressionType = 'JSON_PATH'
    assertion.assertionBodyType = 'JSON_PATH'
    const target = item || activeAssertionBodyGroup(assertion).assertions[0]
    target.expression = `$.${firstKey}`
    target.expectedValue = String(body[firstKey] ?? '')
    assertion.expression = target.expression
    assertion.expectedValue = target.expectedValue
    markDirty()
    ElMessage.success('已从最近响应填入表达式和期望值')
  } catch {
    ElMessage.warning('最近响应体不是可解析的 JSON')
  }
}

function firstJsonAssertionCandidate() {
  const bodyText = String(currentStep.value?.response?.body || '')
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>
    const firstKey = ['code', 'success', 'message', 'data'].find(key => key in body)
    if (!firstKey) return null
    return { expression: `$.${firstKey}`, value: String(body[firstKey] ?? '') }
  } catch {
    return null
  }
}

function addAssertionFromLatestResponse(type: 'code' | 'header' | 'body') {
  if (!activeEditor.value) return
  if (!currentStep.value) {
    ElMessage.info('请先发送请求，再从最近响应生成断言')
    return
  }
  const rows = assertionRowsFor(activeEditor.value.detail)
  if (type === 'code') {
    const assertion = createAssertion('RESPONSE_CODE', '响应码等于当前值', String(currentStep.value.response?.statusCode ?? 200))
    rows.push(assertion)
    activeAssertionId.value = assertion.id || ''
    markDirty()
    ElMessage.success('已生成响应码断言')
    return
  }
  if (type === 'header') {
    const headers = currentStep.value.response?.headers as Record<string, unknown> | undefined
    const key = Object.keys(headers || {})[0]
    if (!key) {
      ElMessage.info('最近响应没有可提取的响应头')
      return
    }
    const assertion = createAssertion('RESPONSE_HEADER', `响应头 ${key}`, String(headers?.[key] ?? ''))
    assertion.expression = key
    assertion.subject = key
    assertion.assertions = [{ header: key, condition: 'EQUALS', expectedValue: String(headers?.[key] ?? '') }]
    normalizeAssertion(assertion)
    rows.push(assertion)
    activeAssertionId.value = assertion.id || ''
    markDirty()
    ElMessage.success('已生成响应头断言')
    return
  }
  const candidate = firstJsonAssertionCandidate()
  if (!candidate) {
    ElMessage.info('最近响应体不是可快速提取的 JSON 字段')
    return
  }
  const assertion = createAssertion('RESPONSE_BODY', '响应体 JSONPath 断言', candidate.value)
  assertion.expressionType = 'JSON_PATH'
  assertion.assertionBodyType = 'JSON_PATH'
  assertion.expression = candidate.expression
  assertion.jsonPathAssertion = {
    assertions: [{
      expression: candidate.expression,
      condition: 'EQUALS',
      expectedValue: candidate.value,
    }],
  }
  normalizeAssertion(assertion)
  rows.push(assertion)
  activeAssertionId.value = assertion.id || ''
  markDirty()
  ElMessage.success('已生成响应体 JSONPath 断言')
}

function addAssertionFromLatestResponseCommand(command: string | number | object) {
  const value = String(command)
  if (value === 'code' || value === 'header' || value === 'body') {
    addAssertionFromLatestResponse(value)
  }
}

function clampResponsePanelHeight(value: number) {
  return Math.min(responsePanelMaxHeight, Math.max(responsePanelMinHeight, Math.round(value)))
}

function persistResponsePanelHeight() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(responsePanelHeightStorageKey, String(responsePanelHeight.value))
}

function handleResponseResizeMove(event: PointerEvent) {
  const nextHeight = responseResizeStartHeight - (event.clientY - responseResizeStartY)
  responsePanelHeight.value = clampResponsePanelHeight(nextHeight)
}

function stopResponseResize() {
  if (typeof window === 'undefined') return
  window.removeEventListener('pointermove', handleResponseResizeMove)
  window.removeEventListener('pointerup', stopResponseResize)
  persistResponsePanelHeight()
}

function startResponseResize(event: PointerEvent) {
  if (typeof window === 'undefined') return
  responseResizeStartY = event.clientY
  responseResizeStartHeight = responsePanelHeight.value
  window.addEventListener('pointermove', handleResponseResizeMove)
  window.addEventListener('pointerup', stopResponseResize, { once: true })
}

function restoreResponsePanelHeight() {
  if (typeof window === 'undefined') return
  const savedHeight = Number(window.localStorage.getItem(responsePanelHeightStorageKey))
  if (Number.isFinite(savedHeight) && savedHeight > 0) {
    responsePanelHeight.value = clampResponsePanelHeight(savedHeight)
  }
}

function createExtractor(name = '响应提取', expression = '$.data', variableName?: string): ApiExtractorConfig {
  const normalizedName = name.trim() || '响应提取'
  return {
    id: `extractor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: normalizedName,
    enabled: true,
    source: 'RESPONSE_BODY',
    sourceType: 'RESPONSE_BODY',
    extractType: 'JSON_PATH',
    expressionType: 'JSON_PATH',
    expression: expression.trim() || '$.data',
    variableName: variableName?.trim() || normalizedName,
    defaultValue: '',
    required: false,
    failOnMissing: false,
    description: '',
  }
}

function addExtractor() {
  if (!activeEditor.value) return
  extractorRowsFor(activeEditor.value.detail).push(createExtractor())
  markDirty()
}

function removeExtractor(index: number) {
  if (!activeEditor.value) return
  extractorRowsFor(activeEditor.value.detail).splice(index, 1)
  markDirty()
}

function createProcessor(stage: 'pre' | 'post', type = 'SCRIPT'): ApiProcessorConfig {
  const processor: ApiProcessorConfig = {
    id: `${stage}-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    processorType: type,
    name: processorDefaultName(stage, type),
    enabled: true,
    script: type === 'TIME_WAITING' ? null : '',
    sql: type === 'SQL' ? '' : null,
    dataSourceName: type === 'SQL' ? '' : null,
    delayMs: type === 'TIME_WAITING' ? 1000 : null,
    sourceType: type === 'EXTRACT' ? 'RESPONSE_BODY' : null,
    extractType: type === 'EXTRACT' ? 'JSON_PATH' : null,
    expression: type === 'EXTRACT' ? '' : null,
    variableName: type === 'EXTRACT' ? '' : null,
    extractors: type === 'EXTRACT' ? [createProcessorExtractItem()] : [],
  }
  return processor
}

function createProcessorExtractItem(patch: Partial<ApiProcessorExtractItem> = {}): ApiProcessorExtractItem {
  return {
    id: `extract-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: true,
    name: '',
    variableName: '',
    description: '',
    variableType: 'TEMPORARY',
    sourceType: 'RESPONSE_BODY',
    extractType: 'JSON_PATH',
    expression: '',
    ...patch,
  }
}

function normalizeProcessorExtractItem(item: ApiProcessorExtractItem): ApiProcessorExtractItem {
  item.id = item.id || `extract-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  item.enabled = item.enabled !== false
  item.name = item.name ?? ''
  item.variableName = item.variableName ?? ''
  item.description = item.description ?? ''
  item.variableType = item.variableType || 'TEMPORARY'
  item.sourceType = item.sourceType || 'RESPONSE_BODY'
  item.extractType = item.extractType || 'JSON_PATH'
  item.expression = item.expression ?? ''
  return item
}

function normalizeProcessorExtractItems(items: ApiProcessorExtractItem[] | undefined, processor: ApiProcessorConfig) {
  const source = items?.length
    ? items
    : [createProcessorExtractItem({
        name: processor.name || '提取项',
        variableName: processor.variableName || '',
        sourceType: processor.sourceType || 'RESPONSE_BODY',
        extractType: processor.extractType || 'JSON_PATH',
        expression: processor.expression || '',
        description: processor.description || '',
      })]
  source.forEach(normalizeProcessorExtractItem)
  return source
}

function processorDefaultName(stage: 'pre' | 'post', type?: string) {
  if (type === 'SCRIPT') return stage === 'pre' ? '前置脚本' : '后置脚本'
  if (type === 'SQL') return 'SQL 处理器'
  if (type === 'TIME_WAITING') return '等待处理器'
  if (type === 'EXTRACT') return '提取处理器'
  return stage === 'pre' ? '前置处理器' : '后置处理器'
}

function processorConfigPlaceholder(type?: string) {
  if (type === 'SCRIPT') return '请输入 JavaScript 脚本'
  if (type === 'SQL') return '请输入 SQL 语句'
  if (type === 'EXTRACT') return '请输入提取配置，例如 token = $.data.token'
  return '请输入处理器配置'
}

function normalizeProcessorForType(processor: ApiProcessorConfig, stage: 'pre' | 'post') {
  const type = processor.processorType || 'SCRIPT'
  const currentName = processor.name?.trim() || ''
  const defaultNames = [
    '前置处理器',
    '后置处理器',
    '前置脚本',
    '后置脚本',
    'SQL 处理器',
    '等待处理器',
    '提取处理器',
  ]
  processor.name = !currentName || defaultNames.includes(currentName)
    ? processorDefaultName(stage, type)
    : currentName
  if (type === 'TIME_WAITING') {
    processor.script = null
    processor.sql = null
    processor.expression = null
    processor.delayMs = processor.delayMs || 1000
  } else if (type === 'SQL') {
    processor.sql = processor.sql ?? processor.script ?? ''
    processor.script = processor.sql
    processor.delayMs = null
    processor.dataSourceName = processor.dataSourceName ?? ''
  } else if (type === 'EXTRACT') {
    processor.expression = processor.expression ?? processor.script ?? ''
    processor.script = processor.expression
    processor.sourceType = processor.sourceType || 'RESPONSE_BODY'
    processor.extractType = processor.extractType || 'JSON_PATH'
    processor.variableName = processor.variableName ?? ''
    processor.extractors = normalizeProcessorExtractItems(processor.extractors, processor)
    processor.delayMs = null
  } else {
    processor.script = processor.script ?? ''
    processor.delayMs = null
    processor.sql = null
    processor.expression = null
  }
  markDirty()
}

function addProcessor(stage: 'pre' | 'post', type = 'SCRIPT') {
  if (!activeEditor.value) return
  processorRowsFor(activeEditor.value.detail, stage).push(createProcessor(stage, type))
  markDirty()
}

function addProcessorFromCommand(stage: 'pre' | 'post', command: string | number | object) {
  addProcessor(stage, String(command))
}

function removeProcessor(stage: 'pre' | 'post', index: number) {
  if (!activeEditor.value) return
  processorRowsFor(activeEditor.value.detail, stage).splice(index, 1)
  markDirty()
}

function copyProcessor(stage: 'pre' | 'post', index: number) {
  if (!activeEditor.value) return
  const rows = processorRowsFor(activeEditor.value.detail, stage)
  const source = rows[index]
  if (!source) return
  const copied = {
    ...clone(source),
    id: `${stage}-${String(source.processorType || 'SCRIPT').toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `${source.name || processorDefaultName(stage, source.processorType)} 副本`,
  }
  rows.splice(index + 1, 0, copied)
  markDirty()
}

function moveProcessor(stage: 'pre' | 'post', index: number, direction: -1 | 1) {
  if (!activeEditor.value) return
  const rows = processorRowsFor(activeEditor.value.detail, stage)
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(targetIndex, 0, row)
  markDirty()
}

function syncProcessorScript(processor: ApiProcessorConfig) {
  if (processor.processorType === 'SQL') {
    processor.script = processor.sql ?? ''
  } else if (processor.processorType === 'EXTRACT') {
    const firstExtractor = processor.extractors?.[0]
    processor.expression = firstExtractor?.expression ?? processor.expression ?? ''
    processor.variableName = firstExtractor?.variableName ?? processor.variableName ?? ''
    processor.sourceType = firstExtractor?.sourceType ?? processor.sourceType ?? 'RESPONSE_BODY'
    processor.extractType = firstExtractor?.extractType ?? processor.extractType ?? 'JSON_PATH'
    processor.script = processor.expression ?? ''
  }
  markDirty()
}

function addProcessorExtractItem(processor: ApiProcessorConfig) {
  processor.extractors = normalizeProcessorExtractItems(processor.extractors, processor)
  processor.extractors.push(createProcessorExtractItem())
  syncProcessorScript(processor)
}

function copyProcessorExtractItem(processor: ApiProcessorConfig, index: number) {
  const rows = normalizeProcessorExtractItems(processor.extractors, processor)
  const source = rows[index]
  if (!source) return
  rows.splice(index + 1, 0, { ...clone(source), id: `extract-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
  processor.extractors = rows
  syncProcessorScript(processor)
}

function removeProcessorExtractItem(processor: ApiProcessorConfig, index: number) {
  const rows = normalizeProcessorExtractItems(processor.extractors, processor)
  rows.splice(index, 1)
  if (!rows.length) rows.push(createProcessorExtractItem())
  processor.extractors = rows
  syncProcessorScript(processor)
}

function buildPayload(detail: ApiDefinitionDetail): SaveApiDefinitionPayload {
  return {
    workspaceCode: props.workspaceCode === 'ALL' ? detail.workspaceCode : props.workspaceCode,
    name: detail.name?.trim() || detail.requestConfig.path?.trim() || '未命名接口',
    directoryName: detail.directoryName || null,
    description: detail.description || null,
    tags: Array.isArray(detail.tags) ? detail.tags : [],
    requestConfig: clone({
      ...detail.requestConfig,
      method: detail.requestConfig.method || 'GET',
      path: detail.requestConfig.path || '',
      timeoutMs: Number(detail.requestConfig.timeoutMs || 10000),
    }),
    assertions: clone(detail.assertions || []),
    extractors: clone(detail.extractors || []),
    preProcessors: clone(detail.preProcessors || []),
    postProcessors: clone(detail.postProcessors || []),
  }
}

function runOptionStorageKey(kind: 'environment' | 'variableSet') {
  return `api-interface:${props.workspaceCode}:${kind}`
}

function restoreRunOptions() {
  const environmentId = Number(localStorage.getItem(runOptionStorageKey('environment')) || '')
  const variableSetId = Number(localStorage.getItem(runOptionStorageKey('variableSet')) || '')
  selectedEnvironmentId.value = environmentId && environments.value.some(item => item.id === environmentId) ? environmentId : null
  selectedVariableSetId.value = variableSetId && variableSets.value.some(item => item.id === variableSetId) ? variableSetId : null
}

function persistRunOptions() {
  if (selectedEnvironmentId.value) {
    localStorage.setItem(runOptionStorageKey('environment'), String(selectedEnvironmentId.value))
  } else {
    localStorage.removeItem(runOptionStorageKey('environment'))
  }
  if (selectedVariableSetId.value) {
    localStorage.setItem(runOptionStorageKey('variableSet'), String(selectedVariableSetId.value))
  } else {
    localStorage.removeItem(runOptionStorageKey('variableSet'))
  }
}

function currentRunPayload() {
  return {
    workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
    environmentId: selectedEnvironmentId.value || null,
    variableSetId: selectedVariableSetId.value || null,
  }
}

async function loadWorkspaceData() {
  if (!props.workspaceReady) {
    return
  }

  loading.value = true
  moduleLoading.value = true
  definitionLoading.value = true
  runOptionsLoading.value = true
  moduleErrorMessage.value = ''
  definitionErrorMessage.value = ''
  runOptionsErrorMessage.value = ''

  try {
    const [moduleItems, definitionPage, environmentPage, variableSetPage] = await Promise.all([
      apiAutomationApi.getDefinitionModules(props.workspaceCode),
      apiAutomationApi.getDefinitions(props.workspaceCode, { pageNo: 1, pageSize: 500 }),
      apiAutomationApi.getEnvironments(props.workspaceCode),
      apiAutomationApi.getVariableSets(props.workspaceCode),
    ])
    modules.value = moduleItems
    definitions.value = definitionPage.items
    environments.value = environmentPage.items
    variableSets.value = variableSetPage.items
    restoreRunOptions()
    emit('loaded', { definitions: definitions.value, modules: modules.value, cases: cases.value })
    if (!tabs.value.length && definitions.value.length) {
      void openDefinition(definitions.value[0])
    }
    if (!tabs.value.length && !definitions.value.length) {
      openNewRequestTab()
    }
  } catch (error) {
    const message = getRequestErrorMessage(error)
    moduleErrorMessage.value = message
    definitionErrorMessage.value = message
    runOptionsErrorMessage.value = message
  } finally {
    loading.value = false
    moduleLoading.value = false
    definitionLoading.value = false
    runOptionsLoading.value = false
  }
}

async function loadCasesForDefinition(definitionId: number) {
  try {
    const page = await apiAutomationApi.getCases(props.workspaceCode, { definitionId, pageNo: 1, pageSize: 100 })
    const others = cases.value.filter(item => item.definitionId !== definitionId)
    cases.value = [...others, ...page.items]
    emit('loaded', { definitions: definitions.value, modules: modules.value, cases: cases.value })
  } catch (error) {
    ElMessage.warning(getRequestErrorMessage(error))
  }
}

function openNewRequestTab(source?: ApiDefinitionDetail) {
  const detail = source ? clone(source) : createDraftDetail()
  const key = source?.id ? `definition:${source.id}:${Date.now()}` : `draft:${Date.now()}`
  const tab: EditorTab = {
    key,
    definitionId: source?.id || null,
    title: editorTitle(detail),
    method: detail.requestConfig.method || detail.method || 'GET',
    dirty: !source,
    activeTab: 'body',
    responseTab: 'body',
    detail,
    runResult: null,
    runError: '',
    loading: false,
  }
  tabs.value.push(tab)
  activeEditorKey.value = key
  void nextTick(() => {
    urlInputRef.value?.focus()
  })
}

async function openDefinition(item: ApiDefinitionItem) {
  const existed = tabs.value.find(tab => tab.definitionId === item.id)
  if (existed) {
    activeEditorKey.value = existed.key
    selectedDirectoryKey.value = `request:${item.id}`
    return
  }

  const draft = createDraftDetail()
  draft.id = item.id
  draft.name = item.name
  draft.method = item.method
  draft.path = item.path
  draft.directoryName = item.directoryName
  draft.workspaceCode = item.workspaceCode
  draft.workspaceName = item.workspaceName
  draft.description = item.description || ''
  draft.tags = item.tags || []
  draft.requestConfig.method = item.method
  draft.requestConfig.path = item.path

  const tab: EditorTab = {
    key: `definition:${item.id}`,
    definitionId: item.id,
    title: item.name,
    method: item.method,
    dirty: false,
    activeTab: 'body',
    responseTab: 'body',
    detail: draft,
    runResult: null,
    runError: '',
    loading: true,
  }

  tabs.value.push(tab)
  activeEditorKey.value = tab.key
  selectedDirectoryKey.value = `request:${item.id}`

  try {
    const detail = await apiAutomationApi.getDefinitionDetail(props.workspaceCode, item.id)
    tab.detail = clone(detail)
    tab.title = editorTitle(detail)
    tab.method = detail.requestConfig.method || detail.method
    tab.loading = false
    void loadCasesForDefinition(item.id)
  } catch (error) {
    tab.loading = false
    tab.runError = getRequestErrorMessage(error)
  }
}

async function closeEditorTab(key: string, force = false) {
  const index = tabs.value.findIndex(item => item.key === key)
  if (index < 0) return
  if (!force && tabs.value[index].dirty) {
    await ElMessageBox.confirm('当前请求有未保存修改，关闭后会丢失，确认关闭吗？', '关闭标签', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
  }
  tabs.value.splice(index, 1)
  if (activeEditorKey.value === key) {
    activeEditorKey.value = tabs.value[Math.max(index - 1, 0)]?.key || ''
  }
}

async function closeOtherTabs() {
  if (!activeEditor.value) return
  const removingDirtyTabs = tabs.value.some(item => item.key !== activeEditor.value?.key && item.dirty)
  if (removingDirtyTabs) {
    await ElMessageBox.confirm('其他标签中有未保存修改，关闭后会丢失，确认关闭吗？', '关闭其他标签', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
  }
  tabs.value = [activeEditor.value]
}

async function closeDraftTabs() {
  const draftTabs = tabs.value.filter(item => !item.definitionId)
  if (!draftTabs.length) {
    ElMessage.info('当前没有草稿标签')
    return
  }
  if (draftTabs.some(item => item.dirty)) {
    await ElMessageBox.confirm('草稿标签中有未保存修改，关闭后会丢失，确认关闭吗？', '关闭全部草稿', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
  }
  const activeWillClose = activeEditor.value ? draftTabs.some(item => item.key === activeEditor.value?.key) : false
  tabs.value = tabs.value.filter(item => item.definitionId)
  if (activeWillClose) {
    activeEditorKey.value = tabs.value[0]?.key || ''
  }
}

async function handleEditorTabMenu(command: string | number | object) {
  try {
    const action = String(command)
    if (action === 'closeCurrent' && activeEditor.value) {
      await closeEditorTab(activeEditor.value.key)
    } else if (action === 'closeOthers') {
      await closeOtherTabs()
    } else if (action === 'closeDrafts') {
      await closeDraftTabs()
    }
  } catch {
    // User cancelled a tab-management confirmation.
  }
}

function handleDirectorySelect(node: DirectoryNode) {
  if (node.type === 'request' && node.definition) {
    void openDefinition(node.definition)
  } else {
    selectedDirectoryKey.value = node.key
  }
}

function setBodyMode(mode: BodyType) {
  if (!activeDetail.value) return
  activeDetail.value.requestConfig.body.type = mode
  if (mode === 'RAW_JSON') activeDetail.value.requestConfig.body.contentType = 'application/json'
  if (mode === 'RAW_XML') activeDetail.value.requestConfig.body.contentType = 'application/xml'
  if (mode === 'RAW_TEXT') activeDetail.value.requestConfig.body.contentType = 'text/plain'
  markDirty()
}

function addRow(rows: ApiKeyValueInput[]) {
  rows.push(emptyKeyValue())
  markDirty()
}

function removeRow(rows: ApiKeyValueInput[], index: number) {
  rows.splice(index, 1)
  if (!rows.length) rows.push(emptyKeyValue())
  markDirty()
}

function openBatchAdd(target: BatchAddTarget) {
  batchAddTarget.value = target
  batchAddText.value = ''
  batchAddVisible.value = true
}

function parseBatchRows(text: string) {
  const seen = new Set<string>()

  return text
    .split(/\r?\n/)
    .map((rawLine) => {
      const line = rawLine.trim()
      if (!line || /^[=:]/.test(line) || rawLine.startsWith('\t')) {
        return null
      }

      const separatorIndex = rawLine.includes('\t')
        ? rawLine.indexOf('\t')
        : rawLine.includes(':')
          ? rawLine.indexOf(':')
          : rawLine.indexOf('=')
      const parts = separatorIndex >= 0
        ? [rawLine.slice(0, separatorIndex), rawLine.slice(separatorIndex + 1)]
        : [rawLine, '']
      const row = {
        key: (parts[0] || '').trim(),
        value: (parts[1] || '').trim(),
        description: '',
      }
      const signature = `${row.key}\u0000${row.value}`
      if (!row.key || seen.has(signature)) {
        return null
      }
      seen.add(signature)
      return row
    })
    .filter((row): row is { key: string; value: string; description: string } => Boolean(row))
}

function applyBatchAdd() {
  if (!activeEditor.value) return
  const rows = parseBatchRows(batchAddText.value)
  if (!rows.length) {
    ElMessage.warning('请输入要批量添加的内容')
    return
  }

  if (batchAddTarget.value === 'assertion') {
    const assertions = assertionRowsFor(activeEditor.value.detail)
    assertions.push(...rows.map(row => createAssertion(row.key, row.value)))
  } else if (batchAddTarget.value === 'extractor') {
    const extractors = extractorRowsFor(activeEditor.value.detail)
    extractors.push(...rows.map(row => createExtractor(row.key, row.value, row.key)))
  } else {
    const targetRows = batchAddTarget.value === 'query'
      ? activeEditor.value.detail.requestConfig.queryParams
      : batchAddTarget.value === 'header'
        ? activeEditor.value.detail.requestConfig.headers
        : batchAddTarget.value === 'cookie'
          ? activeEditor.value.detail.requestConfig.cookies
          : activeEditor.value.detail.requestConfig.body.formItems

    targetRows.push(...rows.map(row => emptyKeyValue(row)))
  }

  batchAddVisible.value = false
  markDirty()
}

async function createModule(parentId: number | null = null) {
  const { value } = await ElMessageBox.prompt('请输入模块名称', '新建模块', {
    inputPattern: /\S+/,
    inputErrorMessage: '模块名称不能为空',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })
  await apiAutomationApi.createDefinitionModule(props.workspaceCode, {
    workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
    parentId,
    name: value.trim(),
  })
  await loadWorkspaceData()
  ElMessage.success('模块已创建')
}

async function renameModule(node: DirectoryNode) {
  if (!node.moduleId) return
  const { value } = await ElMessageBox.prompt('请输入新的模块名称', '重命名模块', {
    inputValue: node.label.split('/').pop() || node.label,
    inputPattern: /\S+/,
    inputErrorMessage: '模块名称不能为空',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })
  await apiAutomationApi.updateDefinitionModule(props.workspaceCode, node.moduleId, {
    workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
    name: value.trim(),
  })
  await loadWorkspaceData()
  ElMessage.success('模块已重命名')
}

async function deleteModule(node: DirectoryNode) {
  if (!node.moduleId) return
  if (node.count > 0 || node.children.some(child => child.type === 'module')) {
    ElMessage.warning('请先移除模块下的请求或子模块')
    return
  }
  await ElMessageBox.confirm('删除后不可恢复，确认删除该模块吗？', '删除模块', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })
  await apiAutomationApi.deleteDefinitionModule(props.workspaceCode, node.moduleId)
  await loadWorkspaceData()
  ElMessage.success('模块已删除')
}

async function renameRequest(node: DirectoryNode) {
  if (!node.definitionId || !node.definition) return
  const { value } = await ElMessageBox.prompt('请输入新的请求名称', '重命名请求', {
    inputValue: node.definition.name,
    inputPattern: /\S+/,
    inputErrorMessage: '请求名称不能为空',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })
  const detail = await apiAutomationApi.getDefinitionDetail(props.workspaceCode, node.definitionId)
  const saved = await apiAutomationApi.updateDefinition(props.workspaceCode, node.definitionId, {
    ...buildPayload({ ...detail, name: value.trim() }),
    name: value.trim(),
  })
  const opened = tabs.value.find(tab => tab.definitionId === node.definitionId)
  if (opened) {
    opened.detail = clone(saved)
    opened.title = editorTitle(saved)
    opened.method = saved.requestConfig.method || saved.method
    opened.dirty = false
  }
  await loadWorkspaceData()
  ElMessage.success('请求已重命名')
}

async function deleteRequest(node: DirectoryNode) {
  if (!node.definitionId) return
  await ElMessageBox.confirm('删除后不可恢复，确认删除该请求吗？', '删除请求', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })
  await apiAutomationApi.deleteDefinition(props.workspaceCode, node.definitionId)
  const opened = tabs.value.find(tab => tab.definitionId === node.definitionId)
  if (opened) {
    closeEditorTab(opened.key, true)
  }
  await loadWorkspaceData()
  ElMessage.success('请求已删除')
}

async function saveActiveEditor() {
  if (!activeEditor.value) return
  const editor = activeEditor.value
  const detail = editor.detail
  if (!detail.requestConfig.path.trim()) {
    ElMessage.warning('请输入请求 URL 或接口路径')
    return
  }

  saving.value = true
  try {
    const payload = buildPayload(detail)
    const saved = editor.definitionId
      ? await apiAutomationApi.updateDefinition(props.workspaceCode, editor.definitionId, payload)
      : await apiAutomationApi.createDefinition(props.workspaceCode, payload)

    editor.definitionId = saved.id
    editor.key = `definition:${saved.id}`
    editor.detail = clone(saved)
    editor.title = editorTitle(saved)
    editor.method = saved.requestConfig.method || saved.method
    editor.dirty = false
    activeEditorKey.value = editor.key
    selectedDirectoryKey.value = `request:${saved.id}`
    await loadWorkspaceData()
    ElMessage.success('接口已保存')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function sendActiveEditor() {
  if (!activeEditor.value) return
  const editor = activeEditor.value
  const detail = editor.detail
  if (!detail.requestConfig.path.trim()) {
    ElMessage.warning('请输入请求 URL 或接口路径')
    return
  }

  sending.value = true
  editor.runError = ''
  editor.runResult = null
  try {
    editor.runResult = editor.definitionId && !editor.dirty
      ? await apiAutomationApi.debugRunDefinition(props.workspaceCode, editor.definitionId, currentRunPayload())
      : await apiAutomationApi.debugRunDefinitionDraft(props.workspaceCode, {
        ...buildPayload(detail),
        ...currentRunPayload(),
      })
    editor.responseTab = 'body'
    ElMessage.success('请求已发送')
  } catch (error) {
    editor.runError = getRequestErrorMessage(error)
    editor.responseTab = 'console'
    ElMessage.error(editor.runError)
  } finally {
    sending.value = false
  }
}

async function deleteActiveEditor() {
  if (!activeEditor.value) return
  const editor = activeEditor.value
  if (!editor.definitionId) {
    closeEditorTab(editor.key)
    return
  }

  await ElMessageBox.confirm('删除后不可恢复，确认删除当前接口吗？', '删除接口', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })
  try {
    await apiAutomationApi.deleteDefinition(props.workspaceCode, editor.definitionId)
    void closeEditorTab(editor.key, true)
    await loadWorkspaceData()
    ElMessage.success('接口已删除')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function duplicateActiveEditor() {
  if (!activeEditor.value) return
  const detail = clone(activeEditor.value.detail)
  detail.id = 0
  detail.name = `${detail.name || '接口'} - 副本`
  detail.createdAt = null
  detail.updatedAt = null
  openNewRequestTab(detail)
}

async function saveAsCase() {
  if (!activeEditor.value) return
  if (!activeEditor.value.definitionId) {
    try {
      await ElMessageBox.confirm('当前请求还未保存为接口，请先保存接口，再保存为用例。是否现在保存接口？', '保存为用例', {
        type: 'warning',
        confirmButtonText: '先保存接口',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
    await saveActiveEditor()
    if (!activeEditor.value?.definitionId) return
  }
  openCreateCaseDialog()
}

async function promptImportCurl() {
  if (!activeEditor.value) {
    openNewRequestTab()
  }
  const { value } = await ElMessageBox.prompt('粘贴 curl 命令，支持 method、URL、Headers、Body 的最小解析', 'Curl 导入', {
    inputType: 'textarea',
    inputPlaceholder: `curl -X POST "https://example.com/api" -H "Content-Type: application/json" -d '{"name":"demo"}'`,
    confirmButtonText: '导入',
    cancelButtonText: '取消',
  })
  try {
    applyCurlToActiveEditor(value)
    ElMessage.success('Curl 已填充到当前请求')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Curl 解析失败')
  }
}

function openImportDialog() {
  importDialogVisible.value = true
}

function openCurlFromImportDialog() {
  importDialogVisible.value = false
  void promptImportCurl()
}

function tokenizeCurl(input: string) {
  return input
    .replace(/\\\r?\n/g, ' ')
    .match(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|\S+/g)
    ?.map(token => token.replace(/^['"]|['"]$/g, '')) ?? []
}

function applyCurlToActiveEditor(input: string) {
  if (!activeEditor.value) return
  const tokens = tokenizeCurl(input.trim())
  if (!tokens.length || tokens[0].toLowerCase() !== 'curl') {
    throw new Error('请输入以 curl 开头的命令')
  }

  const detail = activeEditor.value.detail
  let method = ''
  let url = ''
  let body = ''
  const headers: ApiKeyValueInput[] = []

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    const next = tokens[index + 1] || ''
    if (token === '-X' || token === '--request') {
      method = next.toUpperCase()
      index += 1
    } else if (token === '-H' || token === '--header') {
      const [key, ...rest] = next.split(':')
      if (key?.trim()) {
        headers.push(emptyKeyValue({ key: key.trim(), value: rest.join(':').trim() }))
      }
      index += 1
    } else if (['-d', '--data', '--data-raw', '--data-binary'].includes(token)) {
      body = next
      index += 1
    } else if (!token.startsWith('-') && !url) {
      url = token
    }
  }

  if (!url) {
    throw new Error('Curl 中没有识别到 URL')
  }

  detail.requestConfig.path = url
  detail.requestConfig.method = method || (body ? 'POST' : 'GET')
  detail.method = detail.requestConfig.method
  if (headers.length) {
    detail.requestConfig.headers = headers
  }
  if (body) {
    detail.requestConfig.body.type = body.trim().startsWith('<') ? 'RAW_XML' : 'RAW_JSON'
    detail.requestConfig.body.rawText = body
    detail.requestConfig.body.contentType = body.trim().startsWith('<') ? 'application/xml' : 'application/json'
  }
  markDirty()
}

function currentDefinitionSummary(): ApiDefinitionItem | null {
  if (!activeEditor.value?.definitionId) return null
  const detail = activeEditor.value.detail
  return {
    id: activeEditor.value.definitionId,
    workspaceCode: detail.workspaceCode,
    workspaceName: detail.workspaceName,
    name: detail.name,
    method: detail.requestConfig.method || detail.method,
    path: detail.requestConfig.path || detail.path,
    directoryName: detail.directoryName,
    description: detail.description,
    tags: detail.tags || [],
    lastRunResult: detail.lastRunResult,
    lastRunAt: detail.lastRunAt,
    updatedAt: detail.updatedAt,
  }
}

function currentCaseDraftDetail(): ApiDefinitionCaseDetail | null {
  if (!activeEditor.value?.definitionId) return null
  const detail = activeEditor.value.detail
  return {
    id: 0,
    workspaceCode: detail.workspaceCode || props.workspaceCode,
    workspaceName: detail.workspaceName,
    definitionId: activeEditor.value.definitionId,
    definitionName: detail.name || editorTitle(detail),
    name: `${detail.name || editorTitle(detail)} 用例`,
    method: detail.requestConfig.method || detail.method || 'GET',
    path: detail.requestConfig.path || detail.path || '',
    description: detail.description || null,
    tags: detail.tags || [],
    lastRunResult: detail.lastRunResult,
    lastRunAt: detail.lastRunAt,
    updatedAt: detail.updatedAt,
    createdAt: null,
    requestConfig: clone(detail.requestConfig),
    assertions: clone(detail.assertions || []),
    extractors: clone(detail.extractors || []),
    preProcessors: clone(detail.preProcessors || []),
    postProcessors: clone(detail.postProcessors || []),
  }
}

function aiCaseLog(message: string) {
  aiCaseGenerationLogs.value.push(`${new Date().toLocaleTimeString('zh-CN', { hour12: false })} ${message}`)
}

async function loadAiCaseProviders() {
  aiCaseProvidersLoading.value = true
  aiCaseProviderErrorMessage.value = ''
  try {
    aiCaseProviders.value = await aiProviderApi.getProviderConnections(props.workspaceCode)
    if (!aiCaseSelectedProvider.value && aiCaseAvailableProviders.value.length) {
      aiCaseSelectedProviderId.value = aiCaseAvailableProviders.value[0].id
    }
  } catch (error) {
    aiCaseProviderErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    aiCaseProvidersLoading.value = false
  }
}

function openAiCaseDrawer() {
  if (!activeEditor.value?.definitionId) {
    ElMessage.warning('请先保存接口，再使用 AI 生成接口用例')
    return
  }
  aiCaseDrawerVisible.value = true
  aiCaseProviderErrorMessage.value = ''
  aiCaseGenerationMessage.value = ''
  if (!aiCaseProviders.value.length) {
    void loadAiCaseProviders()
  }
}

function selectedAiCaseOptions() {
  const selected = aiCaseGenerationOptions.filter(item => aiCaseSelectedOptionKeys.value.includes(item.key))
  return selected.length ? selected : aiCaseGenerationOptions.slice(0, 1)
}

function generatedResultId(event: ApiAiCaseGenerationEvent, index: number) {
  return event.itemId || event.item?.typeKey || event.outline?.typeKey || `ai-case-${Date.now()}-${index}`
}

function mergeAiGeneratedResult(event: ApiAiCaseGenerationEvent) {
  const draft = event.item || {
    name: event.outline?.name || `AI 生成用例 ${aiCaseGeneratedResults.value.length + 1}`,
    description: event.outline?.description || event.message || '',
    tags: event.outline?.tags || [],
    group: event.outline?.group || event.group || null,
    groupKey: event.outline?.groupKey || null,
    type: event.outline?.type || event.type || null,
    typeKey: event.outline?.typeKey || null,
    expected: event.outline?.expected || null,
    requestConfig: clone(activeEditor.value?.detail.requestConfig || emptyRequestConfig()),
    assertions: [],
    preProcessors: [],
    postProcessors: [],
  }
  const id = generatedResultId(event, aiCaseGeneratedResults.value.length)
  const existed = aiCaseGeneratedResults.value.find(item => item.id === id)
  const next: ApiAiGeneratedCaseResult = {
    id,
    status: event.event === 'item_failed' ? 'failed' : existed?.status || 'pending',
    draft,
    message: event.message || null,
  }
  if (existed) {
    Object.assign(existed, next)
  } else {
    aiCaseGeneratedResults.value.push(next)
  }
}

function handleAiCaseGenerationEvent(event: ApiAiCaseGenerationEvent) {
  if (event.event === 'started') {
    aiCaseLog(`开始生成，预计 ${event.total || selectedAiCaseOptions().length} 条`)
  } else if (event.event === 'item_outline') {
    aiCaseLog(`生成大纲：${event.outline?.name || event.type || event.itemId || '-'}`)
    mergeAiGeneratedResult(event)
  } else if (event.event === 'item_completed') {
    aiCaseLog(`生成完成：${event.item?.name || event.type || event.itemId || '-'}`)
    mergeAiGeneratedResult(event)
  } else if (event.event === 'item_failed') {
    aiCaseLog(`单条失败：${event.message || event.type || event.itemId || '-'}`)
    mergeAiGeneratedResult(event)
  } else if (event.event === 'completed') {
    aiCaseGenerationStatus.value = 'done'
    aiCaseGenerationMessage.value = event.message || 'AI 生成接口用例完成'
    aiCaseLog(aiCaseGenerationMessage.value)
  } else if (event.event === 'failed') {
    aiCaseGenerationStatus.value = 'failed'
    aiCaseGenerationMessage.value = event.message || 'AI 生成接口用例失败'
    aiCaseLog(aiCaseGenerationMessage.value)
  } else {
    aiCaseLog(event.message || event.event)
  }
}

async function submitAiCaseGeneration() {
  if (!activeEditor.value?.definitionId) {
    ElMessage.warning('请先保存接口，再使用 AI 生成接口用例')
    return
  }
  if (!aiCaseSelectedProvider.value) {
    ElMessage.warning('暂无可用 AI 模型，请先到 AI 连接池配置')
    return
  }
  if (!aiCaseSelectedOptionKeys.value.length) {
    ElMessage.warning('请至少选择一种生成场景')
    return
  }

  const editor = activeEditor.value
  const definitionId = editor.definitionId
  if (!definitionId) return
  const detail = editor.detail
  aiCaseGenerationStatus.value = 'running'
  aiCaseGenerationMessage.value = ''
  aiCaseGenerationLogs.value = []
  aiCaseGeneratedResults.value = []

  try {
    await apiAutomationApi.streamAiCaseGeneration(props.workspaceCode, {
      workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
      definitionId,
      definitionName: detail.name,
      name: detail.name,
      method: detail.requestConfig.method || detail.method,
      path: detail.requestConfig.path || detail.path,
      description: detail.description,
      providerConnectionId: aiCaseSelectedProvider.value.id,
      modelName: aiCaseSelectedProvider.value.modelName || '',
      caseCount: aiCaseCount.value,
      noDuplicate: aiCaseNoDuplicate.value,
      prompt: aiCasePrompt.value || null,
      options: selectedAiCaseOptions(),
      requestConfig: clone(detail.requestConfig),
      assertions: clone(detail.assertions || []),
      preProcessors: clone(detail.preProcessors || []),
      postProcessors: clone(detail.postProcessors || []),
      existingCases: activeDefinitionCases.value.map(item => ({
        id: item.id,
        name: item.name,
        tags: item.tags || [],
      })),
    }, handleAiCaseGenerationEvent)

    if (aiCaseGenerationStatus.value === 'running') {
      aiCaseGenerationStatus.value = 'done'
      aiCaseGenerationMessage.value = 'AI 生成接口用例完成'
    }
  } catch (error) {
    aiCaseGenerationStatus.value = 'failed'
    aiCaseGenerationMessage.value = getRequestErrorMessage(error)
    aiCaseLog(aiCaseGenerationMessage.value)
  }
}

async function saveAiGeneratedCase(result: ApiAiGeneratedCaseResult) {
  if (!activeEditor.value?.definitionId) return
  aiCaseSavingId.value = result.id
  try {
    const draft = result.draft
    await apiAutomationApi.createCase(props.workspaceCode, {
      workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
      definitionId: activeEditor.value.definitionId,
      name: draft.name?.trim() || 'AI 生成接口用例',
      description: draft.description || draft.expected || null,
      tags: Array.isArray(draft.tags) ? draft.tags : [],
      requestConfig: clone(draft.requestConfig || activeEditor.value.detail.requestConfig),
      assertions: clone(draft.assertions || activeEditor.value.detail.assertions || []),
      preProcessors: clone(draft.preProcessors || activeEditor.value.detail.preProcessors || []),
      postProcessors: clone(draft.postProcessors || activeEditor.value.detail.postProcessors || []),
    })
    result.status = 'accepted'
    aiCaseSelectedResultIds.value = aiCaseSelectedResultIds.value.filter(id => id !== result.id)
    await loadCasesForDefinition(activeEditor.value.definitionId)
    ElMessage.success('AI 生成用例已保存')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    aiCaseSavingId.value = ''
  }
}

function discardAiGeneratedCase(result: ApiAiGeneratedCaseResult) {
  result.status = 'discarded'
  aiCaseSelectedResultIds.value = aiCaseSelectedResultIds.value.filter(id => id !== result.id)
}

function restoreAiGeneratedCase(result: ApiAiGeneratedCaseResult) {
  if (result.status === 'discarded') {
    result.status = 'pending'
  }
}

function openAiGeneratedCaseDetail(result: ApiAiGeneratedCaseResult) {
  aiCaseDetailResult.value = result
  aiCaseDetailVisible.value = true
}

function aiGeneratedDraftExtra(result: ApiAiGeneratedCaseResult | null, key: string) {
  if (!result) return null
  return (result.draft as unknown as Record<string, unknown>)[key] ?? null
}

async function batchAcceptAiGeneratedCases() {
  let pending = selectedPendingAiCaseResults.value
  if (!pending.length && aiCasePendingResults.value.length) {
    try {
      await ElMessageBox.confirm('当前未勾选生成结果，是否采纳全部待处理结果？', '批量采纳', {
        type: 'warning',
        confirmButtonText: '采纳全部',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
    pending = aiCasePendingResults.value
  }
  if (!pending.length) {
    ElMessage.info('暂无待采纳的生成结果')
    return
  }
  for (const item of pending) {
    if (item.status === 'pending') {
      await saveAiGeneratedCase(item)
    }
  }
}

async function batchDiscardAiGeneratedCases() {
  let pending = selectedPendingAiCaseResults.value
  if (!pending.length && aiCasePendingResults.value.length) {
    try {
      await ElMessageBox.confirm('当前未勾选生成结果，是否弃用全部待处理结果？', '批量弃用', {
        type: 'warning',
        confirmButtonText: '弃用全部',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
    pending = aiCasePendingResults.value
  }
  if (!pending.length) {
    ElMessage.info('暂无待弃用的生成结果')
    return
  }
  pending.forEach(item => {
    item.status = 'discarded'
  })
  aiCaseSelectedResultIds.value = aiCaseSelectedResultIds.value.filter(id => !pending.some(item => item.id === id))
}

function openCreateCaseDialog() {
  if (!activeEditor.value?.definitionId) {
    ElMessage.warning('请先保存接口，再新建用例')
    return
  }
  caseDialogMode.value = 'create'
  editingCaseItem.value = null
  editingCaseDetail.value = null
  caseDetailErrorMessage.value = ''
  caseDialogVisible.value = true
}

async function openEditCaseDialog(item: ApiDefinitionCaseItem) {
  caseDialogMode.value = 'edit'
  editingCaseItem.value = item
  editingCaseDetail.value = null
  caseDetailErrorMessage.value = ''
  caseDialogVisible.value = true
  caseDetailLoading.value = true
  try {
    editingCaseDetail.value = await apiAutomationApi.getCaseDetail(props.workspaceCode, item.id)
  } catch (error) {
    caseDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseDetailLoading.value = false
  }
}

async function openCaseDetailDrawer(item: ApiDefinitionCaseItem) {
  viewingCaseItem.value = item
  viewingCaseDetail.value = null
  viewingCaseDetailErrorMessage.value = ''
  caseRunHistories.value = []
  caseRunHistoryErrorMessage.value = ''
  selectedCaseRunHistoryId.value = null
  selectedCaseRunHistoryDetail.value = null
  caseRunHistoryDetailErrorMessage.value = ''
  caseDetailDrawerTab.value = 'detail'
  caseDetailDrawerVisible.value = true
  await Promise.all([loadViewingCaseDetail(item.id), loadCaseRunHistories(item.id)])
}

async function loadViewingCaseDetail(caseId: number) {
  viewingCaseDetailLoading.value = true
  viewingCaseDetailErrorMessage.value = ''
  try {
    viewingCaseDetail.value = await apiAutomationApi.getCaseDetail(props.workspaceCode, caseId)
  } catch (error) {
    viewingCaseDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    viewingCaseDetailLoading.value = false
  }
}

async function loadCaseRunHistories(caseId: number) {
  caseRunHistoryLoading.value = true
  caseRunHistoryErrorMessage.value = ''
  try {
    const page = await apiAutomationApi.getCaseRunHistory(props.workspaceCode, caseId)
    caseRunHistories.value = page.items
    if (page.items.length) {
      await openCaseRunHistoryDetail(page.items[0])
    }
  } catch (error) {
    caseRunHistoryErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseRunHistoryLoading.value = false
  }
}

async function openCaseRunHistoryDetail(item: ApiRunHistoryItem) {
  selectedCaseRunHistoryId.value = item.id
  selectedCaseRunHistoryDetail.value = null
  caseRunHistoryDetailErrorMessage.value = ''
  caseRunHistoryDetailLoading.value = true
  try {
    selectedCaseRunHistoryDetail.value = await apiAutomationApi.getCaseRunHistoryDetail(props.workspaceCode, item.id)
  } catch (error) {
    caseRunHistoryDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseRunHistoryDetailLoading.value = false
  }
}

async function submitCaseDialog(payload: SaveApiDefinitionCasePayload) {
  if (!activeEditor.value?.definitionId) return
  caseDialogSaving.value = true
  try {
    if (caseDialogMode.value === 'edit' && editingCaseItem.value) {
      await apiAutomationApi.updateCase(props.workspaceCode, editingCaseItem.value.id, payload)
      ElMessage.success('用例已保存')
    } else {
      await apiAutomationApi.createCase(props.workspaceCode, payload)
      ElMessage.success('用例已创建')
    }
    caseDialogVisible.value = false
    await loadCasesForDefinition(activeEditor.value.definitionId)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    caseDialogSaving.value = false
  }
}

async function duplicateCase(item: ApiDefinitionCaseItem) {
  const detail = await apiAutomationApi.getCaseDetail(props.workspaceCode, item.id)
  await apiAutomationApi.createCase(props.workspaceCode, {
    workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
    definitionId: detail.definitionId,
    name: `${detail.name} - 副本`,
    description: detail.description,
    tags: detail.tags || [],
    requestConfig: clone(detail.requestConfig),
    assertions: clone(detail.assertions || []),
    preProcessors: clone(detail.preProcessors || []),
    postProcessors: clone(detail.postProcessors || []),
  })
  await loadCasesForDefinition(item.definitionId)
  ElMessage.success('用例已复制')
}

async function deleteCase(item: ApiDefinitionCaseItem) {
  await ElMessageBox.confirm('删除后不可恢复，确认删除该用例吗？', '删除用例', {
    type: 'warning',
    confirmButtonText: '确认',
    cancelButtonText: '取消',
  })
  await apiAutomationApi.deleteCase(props.workspaceCode, item.id)
  await loadCasesForDefinition(item.definitionId)
  ElMessage.success('用例已删除')
}

async function runCase(item: ApiDefinitionCaseItem) {
  caseRunningId.value = item.id
  try {
    await apiAutomationApi.runCase(props.workspaceCode, item.id, currentRunPayload())
    await loadCasesForDefinition(item.definitionId)
    if (caseDetailDrawerVisible.value && viewingCaseItem.value?.id === item.id) {
      await loadCaseRunHistories(item.id)
    }
    ElMessage.success('用例执行完成')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    caseRunningId.value = null
  }
}

watch(
  () => [props.workspaceCode, props.workspaceReady],
  () => {
    tabs.value = []
    activeEditorKey.value = ''
    selectedDirectoryKey.value = 'definition-root'
    cases.value = []
    void loadWorkspaceData()
  },
)

onMounted(() => {
  restoreResponsePanelHeight()
  void loadWorkspaceData()
})

onBeforeUnmount(() => {
  stopResponseResize()
})
</script>

<template>
  <section v-loading="loading" class="api-interface-workspace">
    <div class="api-interface-tabs">
      <button class="api-interface-tab is-active" type="button">接口</button>
      <button class="api-interface-tab" type="button" disabled>场景</button>
      <button class="api-interface-tab" type="button" disabled>执行</button>
      <button class="api-interface-tab" type="button" disabled>报告</button>
      <button class="api-interface-tab" type="button" disabled>设置</button>
    </div>

    <div v-if="activeTopTab === 'definitions'" class="api-interface-shell">
      <aside class="api-interface-sidebar">
        <div class="api-interface-sidebar__actions">
          <button type="button" class="api-sidebar-primary" @click="openNewRequestTab()">
            <el-icon><Plus /></el-icon>
            新建请求
          </button>
          <button type="button" class="api-sidebar-secondary" @click="openImportDialog">
            <el-icon><Upload /></el-icon>
            导入
          </button>
        </div>

        <div class="api-sidebar-search">
          <el-icon><Search /></el-icon>
          <el-input v-model="directoryKeyword" clearable placeholder="搜索模块或请求" />
        </div>

        <div class="api-directory-title">
          <div>
            <span>请求目录</span>
            <b>{{ filteredDefinitions.length }}</b>
          </div>
          <button type="button" title="收起全部子模块" @click="expandedKeys = ['definition-root']">
            <el-icon><Fold /></el-icon>
          </button>
        </div>

        <div class="api-directory-body">
          <div v-if="moduleErrorMessage || definitionErrorMessage" class="api-directory-error">
            {{ moduleErrorMessage || definitionErrorMessage }}
          </div>
          <el-tree
            v-else
            :data="directoryTree"
            node-key="key"
            :default-expanded-keys="expandedKeys"
            :current-node-key="selectedDirectoryKey"
            :expand-on-click-node="false"
            highlight-current
            class="api-directory-tree"
            @node-click="handleDirectorySelect"
            @node-expand="(node: DirectoryNode) => expandedKeys = Array.from(new Set([...expandedKeys, node.key]))"
            @node-collapse="(node: DirectoryNode) => expandedKeys = expandedKeys.filter(key => key !== node.key)"
          >
            <template #default="{ data }">
              <div :class="['api-directory-node', { 'is-request': data.type === 'request' }]">
                <template v-if="data.type === 'request'">
                  <span :class="['api-method', requestMethodClass(data.method)]">{{ data.method }}</span>
                  <span class="api-directory-node__name">{{ data.label }}</span>
                </template>
                <template v-else>
                  <el-icon class="api-directory-node__icon">
                    <FolderOpened v-if="expandedKeys.includes(data.key)" />
                    <Folder v-else />
                  </el-icon>
                  <span class="api-directory-node__name">{{ data.label }}</span>
                  <span class="api-directory-node__count">{{ data.count }}</span>
                </template>
                <el-dropdown trigger="click" @click.stop>
                  <button type="button" class="api-directory-node__action" @click.stop>
                    <el-icon><MoreFilled /></el-icon>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <template v-if="data.type === 'root' || data.type === 'module'">
                        <el-dropdown-item @click="createModule(data.type === 'module' ? data.moduleId : null)">新建模块</el-dropdown-item>
                        <el-dropdown-item v-if="data.type === 'module'" @click="renameModule(data)">重命名模块</el-dropdown-item>
                        <el-dropdown-item v-if="data.type === 'module'" @click="deleteModule(data)">删除模块</el-dropdown-item>
                      </template>
                      <template v-else-if="data.type === 'request'">
                        <el-dropdown-item @click="renameRequest(data)">重命名请求</el-dropdown-item>
                        <el-dropdown-item divided @click="deleteRequest(data)">删除请求</el-dropdown-item>
                      </template>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-tree>
          <div v-if="!filteredDefinitions.length && !definitionLoading" class="api-directory-empty">
            {{ directoryKeyword.trim() ? '暂无匹配的模块或请求' : '暂无请求，请新建请求或使用 Curl 导入' }}
          </div>
        </div>
      </aside>

      <section class="api-interface-main">
        <div class="api-editor-tabs">
          <div class="api-editor-tabs__nav">
            <button
              v-for="item in tabs"
              :key="item.key"
              :class="['api-editor-tab', { 'is-active': item.key === activeEditorKey }]"
              type="button"
              :title="item.title"
              @click="activeEditorKey = item.key"
            >
              <span :class="['api-method', requestMethodClass(item.method)]">{{ item.method }}</span>
              <span class="api-editor-tab__label">{{ item.title }}</span>
              <span v-if="item.dirty" class="api-editor-tab__dot"></span>
              <span class="api-editor-tab__close" @click.stop="closeEditorTab(item.key)">
                <el-icon><Close /></el-icon>
              </span>
            </button>
            <button type="button" class="api-editor-tab-add" @click="openNewRequestTab()">
              <el-icon><Plus /></el-icon>
            </button>
            <el-dropdown v-if="tabs.length" trigger="click" @command="handleEditorTabMenu">
              <button type="button" class="api-editor-tab-more">
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="closeCurrent" :disabled="!activeEditor">关闭当前标签</el-dropdown-item>
                  <el-dropdown-item command="closeOthers">关闭其他标签</el-dropdown-item>
                  <el-dropdown-item command="closeDrafts">关闭全部草稿</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <div v-if="!activeEditor" class="api-editor-empty">
          <span>请选择左侧请求，或新建一个请求</span>
          <button type="button" @click="openNewRequestTab()">新建请求</button>
        </div>

        <template v-else>
          <div class="api-request-line">
            <div class="api-url-compose">
              <el-select
                v-model="activeEditor.detail.requestConfig.method"
                :class="['api-method-select', requestMethodClass(activeEditor.detail.requestConfig.method)]"
                @change="markDirty"
              >
                <el-option v-for="method in apiMethodOptions" :key="method" :label="method" :value="method">
                  <span :class="['api-method-option', requestMethodClass(method)]">{{ method }}</span>
                </el-option>
              </el-select>
              <el-input
                ref="urlInputRef"
                v-model="activeEditor.detail.requestConfig.path"
                placeholder="请输入包含 http/https 的完整 URL 或接口路径"
                @input="markDirty"
              />
              <button type="button" class="api-curl-button" @click="promptImportCurl">Curl</button>
            </div>
            <div class="api-run-options" v-loading="runOptionsLoading">
              <el-select
                v-model="selectedEnvironmentId"
                clearable
                placeholder="环境"
                :disabled="Boolean(runOptionsErrorMessage)"
                @change="persistRunOptions"
              >
                <el-option v-for="item in environments" :key="item.id" :label="item.name" :value="item.id">
                  <span>{{ item.name }}</span>
                  <small v-if="item.baseUrl">{{ item.baseUrl }}</small>
                </el-option>
              </el-select>
              <el-select
                v-model="selectedVariableSetId"
                clearable
                placeholder="变量集"
                :disabled="Boolean(runOptionsErrorMessage)"
                @change="persistRunOptions"
              >
                <el-option v-for="item in variableSets" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
              <span v-if="runOptionsErrorMessage" class="api-run-options__hint">运行选项加载失败</span>
              <span v-else-if="!environments.length && !variableSets.length" class="api-run-options__hint">暂无环境或变量集</span>
            </div>
            <button type="button" class="api-send-button" :disabled="sending" @click="sendActiveEditor">
              <el-icon><VideoPlay /></el-icon>
              发送
            </button>
            <el-dropdown split-button class="api-save-dropdown" :loading="saving" @click="saveActiveEditor">
              保存
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="saveAsCase">保存为用例</el-dropdown-item>
                  <el-dropdown-item @click="duplicateActiveEditor">
                    <el-icon><DocumentCopy /></el-icon>
                    复制接口
                  </el-dropdown-item>
                  <el-dropdown-item class="is-danger" @click="deleteActiveEditor">
                    <el-icon><Delete /></el-icon>
                    {{ activeEditor.definitionId ? '删除接口' : '关闭草稿' }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <div class="api-editor-scroll">
            <div class="api-content-tabs">
              <button
                v-for="tab in contentTabs"
                :key="tab.value"
                :class="['api-content-tab', { 'is-active': activeEditor.activeTab === tab.value }]"
                type="button"
                @click="activeEditor.activeTab = tab.value"
              >
                {{ tab.label }}
                <span v-if="tab.count" class="api-tab-badge">{{ tab.count }}</span>
              </button>
            </div>

            <div class="api-request-body">
              <template v-if="activeEditor.activeTab === 'params'">
                <div class="api-param-table is-query">
                  <div class="api-param-toolbar">
                    <span>Query 参数</span>
                    <button type="button" @click="openBatchAdd('query')">批量添加</button>
                  </div>
                  <div class="api-param-header">
                    <span></span><span>参数名</span><span>*</span><span>类型</span><span>参数值</span><span>长度</span><span>编码</span><span>描述</span><span></span>
                  </div>
                  <div v-for="(row, index) in activeEditor.detail.requestConfig.queryParams" :key="`query-${index}`" class="api-param-row">
                    <el-checkbox v-model="row.enabled" @change="markDirty" />
                    <el-input v-model="row.key" placeholder="参数名称" @input="markDirty" />
                    <el-checkbox v-model="row.required" @change="markDirty" />
                    <el-select v-model="row.paramType" placeholder="类型" @change="markDirty">
                      <el-option v-for="type in paramTypeOptions.filter(item => item !== 'file')" :key="type" :label="type" :value="type" />
                    </el-select>
                    <el-input v-model="row.value" placeholder="参数值 / {{variable}}" @input="markDirty" />
                    <div class="api-length-range">
                      <el-input-number v-model="row.minLength" :min="0" controls-position="right" placeholder="min" @change="markDirty" />
                      <el-input-number v-model="row.maxLength" :min="0" controls-position="right" placeholder="max" @change="markDirty" />
                    </div>
                    <el-switch v-model="row.encode" size="small" @change="markDirty" />
                    <el-input v-model="row.description" placeholder="描述" @input="markDirty" />
                    <button type="button" class="api-row-remove" @click="removeRow(activeEditor.detail.requestConfig.queryParams, index)">删除</button>
                  </div>
                  <button type="button" class="api-add-row" @click="addRow(activeEditor.detail.requestConfig.queryParams)">+ 添加一行</button>
                </div>
              </template>

              <template v-else-if="activeEditor.activeTab === 'headers'">
                <div class="api-param-table is-header">
                  <div class="api-param-toolbar">
                    <span>请求头</span>
                    <button type="button" @click="openBatchAdd('header')">批量添加</button>
                  </div>
                  <div class="api-param-header">
                    <span></span><span>参数名称</span><span>参数值</span><span>必填</span><span>描述</span><span></span>
                  </div>
                  <div v-for="(row, index) in activeEditor.detail.requestConfig.headers" :key="`header-${index}`" class="api-param-row">
                    <el-checkbox v-model="row.enabled" @change="markDirty" />
                    <el-input v-model="row.key" placeholder="参数名称" @input="markDirty" />
                    <el-input v-model="row.value" placeholder="参数值" @input="markDirty" />
                    <el-checkbox v-model="row.required" @change="markDirty" />
                    <el-input v-model="row.description" placeholder="描述" @input="markDirty" />
                    <button type="button" class="api-row-remove" @click="removeRow(activeEditor.detail.requestConfig.headers, index)">删除</button>
                  </div>
                  <button type="button" class="api-add-row" @click="addRow(activeEditor.detail.requestConfig.headers)">+ 添加一行</button>
                </div>
              </template>

              <template v-else-if="activeEditor.activeTab === 'cookies'">
                <div class="api-param-table is-cookie">
                  <div class="api-param-toolbar">
                    <span>Cookie</span>
                    <button type="button" @click="openBatchAdd('cookie')">批量添加</button>
                  </div>
                  <div class="api-param-header">
                    <span></span><span>Cookie 名称</span><span>Cookie 值</span><span>必填</span><span>描述</span><span></span>
                  </div>
                  <div v-for="(row, index) in activeEditor.detail.requestConfig.cookies" :key="`cookie-${index}`" class="api-param-row">
                    <el-checkbox v-model="row.enabled" @change="markDirty" />
                    <el-input v-model="row.key" placeholder="Cookie 名称" @input="markDirty" />
                    <el-input v-model="row.value" placeholder="Cookie 值 / {{variable}}" @input="markDirty" />
                    <el-checkbox v-model="row.required" @change="markDirty" />
                    <el-input v-model="row.description" placeholder="描述" @input="markDirty" />
                    <button type="button" class="api-row-remove" @click="removeRow(activeEditor.detail.requestConfig.cookies, index)">删除</button>
                  </div>
                  <button type="button" class="api-add-row" @click="addRow(activeEditor.detail.requestConfig.cookies)">+ 添加一行</button>
                </div>
              </template>

              <template v-else-if="activeEditor.activeTab === 'body'">
                <div class="api-body-section">
                  <div class="api-body-modes">
                    <button
                      v-for="mode in bodyModes"
                      :key="mode.value"
                      :class="['api-body-chip', { 'is-active': activeEditor.detail.requestConfig.body.type === mode.value }]"
                      type="button"
                      @click="setBodyMode(mode.value)"
                    >
                      {{ mode.label }}
                    </button>
                  </div>
                  <div :class="['api-body-editor', { 'is-empty': activeEditor.detail.requestConfig.body.type === 'NONE' }]">
                    <div v-if="activeEditor.detail.requestConfig.body.type === 'NONE'" class="api-empty-body">请求没有 Body</div>
                    <el-input
                      v-else-if="['RAW_JSON', 'RAW_XML', 'RAW_TEXT'].includes(activeEditor.detail.requestConfig.body.type)"
                      v-model="activeEditor.detail.requestConfig.body.rawText"
                      type="textarea"
                      resize="none"
                      placeholder="请输入请求体"
                      @input="markDirty"
                    />
                    <div v-else-if="['FORM_DATA', 'FORM_URLENCODED'].includes(activeEditor.detail.requestConfig.body.type)" class="api-param-table is-body-form">
                      <div class="api-param-toolbar">
                        <span>{{ activeEditor.detail.requestConfig.body.type === 'FORM_DATA' ? 'form-data' : 'x-www-form-urlencoded' }}</span>
                        <button type="button" @click="openBatchAdd('body-form')">批量添加</button>
                      </div>
                      <div class="api-param-header">
                        <span></span><span>参数名称</span><span>*</span><span>类型</span><span>参数值 / 文件名</span><span>长度</span><span>描述</span><span></span>
                      </div>
                      <div v-for="(row, index) in activeEditor.detail.requestConfig.body.formItems" :key="`body-${index}`" class="api-param-row">
                        <el-checkbox v-model="row.enabled" @change="markDirty" />
                        <el-input v-model="row.key" placeholder="参数名称" @input="markDirty" />
                        <el-checkbox v-model="row.required" @change="markDirty" />
                        <el-select v-model="row.paramType" placeholder="类型" @change="markDirty">
                          <el-option
                            v-for="type in (activeEditor.detail.requestConfig.body.type === 'FORM_DATA' ? paramTypeOptions : paramTypeOptions.filter(item => item !== 'file'))"
                            :key="type"
                            :label="type"
                            :value="type"
                          />
                        </el-select>
                        <div v-if="row.paramType === 'file'" class="api-file-picker">
                          <label class="api-file-picker__button">
                            选择文件
                            <input type="file" @change="handleFormFileChange(row, $event)" />
                          </label>
                          <span :title="row.fileName || ''">{{ row.fileName || '未选择文件' }}</span>
                          <small>{{ formatFileSize(row.fileSize) }}</small>
                          <button v-if="row.fileName" type="button" class="api-row-remove" @click="clearFormFile(row)">清除</button>
                        </div>
                        <el-input v-else v-model="row.value" placeholder="参数值" @input="markDirty" />
                        <div class="api-length-range">
                          <el-input-number v-model="row.minLength" :min="0" controls-position="right" placeholder="min" @change="markDirty" />
                          <el-input-number v-model="row.maxLength" :min="0" controls-position="right" placeholder="max" @change="markDirty" />
                        </div>
                        <el-input v-model="row.description" placeholder="描述" @input="markDirty" />
                        <button type="button" class="api-row-remove" @click="removeRow(activeEditor.detail.requestConfig.body.formItems, index)">删除</button>
                      </div>
                      <button type="button" class="api-add-row" @click="addRow(activeEditor.detail.requestConfig.body.formItems)">+ 添加一行</button>
                    </div>
                    <div v-else class="api-binary-panel">
                      <span>File</span>
                      <div class="api-binary-file">
                        <label class="api-file-picker__button">
                          选择文件
                          <input type="file" @change="handleBinaryFileChange" />
                        </label>
                        <div>
                          <strong>{{ activeEditor.detail.requestConfig.body.fileName || '未选择文件' }}</strong>
                          <span>{{ activeEditor.detail.requestConfig.body.contentType || 'application/octet-stream' }} · {{ formatFileSize(activeEditor.detail.requestConfig.body.fileSize) }}</span>
                        </div>
                        <button v-if="activeEditor.detail.requestConfig.body.fileName" type="button" class="api-row-remove" @click="clearBinaryFile">清除</button>
                      </div>
                      <span class="api-binary-hint">调试发送会带入 Base64 内容；若后端未持久化完整内容，刷新后仅保留接口返回的元信息。</span>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else-if="activeEditor.activeTab === 'auth'">
                <div class="api-auth-panel">
                  <span class="api-form-label">认证方式</span>
                  <el-radio-group v-model="activeEditor.detail.requestConfig.authConfig.authType" @change="markDirty">
                    <el-radio-button value="NONE">No Auth</el-radio-button>
                    <el-radio-button value="BASIC">Basic Auth</el-radio-button>
                    <el-radio-button value="DIGEST">Digest Auth</el-radio-button>
                  </el-radio-group>
                  <div v-if="activeEditor.detail.requestConfig.authConfig.authType === 'BASIC'" class="api-auth-grid">
                    <label>Username</label>
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.basicAuth!.userName" placeholder="username" @input="markDirty" />
                    <label>Password</label>
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.basicAuth!.password" show-password placeholder="password" @input="markDirty" />
                  </div>
                  <div v-else-if="activeEditor.detail.requestConfig.authConfig.authType === 'DIGEST'" class="api-auth-grid">
                    <label>Username</label>
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.digestAuth!.userName" placeholder="username" @input="markDirty" />
                    <label>Password</label>
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.digestAuth!.password" show-password placeholder="password" @input="markDirty" />
                  </div>
                </div>
              </template>

              <template v-else-if="activeEditor.activeTab === 'settings'">
                <div class="api-settings-panel">
                  <label>接口名称</label>
                  <el-input v-model="activeEditor.detail.name" placeholder="接口名称" @input="markDirty" />
                  <label>模块 / 目录</label>
                  <el-input v-model="activeEditor.detail.directoryName" placeholder="模块 / 目录" @input="markDirty" />
                  <label>标签</label>
                  <el-input :model-value="activeEditor.detail.tags.join(', ')" placeholder="标签，逗号分隔" @update:model-value="(value: string | number) => { activeEditor!.detail.tags = String(value).split(',').map(item => item.trim()).filter(Boolean); markDirty() }" />
                  <label>超时时间</label>
                  <el-input-number v-model="activeEditor.detail.requestConfig.timeoutMs" :min="1000" :step="1000" controls-position="right" @change="markDirty" />
                  <label>描述</label>
                  <el-input v-model="activeEditor.detail.description" type="textarea" :rows="4" placeholder="接口描述、调用约束或备注" @input="markDirty" />
                </div>
              </template>

              <template v-else-if="activeEditor.activeTab === 'cases'">
                <div class="api-cases-panel">
                  <div class="api-cases-toolbar">
                    <button type="button" class="api-sidebar-primary" :disabled="!activeEditor.definitionId" @click="openCreateCaseDialog">新建用例</button>
                    <span>当前接口下 {{ activeDefinitionCases.length }} 条用例</span>
                  </div>
                  <div class="api-cases-ai-entry">
                    <button type="button" class="api-sidebar-secondary" :disabled="!activeEditor.definitionId" @click="openAiCaseDrawer">AI 生成用例</button>
                    <span>基于当前接口定义生成接口用例，生成结果需采纳后才会保存。</span>
                  </div>
                  <el-table v-if="activeDefinitionCases.length" :data="activeDefinitionCases" size="small" height="300">
                    <el-table-column prop="name" label="用例名称" min-width="180" show-overflow-tooltip />
                    <el-table-column prop="path" label="路径" min-width="220" show-overflow-tooltip />
                    <el-table-column label="方法" width="80">
                      <template #default="{ row }">
                        <span :class="['api-method', requestMethodClass(row.method)]">{{ row.method }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="lastRunResult" label="最近结果" width="100" />
                    <el-table-column label="操作" width="280" fixed="right">
                      <template #default="{ row }">
                        <div class="api-case-actions">
                          <button type="button" @click="openCaseDetailDrawer(row)">查看详情</button>
                          <button type="button" @click="openEditCaseDialog(row)">编辑</button>
                          <button type="button" :disabled="caseRunningId === row.id" @click="runCase(row)">执行</button>
                          <button type="button" @click="duplicateCase(row)">复制</button>
                          <button type="button" class="is-danger" @click="deleteCase(row)">删除</button>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>
                  <div v-else class="api-empty-body">当前接口下还没有用例</div>
                </div>
              </template>

              <template v-else>
                <div v-if="activeEditor.activeTab === 'extractors'" class="api-extractor-panel">
                  <div class="api-advanced-toolbar">
                    <div>
                      <strong>提取器</strong>
                      <span>从响应中提取变量，供后续步骤或用例复用</span>
                    </div>
                    <div class="api-advanced-actions">
                      <button type="button" @click="openBatchAdd('extractor')">批量添加</button>
                      <button type="button" class="api-sidebar-primary" @click="addExtractor">添加提取器</button>
                    </div>
                  </div>
                  <div class="api-extractor-table">
                    <div class="api-extractor-header">
                      <span>启用</span><span>名称</span><span>来源</span><span>表达式类型</span><span>表达式</span><span>变量名</span><span>默认值</span><span>必填</span><span>失败中断</span><span>说明</span><span></span>
                    </div>
                    <div v-for="(extractor, index) in extractorRowsFor(activeEditor.detail)" :key="extractor.id || index" class="api-extractor-row">
                      <el-switch v-model="extractor.enabled" size="small" @change="markDirty" />
                      <el-input v-model="extractor.name" placeholder="提取器名称" @input="markDirty" />
                      <el-select v-model="extractor.source" @change="extractor.sourceType = extractor.source; markDirty()">
                        <el-option v-for="item in extractorSourceOptions" :key="item.value" :label="item.label" :value="item.value" />
                      </el-select>
                      <el-select v-model="extractor.extractType" @change="extractor.expressionType = extractor.extractType; markDirty()">
                        <el-option v-for="item in extractorExpressionTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                      </el-select>
                      <el-input v-model="extractor.expression" placeholder="$.data.id / token / 正则" @input="markDirty" />
                      <el-input v-model="extractor.variableName" placeholder="变量名" @input="markDirty" />
                      <el-input v-model="extractor.defaultValue" placeholder="默认值" @input="markDirty" />
                      <el-switch v-model="extractor.required" size="small" @change="markDirty" />
                      <el-switch v-model="extractor.failOnMissing" size="small" @change="markDirty" />
                      <el-input v-model="extractor.description" placeholder="说明" @input="markDirty" />
                      <button type="button" class="api-row-remove" @click="removeExtractor(index)">删除</button>
                    </div>
                    <div v-if="!extractorRowsFor(activeEditor.detail).length" class="api-empty-body">当前请求未配置提取器</div>
                  </div>
                </div>

                <div v-else-if="activeEditor.activeTab === 'tests'" class="api-assertion-panel">
                  <div class="api-advanced-toolbar">
                    <div>
                      <strong>断言</strong>
                      <span>发送时随请求一起执行</span>
                    </div>
                    <div class="api-advanced-actions">
                      <button type="button" @click="openBatchAdd('assertion')">批量添加</button>
                      <el-dropdown trigger="click" @command="addAssertionFromLatestResponseCommand">
                        <button type="button">从响应提取</button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="code">响应码断言</el-dropdown-item>
                            <el-dropdown-item command="header">响应头断言</el-dropdown-item>
                            <el-dropdown-item command="body">响应体 JSONPath 断言</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                      <el-dropdown trigger="click" @command="addAssertionFromCommand">
                        <button type="button" class="api-sidebar-primary">添加断言</button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item v-for="item in assertionTypeOptions" :key="item.value" :command="item.value">{{ item.label }}</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>
                  </div>
                  <div v-if="assertionRowsFor(activeEditor.detail).length" class="api-assertion-editor">
                    <aside class="api-assertion-list">
                      <button
                        v-for="(assertion, index) in assertionRowsFor(activeEditor.detail)"
                        :key="assertion.id || index"
                        type="button"
                        :class="['api-assertion-list-item', { 'is-active': activeAssertion?.id === assertion.id }]"
                        @click="selectAssertion(assertion)"
                      >
                        <span class="api-assertion-list-item__main">
                          <el-switch v-model="assertion.enabled" size="small" @click.stop @change="markDirty" />
                          <span>{{ assertion.name || `断言 ${index + 1}` }}</span>
                        </span>
                        <small>{{ index + 1 }} · {{ assertionTypeLabel(assertion.assertionType || assertion.type) }}</small>
                      </button>
                    </aside>
                    <section v-if="activeAssertion" class="api-assertion-detail">
                      <div class="api-assertion-detail__actions">
                        <button type="button" @click="copyAssertion(assertionRowsFor(activeEditor.detail).indexOf(activeAssertion))">复制</button>
                        <button type="button" @click="moveAssertion(assertionRowsFor(activeEditor.detail).indexOf(activeAssertion), -1)">上移</button>
                        <button type="button" @click="moveAssertion(assertionRowsFor(activeEditor.detail).indexOf(activeAssertion), 1)">下移</button>
                        <button type="button" @click="testAssertionExpression(activeAssertion)">测试表达式</button>
                        <button type="button" @click="fillAssertionFromResponse(activeAssertion)">从最近响应提取</button>
                        <button type="button" class="api-row-remove" @click="removeAssertion(assertionRowsFor(activeEditor.detail).indexOf(activeAssertion))">删除</button>
                      </div>
                      <div class="api-assertion-form-grid">
                        <label>名称</label>
                        <el-input v-model="activeAssertion.name" placeholder="断言名称" @input="markDirty" />
                        <label>启用</label>
                        <el-switch v-model="activeAssertion.enabled" size="small" @change="markDirty" />
                        <label>断言类型</label>
                        <el-select v-model="activeAssertion.assertionType" @change="normalizeAssertionForType(activeAssertion)">
                          <el-option v-for="item in assertionTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                        </el-select>
                        <label>说明</label>
                        <el-input v-model="activeAssertion.description" placeholder="说明" @input="markDirty" />
                      </div>

                      <div v-if="activeAssertion.assertionType === 'RESPONSE_CODE'" class="api-assertion-type-panel">
                        <div class="api-assertion-subtitle">响应码断言</div>
                        <div class="api-assertion-form-grid">
                          <label>条件</label>
                          <el-select v-model="activeAssertion.condition" @change="activeAssertion.operator = activeAssertion.condition; markDirty()">
                            <el-option v-for="item in assertionConditionOptions" :key="item.value" :label="item.label" :value="item.value" />
                          </el-select>
                          <label>期望状态码</label>
                          <el-input v-model="activeAssertion.expectedValue" placeholder="200" @input="markDirty" />
                        </div>
                      </div>

                      <div v-else-if="activeAssertion.assertionType === 'RESPONSE_HEADER'" class="api-assertion-type-panel">
                        <div class="api-assertion-subtitle">
                          <span>响应头断言</span>
                          <button type="button" @click="addAssertionItem(activeAssertion.assertions || (activeAssertion.assertions = []), { header: '' })">+ 添加响应头</button>
                        </div>
                        <div class="api-assertion-item-list">
                          <div v-for="(item, index) in activeAssertion.assertions" :key="`${activeAssertion.id}-header-${index}`" class="api-assertion-item-row is-header">
                            <el-switch v-model="item.enabled" size="small" @change="markDirty" />
                            <el-input v-model="item.header" placeholder="响应头名称" @input="activeAssertion.expression = item.header || ''; markDirty()" />
                            <el-select v-model="item.condition" @change="item.operator = item.condition; markDirty()">
                              <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
                            </el-select>
                            <el-input v-model="item.expectedValue" placeholder="期望值" @input="activeAssertion.expectedValue = item.expectedValue || ''; markDirty()" />
                            <button type="button" @click="testAssertionExpression(activeAssertion, item)">测试</button>
                            <button type="button" @click="copyAssertionItem(activeAssertion.assertions || [], index)">复制</button>
                            <button type="button" class="api-row-remove" @click="removeAssertionItem(activeAssertion.assertions || [], index, { header: '', condition: 'EQUALS', expectedValue: '' })">删除</button>
                          </div>
                        </div>
                      </div>

                      <div v-else-if="activeAssertion.assertionType === 'RESPONSE_BODY'" class="api-assertion-type-panel">
                        <div class="api-assertion-subtitle">
                          <span>响应体断言</span>
                          <button type="button" @click="addAssertionItem(activeAssertionBodyGroup(activeAssertion).assertions, { expression: defaultAssertionExpression(activeAssertion.assertionBodyType) })">+ 添加表达式</button>
                        </div>
                        <div class="api-assertion-mode-row">
                          <el-radio-group v-model="activeAssertion.assertionBodyType" @change="activeAssertion.expressionType = activeAssertion.assertionBodyType; markDirty()">
                            <el-radio-button value="JSON_PATH">JSONPath</el-radio-button>
                            <el-radio-button value="X_PATH">XPath</el-radio-button>
                            <el-radio-button value="REGEX">Regex</el-radio-button>
                          </el-radio-group>
                          <el-select v-if="activeAssertion.assertionBodyType === 'X_PATH'" v-model="activeAssertionBodyGroup(activeAssertion).responseFormat" class="api-assertion-format-select" @change="markDirty">
                            <el-option label="XML" value="XML" />
                            <el-option label="HTML" value="HTML" />
                          </el-select>
                        </div>
                        <div class="api-assertion-item-list">
                          <div v-for="(item, index) in activeAssertionBodyGroup(activeAssertion).assertions" :key="`${activeAssertion.id}-body-${activeAssertion.assertionBodyType}-${index}`" class="api-assertion-item-row is-body">
                            <el-switch v-model="item.enabled" size="small" @change="markDirty" />
                            <el-input v-model="item.expression" placeholder="$.data.id / /root/id / 正则" @input="activeAssertion.expression = item.expression || ''; markDirty()" />
                            <el-select v-model="item.condition" @change="item.operator = item.condition; markDirty()">
                              <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
                            </el-select>
                            <el-input v-model="item.expectedValue" placeholder="期望值" @input="activeAssertion.expectedValue = item.expectedValue || ''; markDirty()" />
                            <button type="button" @click="testAssertionExpression(activeAssertion, item)">测试</button>
                            <button type="button" @click="fillAssertionFromResponse(activeAssertion, item)">提取</button>
                            <button type="button" @click="copyAssertionItem(activeAssertionBodyGroup(activeAssertion).assertions, index)">复制</button>
                            <button type="button" class="api-row-remove" @click="removeAssertionItem(activeAssertionBodyGroup(activeAssertion).assertions, index, { expression: defaultAssertionExpression(activeAssertion.assertionBodyType), condition: 'EQUALS', expectedValue: '' })">删除</button>
                          </div>
                        </div>
                      </div>

                      <div v-else-if="activeAssertion.assertionType === 'RESPONSE_TIME'" class="api-assertion-type-panel">
                        <div class="api-assertion-subtitle">响应时间断言</div>
                        <div class="api-assertion-form-grid">
                          <label>条件</label>
                          <el-select v-model="activeAssertion.condition" @change="activeAssertion.operator = activeAssertion.condition; markDirty()">
                            <el-option v-for="item in assertionConditionOptions" :key="item.value" :label="item.label" :value="item.value" />
                          </el-select>
                          <label>耗时阈值</label>
                          <el-input v-model="activeAssertion.expectedValue" placeholder="1000" @input="markDirty">
                            <template #append>ms</template>
                          </el-input>
                        </div>
                      </div>

                      <div v-else-if="activeAssertion.assertionType === 'VARIABLE'" class="api-assertion-type-panel">
                        <div class="api-assertion-subtitle">
                          <span>变量断言</span>
                          <button type="button" @click="addAssertionItem(activeAssertion.variableAssertionItems || (activeAssertion.variableAssertionItems = []), { variableName: '' })">+ 添加变量</button>
                        </div>
                        <div class="api-assertion-item-list">
                          <div v-for="(item, index) in activeAssertion.variableAssertionItems" :key="`${activeAssertion.id}-variable-${index}`" class="api-assertion-item-row is-variable">
                            <el-switch v-model="item.enabled" size="small" @change="markDirty" />
                            <el-input v-model="item.variableName" placeholder="变量名" @input="activeAssertion.expression = item.variableName || ''; markDirty()" />
                            <el-select v-model="item.condition" @change="item.operator = item.condition; markDirty()">
                              <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
                            </el-select>
                            <el-input v-model="item.expectedValue" placeholder="期望值" @input="activeAssertion.expectedValue = item.expectedValue || ''; markDirty()" />
                            <button type="button" @click="copyAssertionItem(activeAssertion.variableAssertionItems || [], index)">复制</button>
                            <button type="button" class="api-row-remove" @click="removeAssertionItem(activeAssertion.variableAssertionItems || [], index, { variableName: '', condition: 'EQUALS', expectedValue: '' })">删除</button>
                          </div>
                        </div>
                      </div>

                      <div v-else class="api-assertion-type-panel">
                        <div class="api-assertion-subtitle">脚本断言</div>
                        <el-input
                          v-model="activeAssertion.script"
                          type="textarea"
                          :rows="9"
                          resize="none"
                          placeholder="if (response.statusCode !== 200) { throw new Error('状态码不正确') }"
                          @input="markDirty"
                        />
                        <small class="api-assertion-hint">发送时由后端执行脚本断言；当前只保存真实脚本内容，不做前端伪执行。</small>
                      </div>
                    </section>
                  </div>
                  <div v-else class="api-empty-body">当前请求未配置断言</div>
                </div>

                <div v-else class="api-processor-panel">
                  <div class="api-advanced-toolbar">
                    <div>
                      <strong>{{ activeEditor.activeTab === 'pre' ? '前置处理' : '后置处理' }}</strong>
                      <span>{{ activeEditor.activeTab === 'pre' ? '请求发送前执行' : '响应返回后执行' }}</span>
                    </div>
                    <el-dropdown trigger="click" @command="(command: string | number | object) => addProcessorFromCommand(activeEditor?.activeTab === 'pre' ? 'pre' : 'post', command)">
                      <button type="button" class="api-sidebar-primary">添加处理器</button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item v-for="item in processorTypeOptions" :key="item.value" :command="item.value">{{ item.label }}</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                  <div class="api-processor-list">
                    <div
                      v-for="(processor, index) in processorRowsFor(activeEditor.detail, activeEditor.activeTab === 'pre' ? 'pre' : 'post')"
                      :key="processor.id || index"
                      class="api-processor-card"
                    >
                      <div class="api-processor-card__head">
                        <el-switch v-model="processor.enabled" size="small" @change="markDirty" />
                        <el-input v-model="processor.name" placeholder="处理器名称" @input="markDirty" />
                        <el-select
                          v-model="processor.processorType"
                          @change="normalizeProcessorForType(processor, activeEditor.activeTab === 'pre' ? 'pre' : 'post')"
                        >
                          <el-option v-for="item in processorTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                        </el-select>
                        <div class="api-processor-card__actions">
                          <button type="button" @click="copyProcessor(activeEditor.activeTab === 'pre' ? 'pre' : 'post', index)">复制</button>
                          <button type="button" @click="moveProcessor(activeEditor.activeTab === 'pre' ? 'pre' : 'post', index, -1)">上移</button>
                          <button type="button" @click="moveProcessor(activeEditor.activeTab === 'pre' ? 'pre' : 'post', index, 1)">下移</button>
                          <button type="button" class="api-row-remove" @click="removeProcessor(activeEditor.activeTab === 'pre' ? 'pre' : 'post', index)">删除</button>
                        </div>
                      </div>
                      <el-input
                        v-if="processor.processorType === 'SCRIPT'"
                        v-model="processor.script"
                        type="textarea"
                        :rows="5"
                        resize="none"
                        :placeholder="processorConfigPlaceholder(processor.processorType)"
                        @input="markDirty"
                      />
                      <div v-else-if="processor.processorType === 'SQL'" class="api-processor-config-grid">
                        <label>数据源/说明</label>
                        <el-input v-model="processor.dataSourceName" placeholder="后端无数据源契约时可留空" @input="markDirty" />
                        <label>SQL</label>
                        <el-input
                          v-model="processor.sql"
                          type="textarea"
                          :rows="5"
                          resize="none"
                          placeholder="请输入 SQL 语句"
                          @input="syncProcessorScript(processor)"
                        />
                      </div>
                      <div v-else-if="processor.processorType === 'EXTRACT'" class="api-processor-extract-panel">
                        <div class="api-processor-extract-toolbar">
                          <span>提取项</span>
                          <button type="button" @click="addProcessorExtractItem(processor)">+ 添加提取项</button>
                        </div>
                        <div class="api-processor-extract-list">
                          <div
                            v-for="(item, extractIndex) in normalizeProcessorExtractItems(processor.extractors, processor)"
                            :key="item.id || extractIndex"
                            class="api-processor-extract-row"
                          >
                            <el-switch v-model="item.enabled" size="small" @change="syncProcessorScript(processor)" />
                            <el-input v-model="item.name" placeholder="名称" @input="syncProcessorScript(processor)" />
                            <el-input v-model="item.variableName" placeholder="变量名" @input="syncProcessorScript(processor)" />
                            <el-select v-model="item.variableType" @change="syncProcessorScript(processor)">
                              <el-option v-for="option in processorExtractVariableTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
                            </el-select>
                            <el-select v-model="item.sourceType" @change="syncProcessorScript(processor)">
                              <el-option v-for="option in extractorSourceOptions" :key="option.value" :label="option.label" :value="option.value" />
                            </el-select>
                            <el-select v-model="item.extractType" @change="syncProcessorScript(processor)">
                              <el-option v-for="option in extractorExpressionTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
                            </el-select>
                            <el-input v-model="item.expression" placeholder="$.data.token / Header name / Regex" @input="syncProcessorScript(processor)" />
                            <el-input v-model="item.description" placeholder="说明" @input="syncProcessorScript(processor)" />
                            <button type="button" @click="copyProcessorExtractItem(processor, extractIndex)">复制</button>
                            <button type="button" class="api-row-remove" @click="removeProcessorExtractItem(processor, extractIndex)">删除</button>
                          </div>
                        </div>
                      </div>
                      <div v-else class="api-wait-row">
                        <span>等待时长 ms</span>
                        <el-input-number v-model="processor.delayMs" :min="1" :max="600000" :step="100" controls-position="right" @change="markDirty" />
                      </div>
                      <el-input v-model="processor.description" placeholder="说明" @input="markDirty" />
                    </div>
                    <div v-if="!processorRowsFor(activeEditor.detail, activeEditor.activeTab === 'pre' ? 'pre' : 'post').length" class="api-empty-body">
                      暂无{{ activeEditor.activeTab === 'pre' ? '前置' : '后置' }}处理器
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div class="api-response-shell" :style="{ flexBasis: `${responsePanelHeight}px` }">
              <div class="api-response-resizer" title="拖拽调整响应区高度" @pointerdown="startResponseResize"></div>
              <div class="api-response-header">
                <strong>响应内容</strong>
                <div class="api-response-header__right">
                  <div v-if="!showResponseEmpty" class="api-response-metrics">
                    <span :class="['api-response-pill', `is-${statusTone(responseStatus)}`]">状态 {{ responseStatus ?? '-' }}</span>
                    <span>耗时 {{ responseDuration ?? '-' }}<template v-if="responseDuration !== null"> ms</template></span>
                    <span>大小 {{ responseSize }}</span>
                  </div>
                  <button
                    v-if="!showResponseEmpty"
                    type="button"
                    class="api-response-case-button"
                    @click="saveAsCase"
                  >
                    保存为用例
                  </button>
                </div>
              </div>
              <div class="api-response-content">
                <div v-if="showResponseEmpty" class="api-response-empty">
                  <div class="api-response-empty__window"><span></span><span></span><span></span></div>
                  <p>点击 <b>发送</b> 获取响应内容</p>
                </div>
                <template v-else>
                  <div class="api-response-tabs">
                    <button :class="{ 'is-active': activeEditor.responseTab === 'body' }" @click="activeEditor.responseTab = 'body'">Body</button>
                    <button :class="{ 'is-active': activeEditor.responseTab === 'header' }" @click="activeEditor.responseTab = 'header'">Header</button>
                    <button :class="{ 'is-active': activeEditor.responseTab === 'console' }" @click="activeEditor.responseTab = 'console'">控制台{{ extractionRows.length ? ` · 提取${extractionRows.length}` : '' }}{{ processorRows.length ? ` · 处理${processorRows.length}` : '' }}</button>
                    <button :class="{ 'is-active': activeEditor.responseTab === 'actualRequest' }" @click="activeEditor.responseTab = 'actualRequest'">实际请求</button>
                    <button :class="{ 'is-active': activeEditor.responseTab === 'assertions' }" @click="activeEditor.responseTab = 'assertions'">断言</button>
                  </div>
                  <pre v-if="activeEditor.responseTab === 'body'" class="api-response-pre">{{ responseBodyPretty }}</pre>
                  <pre v-else-if="activeEditor.responseTab === 'header'" class="api-response-pre">{{ responseHeaders }}</pre>
                  <pre v-else-if="activeEditor.responseTab === 'console'" class="api-response-pre">{{ responseConsole }}</pre>
                  <pre v-else-if="activeEditor.responseTab === 'actualRequest'" class="api-response-pre">{{ actualRequest }}</pre>
                  <el-table v-else-if="assertionRows.length" :data="assertionRows" size="small">
                    <el-table-column prop="name" label="断言名称" min-width="140" />
                    <el-table-column label="条件" width="100">
                      <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
                    </el-table-column>
                    <el-table-column prop="expectedValue" label="期望值" min-width="120" />
                    <el-table-column prop="actualValue" label="实际值" min-width="120" />
                    <el-table-column label="结果" width="90">
                      <template #default="{ row }">
                        <span :class="['api-assertion-result-pill', assertionResultClass(row.success)]">
                          {{ assertionResultLabel(row.success) }}
                        </span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="message" label="失败原因" min-width="160" />
                  </el-table>
                  <div v-else class="api-empty-body">当前请求未配置断言</div>
                </template>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <el-dialog v-model="importDialogVisible" title="导入接口" width="560px" append-to-body>
      <div class="api-import-dialog">
        <div class="api-import-notice">
          <strong>普通导入暂未接入</strong>
          <span>当前后端未提供 Swagger / OpenAPI、Postman Collection、HAR 文件导入接口，本轮不伪造导入成功。</span>
        </div>
        <div class="api-import-capabilities">
          <div v-for="item in importCapabilityItems" :key="item.name" class="api-import-capability">
            <div>
              <strong>{{ item.name }}</strong>
              <span>{{ item.description }}</span>
            </div>
            <em>{{ item.status }}</em>
          </div>
        </div>
        <div class="api-import-curl">
          <div>
            <strong>Curl 导入当前请求</strong>
            <span>已支持 method、URL、Headers、Body 的最小解析，会填充到当前打开的请求 tab。</span>
          </div>
          <button type="button" class="api-sidebar-primary" @click="openCurlFromImportDialog">使用 Curl</button>
        </div>
      </div>
      <template #footer>
        <button type="button" class="api-dialog-cancel" @click="importDialogVisible = false">关闭</button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchAddVisible" :title="batchAddTitle" width="560px" append-to-body>
      <div class="api-batch-dialog">
        <p>{{ batchAddHint }}</p>
        <el-input
          v-model="batchAddText"
          type="textarea"
          :rows="10"
          resize="none"
          :placeholder="batchAddPlaceholder"
        />
      </div>
      <template #footer>
        <div class="api-dialog-footer">
          <el-button @click="batchAddVisible = false">取消</el-button>
          <el-button type="primary" @click="applyBatchAdd">确认添加</el-button>
        </div>
      </template>
    </el-dialog>

    <el-drawer v-model="caseDetailDrawerVisible" size="760px" class="api-case-detail-drawer" append-to-body>
      <template #header>
        <div class="api-case-drawer-header">
          <strong>{{ viewingCaseItem?.name || '用例详情' }}</strong>
          <span v-if="viewingCaseItem">{{ viewingCaseItem.method }} {{ viewingCaseItem.path }}</span>
        </div>
      </template>

      <div class="api-case-drawer-body">
        <div class="api-case-drawer-tabs">
          <button type="button" :class="{ 'is-active': caseDetailDrawerTab === 'detail' }" @click="caseDetailDrawerTab = 'detail'">详情</button>
          <button type="button" :class="{ 'is-active': caseDetailDrawerTab === 'history' }" @click="caseDetailDrawerTab = 'history'">运行历史</button>
          <button type="button" :class="{ 'is-active': caseDetailDrawerTab === 'changes' }" @click="caseDetailDrawerTab = 'changes'">变更历史</button>
        </div>

        <div v-if="caseDetailDrawerTab === 'detail'" class="api-case-detail-panel" v-loading="viewingCaseDetailLoading">
          <div v-if="viewingCaseDetailErrorMessage" class="api-empty-body">{{ viewingCaseDetailErrorMessage }}</div>
          <template v-else-if="viewingCaseDetail">
            <div class="api-case-summary-grid">
              <div><span>用例名称</span><strong>{{ viewingCaseDetail.name }}</strong></div>
              <div><span>接口</span><strong>{{ viewingCaseDetail.definitionName }}</strong></div>
              <div><span>方法</span><strong>{{ viewingCaseDetail.method }}</strong></div>
              <div><span>路径</span><strong>{{ viewingCaseDetail.path }}</strong></div>
              <div><span>最近结果</span><strong :class="['api-run-result-pill', runResultClass(viewingCaseDetail.lastRunResult)]">{{ runResultLabel(viewingCaseDetail.lastRunResult) }}</strong></div>
              <div><span>最近执行</span><strong>{{ formatDateTime(viewingCaseDetail.lastRunAt) }}</strong></div>
            </div>
            <div class="api-case-detail-section">
              <strong>请求配置</strong>
              <div class="api-case-config-blocks">
                <section class="api-case-config-block">
                  <div><strong>Params</strong><span>{{ enabledRows(viewingCaseDetail.requestConfig.queryParams).length }} 项</span></div>
                  <div v-if="enabledRows(viewingCaseDetail.requestConfig.queryParams).length" class="api-case-kv-list">
                    <span v-for="row in enabledRows(viewingCaseDetail.requestConfig.queryParams)" :key="`query-${row.key}`">{{ row.key }} = {{ row.value || '-' }}</span>
                  </div>
                  <div v-else class="api-case-config-empty">未配置</div>
                </section>
                <section class="api-case-config-block">
                  <div><strong>Header</strong><span>{{ enabledRows(viewingCaseDetail.requestConfig.headers).length }} 项</span></div>
                  <div v-if="enabledRows(viewingCaseDetail.requestConfig.headers).length" class="api-case-kv-list">
                    <span v-for="row in enabledRows(viewingCaseDetail.requestConfig.headers)" :key="`header-${row.key}`">{{ row.key }} = {{ row.value || '-' }}</span>
                  </div>
                  <div v-else class="api-case-config-empty">未配置</div>
                </section>
                <section class="api-case-config-block">
                  <div><strong>Cookie</strong><span>{{ enabledRows(viewingCaseDetail.requestConfig.cookies).length }} 项</span></div>
                  <div v-if="enabledRows(viewingCaseDetail.requestConfig.cookies).length" class="api-case-kv-list">
                    <span v-for="row in enabledRows(viewingCaseDetail.requestConfig.cookies)" :key="`cookie-${row.key}`">{{ row.key }} = {{ row.value || '-' }}</span>
                  </div>
                  <div v-else class="api-case-config-empty">未配置</div>
                </section>
                <section class="api-case-config-block">
                  <div><strong>Body</strong><span>{{ bodyModeLabel(viewingCaseDetail.requestConfig.body.type) }}</span></div>
                  <div v-if="enabledRows(viewingCaseDetail.requestConfig.body.formItems).length" class="api-case-kv-list">
                    <span v-for="row in enabledRows(viewingCaseDetail.requestConfig.body.formItems)" :key="`body-${row.key}`">{{ row.key }} = {{ row.fileName || row.value || '-' }}</span>
                  </div>
                  <pre v-else-if="viewingCaseDetail.requestConfig.body.rawText">{{ toPrettyJson(viewingCaseDetail.requestConfig.body.rawText) }}</pre>
                  <div v-else-if="viewingCaseDetail.requestConfig.body.fileName" class="api-case-config-empty">{{ viewingCaseDetail.requestConfig.body.fileName }} · {{ formatFileSize(viewingCaseDetail.requestConfig.body.fileSize) }}</div>
                  <div v-else class="api-case-config-empty">未配置</div>
                </section>
                <section class="api-case-config-block">
                  <div><strong>Auth</strong><span>{{ viewingCaseDetail.requestConfig.authConfig.authType || 'NONE' }}</span></div>
                  <div v-if="viewingCaseDetail.requestConfig.authConfig.authType === 'BASIC'" class="api-case-kv-list">
                    <span>用户名 = {{ viewingCaseDetail.requestConfig.authConfig.basicAuth?.userName || '-' }}</span>
                    <span>密码 = {{ viewingCaseDetail.requestConfig.authConfig.basicAuth?.password ? '已配置' : '-' }}</span>
                  </div>
                  <div v-else-if="viewingCaseDetail.requestConfig.authConfig.authType === 'DIGEST'" class="api-case-kv-list">
                    <span>用户名 = {{ viewingCaseDetail.requestConfig.authConfig.digestAuth?.userName || '-' }}</span>
                    <span>密码 = {{ viewingCaseDetail.requestConfig.authConfig.digestAuth?.password ? '已配置' : '-' }}</span>
                  </div>
                  <div v-else class="api-case-config-empty">No Auth</div>
                </section>
                <section class="api-case-config-block">
                  <div><strong>前置处理</strong><span>{{ viewingCaseDetail.preProcessors.length }} 项</span></div>
                  <pre v-if="viewingCaseDetail.preProcessors.length">{{ toPrettyJson(viewingCaseDetail.preProcessors) }}</pre>
                  <div v-else class="api-case-config-empty">未配置</div>
                </section>
                <section class="api-case-config-block">
                  <div><strong>后置处理</strong><span>{{ viewingCaseDetail.postProcessors.length }} 项</span></div>
                  <pre v-if="viewingCaseDetail.postProcessors.length">{{ toPrettyJson(viewingCaseDetail.postProcessors) }}</pre>
                  <div v-else class="api-case-config-empty">未配置</div>
                </section>
                <section class="api-case-config-block">
                  <div><strong>断言</strong><span>{{ viewingCaseDetail.assertions.length }} 项</span></div>
                  <pre v-if="viewingCaseDetail.assertions.length">{{ toPrettyJson(viewingCaseDetail.assertions) }}</pre>
                  <div v-else class="api-case-config-empty">未配置</div>
                </section>
                <section class="api-case-config-block">
                  <div><strong>提取器</strong><span>{{ viewingCaseDetail.extractors.length }} 项</span></div>
                  <pre v-if="viewingCaseDetail.extractors.length">{{ toPrettyJson(viewingCaseDetail.extractors) }}</pre>
                  <div v-else class="api-case-config-empty">未配置</div>
                </section>
              </div>
            </div>
            <div class="api-case-detail-section">
              <strong>最近响应预览</strong>
              <template v-if="caseDetailPreviewStep">
                <div class="api-case-step-meta">
                  <span>状态码 {{ caseDetailPreviewStep.response?.statusCode ?? '-' }}</span>
                  <span>耗时 {{ formatDuration(caseDetailPreviewStep.durationMs) }}</span>
                  <span v-if="caseDetailPreviewStep.errorMessage">失败原因：{{ caseDetailPreviewStep.errorMessage }}</span>
                </div>
                <div class="api-case-history-snapshots">
                  <div>
                    <span>Body</span>
                    <pre>{{ toPrettyJson(caseDetailPreviewStep.response?.body) }}</pre>
                  </div>
                  <div>
                    <span>Header</span>
                    <pre>{{ toPrettyJson(caseDetailPreviewStep.response?.headers || {}) }}</pre>
                  </div>
                </div>
                <div class="api-case-history-snapshots">
                  <div>
                    <span>实际请求</span>
                    <pre>{{ toPrettyJson(caseDetailPreviewStep.request) }}</pre>
                  </div>
                  <div>
                    <span>断言 / 提取 / 处理器</span>
                    <pre>{{ toPrettyJson({
                      assertionResults: caseDetailPreviewStep.assertionResults,
                      extractionResults: caseDetailPreviewStep.extractionResults,
                      processorResults: caseDetailPreviewStep.processorResults,
                    }) }}</pre>
                  </div>
                </div>
              </template>
              <div v-else class="api-empty-body">暂无最近响应预览，执行一次用例后展示。</div>
            </div>
          </template>
          <div v-else class="api-empty-body">暂无用例详情</div>
        </div>

        <div v-else-if="caseDetailDrawerTab === 'history'" class="api-case-history-panel">
          <div class="api-case-history-list" v-loading="caseRunHistoryLoading">
            <div v-if="caseRunHistoryErrorMessage" class="api-empty-body">{{ caseRunHistoryErrorMessage }}</div>
            <template v-else>
              <button
                v-for="item in caseRunHistories"
                :key="item.id"
                type="button"
                :class="['api-case-history-item', { 'is-active': selectedCaseRunHistoryId === item.id }]"
                @click="openCaseRunHistoryDetail(item)"
              >
                <span :class="['api-run-result-pill', runResultClass(item.result)]">{{ runResultLabel(item.result) }}</span>
                <strong>{{ formatDateTime(item.createdAt) }}</strong>
                <small>{{ item.statusCode ?? '-' }} / {{ formatDuration(item.durationMs) }} / {{ formatResponseSize(item.responseSize) }}</small>
              </button>
            </template>
            <div v-if="!caseRunHistoryLoading && !caseRunHistoryErrorMessage && !caseRunHistories.length" class="api-empty-body">暂无运行历史</div>
          </div>

          <div class="api-case-history-detail" v-loading="caseRunHistoryDetailLoading">
            <div v-if="caseRunHistoryDetailErrorMessage" class="api-empty-body">{{ caseRunHistoryDetailErrorMessage }}</div>
            <template v-else-if="selectedCaseRunHistoryDetail">
              <div class="api-case-summary-grid">
                <div><span>执行结果</span><strong :class="['api-run-result-pill', runResultClass(selectedCaseRunHistoryDetail.result)]">{{ runResultLabel(selectedCaseRunHistoryDetail.result) }}</strong></div>
                <div><span>状态码</span><strong>{{ selectedCaseRunHistoryDetail.statusCode ?? '-' }}</strong></div>
                <div><span>耗时</span><strong>{{ formatDuration(selectedCaseRunHistoryDetail.durationMs) }}</strong></div>
                <div><span>响应大小</span><strong>{{ formatResponseSize(selectedCaseRunHistoryDetail.responseSize) }}</strong></div>
                <div><span>环境</span><strong>{{ selectedCaseRunHistoryDetail.environmentName || '-' }}</strong></div>
                <div><span>变量集</span><strong>{{ selectedCaseRunHistoryDetail.variableSetName || '-' }}</strong></div>
              </div>
              <div v-if="selectedCaseRunHistoryDetail.failureSummary" class="api-case-failure-box">{{ selectedCaseRunHistoryDetail.failureSummary }}</div>
              <div v-for="(step, index) in selectedCaseRunHistoryDetail.stepResults" :key="step.id || index" class="api-case-detail-section">
                <strong>{{ step.stepName || `步骤 ${index + 1}` }}</strong>
                <div class="api-case-step-meta">
                  <span>状态码 {{ step.response?.statusCode ?? '-' }}</span>
                  <span>耗时 {{ formatDuration(step.durationMs) }}</span>
                  <span v-if="step.errorMessage">失败原因：{{ step.errorMessage }}</span>
                </div>
                <div class="api-case-history-snapshots">
                  <div>
                    <span>请求快照</span>
                    <pre>{{ toPrettyJson(step.request) }}</pre>
                  </div>
                  <div>
                    <span>响应快照</span>
                    <pre>{{ toPrettyJson(step.response) }}</pre>
                  </div>
                </div>
                <div class="api-case-history-snapshots">
                  <div>
                    <span>断言结果</span>
                    <pre>{{ toPrettyJson(step.assertionResults) }}</pre>
                  </div>
                  <div>
                    <span>处理器 / 提取结果</span>
                    <pre>{{ toPrettyJson({ extractionResults: step.extractionResults, processorResults: step.processorResults }) }}</pre>
                  </div>
                </div>
              </div>
              <div v-if="!selectedCaseRunHistoryDetail.stepResults.length" class="api-empty-body">该历史暂无步骤详情</div>
            </template>
            <div v-else class="api-empty-body">请选择一条运行历史</div>
          </div>
        </div>

        <div v-else class="api-case-detail-panel">
          <div class="api-empty-body">
            当前后端暂未提供接口用例变更历史接口，本轮不伪造变更记录。
          </div>
        </div>
      </div>
    </el-drawer>

    <el-drawer v-model="aiCaseDrawerVisible" size="820px" class="api-ai-case-drawer" append-to-body>
      <template #header>
        <div class="api-case-drawer-header">
          <strong>AI 生成接口用例</strong>
          <span>{{ activeEditor?.detail.name || '-' }} · {{ activeEditor?.detail.requestConfig.method || '-' }} {{ activeEditor?.detail.requestConfig.path || '-' }}</span>
        </div>
      </template>

      <div class="api-ai-case-body">
        <section class="api-ai-case-section">
          <div class="api-ai-case-section__header">
            <strong>生成配置</strong>
            <span :class="['api-ai-status-pill', `is-${aiCaseGenerationStatus}`]">{{ aiCaseGenerationStatusText }}</span>
          </div>
          <div v-if="aiCaseProviderErrorMessage" class="api-case-failure-box">{{ aiCaseProviderErrorMessage }}</div>
          <div v-else-if="!aiCaseProvidersLoading && !aiCaseAvailableProviders.length" class="api-empty-body">
            暂无可用 AI 模型，请先到 AI 连接池配置个人模型。
          </div>
          <div class="api-ai-case-config-grid">
            <label>模型</label>
            <el-select v-model="aiCaseSelectedProviderId" :loading="aiCaseProvidersLoading" placeholder="选择 AI 模型">
              <el-option
                v-for="item in aiCaseAvailableProviders"
                :key="item.id"
                :label="`${item.connectionName} / ${item.modelName || '-'}`"
                :value="item.id"
              />
            </el-select>
            <label>数量</label>
            <el-select v-model="aiCaseCount">
              <el-option v-for="item in aiCaseCountOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <label>去重</label>
            <el-switch v-model="aiCaseNoDuplicate" />
            <label>补充要求</label>
            <el-input v-model="aiCasePrompt" type="textarea" :rows="3" resize="none" placeholder="可补充业务规则、边界条件或特殊断言要求" />
          </div>
          <div class="api-ai-case-options">
            <el-checkbox-group v-model="aiCaseSelectedOptionKeys">
              <el-checkbox v-for="item in aiCaseGenerationOptions" :key="item.key" :value="item.key">
                {{ item.groupLabel }} · {{ item.label }}
              </el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="api-ai-case-actions">
            <button type="button" class="api-sidebar-primary" :disabled="!aiCaseCanGenerate" @click="submitAiCaseGeneration">
              {{ aiCaseGenerationStatus === 'running' ? '生成中...' : '开始生成' }}
            </button>
            <button type="button" class="api-sidebar-secondary" @click="loadAiCaseProviders">刷新模型</button>
          </div>
          <div v-if="aiCaseGenerationMessage" class="api-ai-case-message">{{ aiCaseGenerationMessage }}</div>
        </section>

        <section class="api-ai-case-section">
          <div class="api-ai-case-section__header">
            <strong>生成过程</strong>
            <span>{{ aiCaseGenerationLogs.length }} 条事件</span>
          </div>
          <pre v-if="aiCaseGenerationLogs.length" class="api-ai-case-log">{{ aiCaseGenerationLogs.join('\n') }}</pre>
          <div v-else class="api-empty-body">点击开始生成后，这里展示真实生成过程。</div>
        </section>

        <section class="api-ai-case-section">
          <div class="api-ai-case-section__header">
            <strong>生成结果</strong>
            <span>共 {{ aiCaseGeneratedResults.length }} 条，待处理 {{ aiCasePendingResults.length }} 条</span>
          </div>
          <div class="api-ai-result-toolbar">
            <div class="api-ai-result-filters">
              <button
                v-for="item in aiCaseResultFilterOptions"
                :key="item.value"
                type="button"
                :class="{ 'is-active': aiCaseResultFilter === item.value }"
                @click="aiCaseResultFilter = item.value"
              >
                {{ item.label }} {{ item.count }}
              </button>
            </div>
            <div class="api-ai-result-search">
              <el-input v-model="aiCaseResultKeyword" clearable placeholder="搜索名称、预期或失败原因" />
              <el-select v-model="aiCaseResultGroup" clearable placeholder="场景组">
                <el-option v-for="item in aiCaseResultGroupOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
              <el-select v-model="aiCaseResultType" clearable placeholder="类型">
                <el-option v-for="item in aiCaseResultTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </div>
            <div class="api-ai-result-actions">
              <button
                type="button"
                class="api-sidebar-secondary"
                :disabled="!aiCasePendingResults.length || Boolean(aiCaseSavingId)"
                @click="batchDiscardAiGeneratedCases"
              >
                批量弃用
              </button>
              <button
                type="button"
                class="api-sidebar-primary"
                :disabled="!aiCasePendingResults.length || Boolean(aiCaseSavingId)"
                @click="batchAcceptAiGeneratedCases"
              >
                批量采纳
              </button>
            </div>
          </div>
          <div v-if="aiCaseGeneratedResults.length" class="api-ai-result-list">
            <article v-for="item in aiCaseFilteredResults" :key="item.id" class="api-ai-result-card">
              <div class="api-ai-result-card__head">
                <el-checkbox
                  v-if="item.status === 'pending'"
                  v-model="aiCaseSelectedResultIds"
                  :value="item.id"
                  class="api-ai-result-card__check"
                />
                <div>
                  <strong>{{ item.draft.name || 'AI 生成接口用例' }}</strong>
                  <span>{{ item.draft.group || '未分组' }} · {{ item.draft.type || '接口用例' }}</span>
                </div>
                <span :class="['api-ai-result-status', `is-${item.status}`]">{{ item.status === 'accepted' ? '已采纳' : item.status === 'discarded' ? '已弃用' : item.status === 'failed' ? '失败' : '待处理' }}</span>
              </div>
              <p v-if="item.draft.description">{{ item.draft.description }}</p>
              <p v-if="item.draft.expected">预期：{{ item.draft.expected }}</p>
              <div class="api-ai-result-card__meta">
                <span>{{ item.draft.requestConfig?.method || activeEditor?.detail.requestConfig.method || '-' }}</span>
                <span>{{ item.draft.requestConfig?.path || activeEditor?.detail.requestConfig.path || '-' }}</span>
              </div>
              <div v-if="item.message" class="api-case-failure-box">{{ item.message }}</div>
              <div class="api-ai-result-card__actions">
                <button type="button" class="api-sidebar-secondary" @click="openAiGeneratedCaseDetail(item)">查看详情</button>
                <button
                  v-if="item.status === 'pending'"
                  type="button"
                  class="api-sidebar-primary"
                  :disabled="aiCaseSavingId === item.id"
                  @click="saveAiGeneratedCase(item)"
                >
                  {{ aiCaseSavingId === item.id ? '保存中...' : '采纳保存' }}
                </button>
                <button
                  v-if="item.status === 'pending'"
                  type="button"
                  class="api-sidebar-secondary"
                  @click="discardAiGeneratedCase(item)"
                >
                  弃用
                </button>
                <button
                  v-else-if="item.status === 'discarded'"
                  type="button"
                  class="api-sidebar-secondary"
                  @click="restoreAiGeneratedCase(item)"
                >
                  恢复
                </button>
                <button v-else type="button" class="api-sidebar-secondary" disabled>
                  {{ item.status === 'accepted' ? '已保存' : '不可操作' }}
                </button>
              </div>
            </article>
            <div v-if="!aiCaseFilteredResults.length" class="api-empty-body">当前筛选暂无生成结果</div>
          </div>
          <div v-else class="api-empty-body">暂无生成结果</div>
        </section>
      </div>
    </el-drawer>

    <el-dialog
      v-model="aiCaseDetailVisible"
      class="api-ai-case-detail-dialog"
      title="生成用例详情"
      width="720px"
      append-to-body
    >
      <div v-if="aiCaseDetailResult" class="api-ai-case-detail">
        <div class="api-ai-case-detail-summary">
          <div>
            <span>用例名称</span>
            <strong>{{ aiCaseDetailResult.draft.name || 'AI 生成接口用例' }}</strong>
          </div>
          <div>
            <span>结果状态</span>
            <strong>{{ aiCaseDetailResult.status === 'accepted' ? '已采纳' : aiCaseDetailResult.status === 'discarded' ? '已弃用' : aiCaseDetailResult.status === 'failed' ? '失败' : '待处理' }}</strong>
          </div>
          <div>
            <span>请求方法</span>
            <strong>{{ aiCaseDetailResult.draft.requestConfig?.method || activeEditor?.detail.requestConfig.method || '-' }}</strong>
          </div>
          <div>
            <span>请求路径</span>
            <strong>{{ aiCaseDetailResult.draft.requestConfig?.path || activeEditor?.detail.requestConfig.path || '-' }}</strong>
          </div>
        </div>
        <section v-if="aiCaseDetailResult.draft.description" class="api-ai-case-detail-section">
          <strong>描述</strong>
          <p>{{ aiCaseDetailResult.draft.description }}</p>
        </section>
        <section v-if="aiCaseDetailResult.draft.expected" class="api-ai-case-detail-section">
          <strong>预期结果</strong>
          <p>{{ aiCaseDetailResult.draft.expected }}</p>
        </section>
        <section v-if="aiGeneratedDraftExtra(aiCaseDetailResult, 'generationReason')" class="api-ai-case-detail-section">
          <strong>生成原因</strong>
          <p>{{ aiGeneratedDraftExtra(aiCaseDetailResult, 'generationReason') }}</p>
        </section>
        <section v-if="aiGeneratedDraftExtra(aiCaseDetailResult, 'coveragePoints')" class="api-ai-case-detail-section">
          <strong>覆盖点</strong>
          <pre>{{ toPrettyJson(aiGeneratedDraftExtra(aiCaseDetailResult, 'coveragePoints')) }}</pre>
        </section>
        <section v-if="aiCaseDetailResult.draft.tags?.length" class="api-ai-case-detail-section">
          <strong>标签</strong>
          <div class="api-ai-case-detail-tags">
            <span v-for="tag in aiCaseDetailResult.draft.tags" :key="tag">{{ tag }}</span>
          </div>
        </section>
        <section v-if="aiCaseDetailResult.message" class="api-case-failure-box">{{ aiCaseDetailResult.message }}</section>
        <section class="api-ai-case-detail-section">
          <strong>请求配置</strong>
          <pre>{{ toPrettyJson(aiCaseDetailResult.draft.requestConfig || {}) }}</pre>
        </section>
        <section class="api-ai-case-detail-grid">
          <div>
            <span>断言</span>
            <pre>{{ toPrettyJson(aiCaseDetailResult.draft.assertions || []) }}</pre>
          </div>
          <div>
            <span>前置处理</span>
            <pre>{{ toPrettyJson(aiCaseDetailResult.draft.preProcessors || []) }}</pre>
          </div>
          <div>
            <span>后置处理</span>
            <pre>{{ toPrettyJson(aiCaseDetailResult.draft.postProcessors || []) }}</pre>
          </div>
        </section>
      </div>
    </el-dialog>

    <ApiCaseCreateEditDialog
      v-model="caseDialogVisible"
      :mode="caseDialogMode"
      :definition="currentDefinitionSummary()"
      :case-item="editingCaseItem"
      :case-detail="editingCaseDetail"
      :case-draft-detail="caseDialogMode === 'create' ? currentCaseDraftDetail() : null"
      :saving="caseDialogSaving"
      :loading-detail="caseDetailLoading"
      :detail-error-message="caseDetailErrorMessage"
      :default-workspace-code="props.workspaceCode"
      @submit="submitCaseDialog"
      @retry-detail="editingCaseItem && openEditCaseDialog(editingCaseItem)"
    />
  </section>
</template>

<style scoped>
.api-interface-workspace {
  display: flex;
  min-width: 0;
  height: calc(100dvh - 136px);
  min-height: 560px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
}

.api-interface-tabs {
  display: flex;
  height: 44px;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  padding: 0 24px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.api-interface-tab {
  min-width: 68px;
  height: 32px;
  border: 0;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
}

.api-interface-tab.is-active {
  background: #fff;
  color: var(--app-text-primary);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
  font-weight: 700;
}

.api-interface-tab:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.api-interface-shell {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 290px minmax(0, 1fr);
}

.api-interface-sidebar {
  display: flex;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--app-border);
  background: #fff;
}

.api-interface-sidebar__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 14px 16px 0;
}

.api-sidebar-primary,
.api-sidebar-secondary,
.api-send-button,
.api-curl-button {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: #fff;
  color: var(--app-text-primary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.api-sidebar-primary,
.api-send-button {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: #fff;
}

.api-sidebar-secondary:hover,
.api-curl-button:hover {
  background: var(--app-bg-page);
}

.api-sidebar-search {
  position: relative;
  padding: 12px 16px 0;
}

.api-sidebar-search > .el-icon {
  position: absolute;
  top: 30px;
  left: 28px;
  z-index: 2;
  color: var(--app-text-subtle);
}

.api-sidebar-search :deep(.el-input__wrapper) {
  height: 36px;
  padding-left: 32px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-directory-title {
  display: flex;
  height: 52px;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-directory-title div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-directory-title b {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 500;
}

.api-directory-title button,
.api-editor-tab-add,
.api-editor-tab-more {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.api-directory-title button:hover,
.api-editor-tab-add:hover,
.api-editor-tab-more:hover {
  background: var(--app-bg-page);
}

.api-directory-body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 0 8px 12px;
}

.api-directory-error {
  margin: 12px 8px;
  padding: 10px;
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.api-directory-tree {
  background: transparent;
}

.api-directory-tree :deep(.el-tree-node__content) {
  height: 32px;
  border-radius: var(--app-radius-md);
}

.api-directory-tree :deep(.el-tree-node__content:hover) {
  background: var(--app-primary-soft);
}

.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-soft);
}

.api-directory-node {
  display: flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  gap: 7px;
  font-size: var(--app-font-size-sm);
}

.api-directory-node__action {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
}

.api-directory-tree :deep(.el-tree-node__content:hover) .api-directory-node__action,
.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content) .api-directory-node__action {
  opacity: 1;
  pointer-events: auto;
}

.api-directory-node__action:hover {
  background: #fff;
  color: var(--app-primary);
}

.api-directory-node__name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-directory-node__icon {
  color: var(--app-primary);
}

.api-directory-node__count {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
}

.api-method {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 800;
  line-height: 16px;
}

.method-get { color: #00875a; }
.method-post { color: #e8590c; }
.method-put { color: #2563eb; }
.method-patch { color: #7c3aed; }
.method-delete { color: #dc2626; }
.method-head,
.method-options { color: #64748b; }

.api-interface-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background: #fff;
}

.api-editor-tabs {
  display: flex;
  height: 40px;
  min-height: 40px;
  align-items: center;
  border-bottom: 1px solid var(--app-border);
}

.api-editor-tabs__nav {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  overflow: hidden;
}

.api-editor-tab {
  display: inline-flex;
  max-width: 220px;
  height: 40px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 0;
  border-right: 1px solid var(--app-border);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  cursor: pointer;
}

.api-editor-tab.is-active {
  background: #fff;
  color: var(--app-text-primary);
}

.api-editor-tab__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-editor-tab__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--app-warning);
}

.api-editor-tab__close {
  display: inline-flex;
  color: var(--app-text-subtle);
}

.api-editor-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--app-text-muted);
}

.api-editor-empty button {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--app-primary);
  border-radius: var(--app-radius-md);
  background: var(--app-primary);
  color: #fff;
}

.api-request-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 16px 10px;
  border-bottom: 1px solid var(--app-border);
}

.api-url-compose {
  display: grid;
  min-width: 360px;
  flex: 1 1 460px;
  grid-template-columns: 104px minmax(0, 1fr) 68px;
}

.api-run-options {
  order: 3;
  display: flex;
  flex: 1 1 100%;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-left: 114px;
}

.api-run-options .el-select {
  width: 160px;
}

.api-run-options small {
  margin-left: 8px;
  color: var(--app-text-subtle);
}

.api-run-options__hint {
  max-width: 120px;
  overflow: hidden;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-method-select :deep(.el-select__wrapper),
.api-url-compose :deep(.el-input__wrapper),
.api-curl-button {
  height: 38px;
  border-radius: 0;
}

.api-method-select :deep(.el-select__wrapper) {
  border-radius: var(--app-radius-md) 0 0 var(--app-radius-md);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-url-compose :deep(.el-input__wrapper) {
  box-shadow: inset 0 1px 0 0 var(--app-border-strong), inset 0 -1px 0 0 var(--app-border-strong);
}

.api-curl-button {
  border-radius: 0 var(--app-radius-md) var(--app-radius-md) 0;
  color: var(--app-primary);
}

.api-send-button {
  width: 96px;
  height: 38px;
}

.api-save-dropdown {
  width: 120px;
}

.api-save-dropdown :deep(.el-button) {
  height: 38px;
}

.api-editor-scroll {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.api-content-tabs,
.api-response-tabs {
  display: flex;
  height: 46px;
  align-items: center;
  gap: 0;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border);
}

.api-content-tab,
.api-response-tabs button {
  position: relative;
  height: 46px;
  border: 0;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  padding: 0 12px;
}

.api-content-tab.is-active,
.api-response-tabs button.is-active {
  color: var(--app-primary);
  font-weight: 700;
}

.api-content-tab.is-active::after,
.api-response-tabs button.is-active::after {
  position: absolute;
  right: 12px;
  bottom: 0;
  left: 12px;
  height: 2px;
  background: var(--app-primary);
  content: '';
}

.api-tab-badge {
  margin-left: 4px;
  color: var(--app-text-subtle);
  font-size: 11px;
}

.api-request-body {
  min-height: 260px;
  flex: 1 1 320px;
  overflow: auto;
  padding: 10px 16px 12px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.api-param-table {
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
}

.api-param-toolbar {
  display: flex;
  min-width: 0;
  height: 38px;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-param-toolbar button,
.api-advanced-actions button,
.api-case-actions button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.api-param-header,
.api-param-row {
  display: grid;
  min-width: 1080px;
  grid-template-columns: 42px 1.1fr 48px 120px 1.1fr 170px 74px 1fr 64px;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
}

.api-param-table.is-header .api-param-header,
.api-param-table.is-header .api-param-row {
  min-width: 820px;
  grid-template-columns: 42px 1.2fr 1.5fr 70px 1.4fr 64px;
}

.api-param-table.is-body-form .api-param-header,
.api-param-table.is-body-form .api-param-row {
  min-width: 1040px;
  grid-template-columns: 42px 1.1fr 48px 120px 1.25fr 170px 1fr 64px;
}

.api-param-header {
  min-height: 36px;
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-param-row {
  min-height: 38px;
  border-top: 1px solid var(--app-border-soft);
}

.api-param-row :deep(.el-input__wrapper),
.api-param-row :deep(.el-select__wrapper),
.api-param-row :deep(.el-input-number) {
  min-height: 30px;
}

.api-length-range {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.api-length-range :deep(.el-input-number) {
  width: 100%;
}

.api-row-remove,
.api-add-row {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
}

.api-add-row {
  height: 36px;
  padding-left: 16px;
}

.api-body-section {
  display: flex;
  min-height: 300px;
  flex-direction: column;
}

.api-body-modes {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.api-body-chip {
  height: 26px;
  padding: 0 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: var(--app-text-secondary);
  cursor: pointer;
}

.api-body-chip.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.api-body-editor {
  min-height: 300px;
  flex: 1;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
}

.api-body-editor :deep(.el-textarea),
.api-body-editor :deep(.el-textarea__inner),
.api-json-panel :deep(.el-textarea),
.api-json-panel :deep(.el-textarea__inner) {
  height: 100%;
  min-height: 300px;
  border: 0;
  box-shadow: none;
  font-family: Consolas, Monaco, monospace;
}

.api-body-editor.is-empty,
.api-empty-body {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-bg-page);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
}

.api-empty-body {
  min-height: 180px;
  border-radius: var(--app-radius-lg);
}

.api-binary-panel,
.api-auth-panel,
.api-settings-panel,
.api-json-panel,
.api-cases-panel,
.api-assertion-panel,
.api-extractor-panel,
.api-processor-panel {
  display: grid;
  gap: 12px;
  max-width: none;
}

.api-auth-grid,
.api-settings-panel {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.api-auth-grid label,
.api-settings-panel label,
.api-form-label {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-binary-hint {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
}

.api-file-picker,
.api-binary-file {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.api-file-picker > span {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-file-picker small {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-file-picker__button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-file-picker__button:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.api-file-picker__button input {
  display: none;
}

.api-binary-file {
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.api-binary-file > div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.api-binary-file strong,
.api-binary-file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-binary-file span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-cases-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.api-cases-ai-entry,
.api-cases-toolbar__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.api-cases-ai-entry {
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-case-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.api-case-actions button.is-danger {
  color: var(--app-danger);
}

.api-case-detail-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--app-border);
}

.api-case-drawer-header {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.api-case-drawer-header strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
}

.api-case-drawer-header span {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-drawer-body {
  display: grid;
  gap: 14px;
  padding: 16px 20px 20px;
}

.api-case-drawer-tabs {
  display: inline-flex;
  width: fit-content;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.api-case-drawer-tabs button {
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-right: 1px solid var(--app-border);
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
}

.api-case-drawer-tabs button:last-child {
  border-right: 0;
}

.api-case-drawer-tabs button.is-active {
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-weight: 600;
}

.api-case-detail-panel {
  display: grid;
  gap: 14px;
}

.api-case-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.api-case-summary-grid > div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-case-summary-grid span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-case-summary-grid strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-run-result-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.api-run-result-pill.is-passed {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-run-result-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-run-result-pill.is-neutral {
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
}

.api-case-detail-section {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.api-case-detail-section > strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.api-case-config-blocks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-width: 0;
}

.api-case-config-block {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-case-config-block > div:first-child {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.api-case-config-block > div:first-child strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.api-case-config-block > div:first-child span,
.api-case-config-empty,
.api-case-kv-list {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-case-kv-list {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.api-case-kv-list span {
  overflow: hidden;
  color: var(--app-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-config-block pre {
  max-height: 160px;
  overflow: auto;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: #0f172a;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
}

.api-case-detail-section pre,
.api-case-history-snapshots pre {
  max-height: 220px;
  overflow: auto;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: #0f172a;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
}

.api-case-history-panel {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 14px;
  min-height: 460px;
}

.api-case-history-list {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
}

.api-case-history-item {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  text-align: left;
}

.api-case-history-item:hover,
.api-case-history-item.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.api-case-history-item strong,
.api-case-history-item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-history-item small {
  color: var(--app-text-muted);
}

.api-case-history-detail {
  display: grid;
  align-content: start;
  gap: 14px;
  min-width: 0;
}

.api-case-failure-box {
  padding: 10px 12px;
  border: 1px solid var(--app-danger-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.api-ai-case-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--app-border);
}

.api-ai-case-drawer :deep(.el-drawer__body) {
  padding: 0;
}

.api-ai-case-body {
  display: grid;
  gap: 14px;
  padding: 16px 20px 20px;
}

.api-ai-case-section {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.api-ai-case-section__header,
.api-ai-case-actions,
.api-ai-result-card__head,
.api-ai-result-card__actions,
.api-ai-result-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-ai-case-section__header,
.api-ai-result-card__head {
  justify-content: space-between;
}

.api-ai-case-section__header strong,
.api-ai-result-card__head strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.api-ai-case-section__header span,
.api-ai-result-card__head span,
.api-ai-result-card__meta {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-ai-case-config-grid {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  align-items: center;
  gap: 10px 12px;
}

.api-ai-case-config-grid label {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-ai-case-options :deep(.el-checkbox-group) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 10px;
}

.api-ai-case-message {
  padding: 8px 10px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.api-ai-case-log {
  max-height: 180px;
  overflow: auto;
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--app-radius-md);
  background: #0f172a;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
}

.api-ai-result-list {
  display: grid;
  gap: 10px;
}

.api-ai-result-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.api-ai-result-filters,
.api-ai-result-search,
.api-ai-result-actions {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.api-ai-result-search {
  flex: 1 1 260px;
  justify-content: flex-end;
}

.api-ai-result-search .el-input {
  width: 220px;
}

.api-ai-result-search .el-select {
  width: 128px;
}

.api-ai-result-filters button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  cursor: pointer;
}

.api-ai-result-filters button:hover,
.api-ai-result-filters button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-weight: 700;
}

.api-ai-result-card {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-ai-result-card p {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
}

.api-ai-result-card__head > div {
  display: grid;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.api-ai-result-card__check {
  flex: 0 0 auto;
}

.api-ai-result-status,
.api-ai-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-ai-result-status.is-accepted,
.api-ai-status-pill.is-done {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-ai-result-status.is-failed,
.api-ai-status-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-ai-status-pill.is-running {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.api-ai-result-status.is-discarded {
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
}

.api-ai-case-detail-dialog :deep(.el-dialog__body) {
  padding: 14px 18px 18px;
}

.api-ai-case-detail {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.api-ai-case-detail-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.api-ai-case-detail-summary > div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-ai-case-detail-summary span,
.api-ai-case-detail-grid span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-ai-case-detail-summary strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-ai-case-detail-section {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.api-ai-case-detail-section > strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.api-ai-case-detail-section p {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
}

.api-ai-case-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.api-ai-case-detail-tags span {
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  line-height: 22px;
}

.api-ai-case-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  min-width: 0;
}

.api-ai-case-detail-grid > div {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.api-ai-case-detail-section pre,
.api-ai-case-detail-grid pre {
  max-height: 220px;
  overflow: auto;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: #0f172a;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
}

.api-case-step-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-case-history-snapshots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-width: 0;
}

.api-case-history-snapshots > div {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.api-case-history-snapshots span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-advanced-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.api-advanced-toolbar > div:first-child {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-advanced-toolbar strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.api-advanced-toolbar span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-advanced-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.api-assertion-table,
.api-extractor-table,
.api-processor-list {
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
}

.api-assertion-header,
.api-assertion-row {
  display: grid;
  min-width: 920px;
  grid-template-columns: 64px 1.1fr 140px 130px 1fr 1fr 64px;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
}

.api-assertion-header {
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-assertion-row {
  border-top: 1px solid var(--app-border-soft);
}

.api-assertion-editor {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  min-height: 320px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.api-assertion-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  overflow: auto;
  border-right: 1px solid var(--app-border-soft);
  background: var(--app-bg-page);
}

.api-assertion-list-item {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-primary);
  text-align: left;
  cursor: pointer;
}

.api-assertion-list-item:hover,
.api-assertion-list-item.is-active {
  border-color: var(--app-primary);
  background: var(--app-bg-subtle);
}

.api-assertion-list-item__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-assertion-list-item__main span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-assertion-list-item small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-assertion-detail {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
  padding: 12px;
  overflow: auto;
}

.api-assertion-detail__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.api-assertion-form-grid {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: 10px 12px;
}

.api-assertion-form-grid label {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-assertion-type-panel {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-assertion-subtitle,
.api-assertion-mode-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.api-assertion-subtitle {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-assertion-subtitle button,
.api-assertion-item-row button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 700;
  white-space: nowrap;
}

.api-assertion-item-list {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.api-assertion-item-row {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.api-assertion-item-row.is-header {
  grid-template-columns: 48px minmax(120px, 1fr) 132px minmax(120px, 1fr) repeat(3, auto);
}

.api-assertion-item-row.is-body {
  grid-template-columns: 48px minmax(180px, 1.4fr) 132px minmax(120px, 1fr) repeat(4, auto);
}

.api-assertion-item-row.is-variable {
  grid-template-columns: 48px minmax(140px, 1fr) 132px minmax(120px, 1fr) repeat(2, auto);
}

.api-assertion-item-row .api-row-remove {
  color: var(--app-danger);
}

.api-assertion-format-select {
  width: 120px;
}

.api-assertion-hint {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-extractor-header,
.api-extractor-row {
  display: grid;
  min-width: 1280px;
  grid-template-columns: 56px 150px 130px 130px minmax(180px, 1.2fr) 140px 120px 72px 88px minmax(140px, 1fr) 64px;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
}

.api-extractor-header {
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-extractor-row {
  border-top: 1px solid var(--app-border-soft);
}

.api-assertion-result-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-assertion-result-pill.is-passed {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-assertion-result-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-processor-card {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--app-border-soft);
}

.api-processor-card:first-child {
  border-top: 0;
}

.api-processor-card__head {
  display: grid;
  grid-template-columns: 56px minmax(160px, 1fr) 160px auto;
  gap: 8px;
  align-items: center;
}

.api-processor-card__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.api-processor-config-grid {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 10px 12px;
}

.api-processor-config-grid label {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-processor-extract-panel {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.api-processor-extract-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-processor-extract-toolbar button,
.api-processor-extract-row button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 700;
  white-space: nowrap;
}

.api-processor-extract-list {
  display: grid;
  gap: 8px;
  min-width: 0;
  overflow: auto;
}

.api-processor-extract-row {
  display: grid;
  min-width: 1180px;
  grid-template-columns: 48px 130px 130px 118px 130px 128px minmax(180px, 1fr) minmax(140px, 0.8fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-processor-extract-row .api-row-remove {
  color: var(--app-danger);
}

.api-wait-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.api-json-panel p {
  margin: 0;
  color: var(--app-text-muted);
  font-weight: 700;
}

.api-response-shell {
  display: flex;
  min-height: 220px;
  flex: 0 0 250px;
  flex-direction: column;
  background: #fff;
}

.api-response-resizer {
  position: relative;
  height: 6px;
  flex: 0 0 6px;
  border-top: 1px solid var(--app-border);
  background: var(--app-bg-page);
  cursor: row-resize;
}

.api-response-resizer::after {
  position: absolute;
  top: 2px;
  left: 50%;
  width: 42px;
  height: 2px;
  border-radius: 999px;
  background: var(--app-border-strong);
  content: "";
  transform: translateX(-50%);
}

.api-response-header {
  display: flex;
  height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border);
}

.api-response-header strong {
  font-size: var(--app-font-size-sm);
}

.api-response-header__right {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.api-response-metrics {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-response-case-button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  white-space: nowrap;
}

.api-response-case-button:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.api-response-pill {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--app-bg-page);
}

.api-response-pill.is-success {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-response-pill.is-danger {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-response-pill.is-warning {
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.api-response-content {
  min-height: 220px;
  flex: 1;
  overflow: auto;
}

.api-response-empty {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--app-text-muted);
}

.api-response-empty__window {
  display: flex;
  gap: 5px;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.api-response-empty__window span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--app-text-subtle);
}

.api-response-empty p {
  margin: 0;
  font-size: var(--app-font-size-sm);
}

.api-response-empty b {
  color: var(--app-primary);
}

.api-response-pre {
  min-height: 180px;
  max-height: none;
  overflow: auto;
  margin: 0;
  padding: 12px 16px;
  background: #fff;
  color: var(--app-text-primary);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.api-directory-empty,
.api-import-dialog {
  display: grid;
  gap: 14px;
}

.api-import-notice {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--app-warning-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-warning-soft);
}

.api-import-notice strong,
.api-import-curl strong,
.api-import-capability strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.api-import-notice span,
.api-import-curl span,
.api-import-capability span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
}

.api-import-capabilities {
  display: grid;
  gap: 8px;
}

.api-import-capability,
.api-import-curl {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-import-capability > div,
.api-import-curl > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.api-import-capability em {
  flex: 0 0 auto;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-style: normal;
}

.api-dialog-cancel {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
}

.api-dialog-cancel:hover {
  background: var(--app-bg-muted);
}

.api-batch-dialog p {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.api-directory-empty {
  padding: 24px 12px;
  text-align: center;
}

.api-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1180px) {
  .api-interface-shell {
    grid-template-columns: 260px minmax(0, 1fr);
  }
}
</style>
