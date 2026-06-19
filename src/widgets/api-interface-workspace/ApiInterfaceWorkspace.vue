<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  Close,
  Fold,
  MagicStick,
  MoreFilled,
  Plus,
  Search,
  Setting,
} from '@element-plus/icons-vue'
import {
  Check as LucideCheck,
  FileJson as LucideFileJson,
  FileText as LucideFileText,
  Folder as LucideFolder,
  FolderOpen as LucideFolderOpen,
  Link as LucideLink,
  MoreHorizontal as LucideMoreHorizontal,
  Play as LucidePlay,
  Plus as LucidePlus,
  Save as LucideSave,
  Upload as LucideUpload,
  X as LucideX,
} from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  apiAutomationApi,
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
  type ApiRequestBodyInput,
  type ApiRequestConfigInput,
  type ApiRunHistoryDetail,
  type ApiRunHistoryItem,
  type ApiRunResult,
  type ApiRunStepResult,
  type SaveApiDefinitionCasePayload,
  type SaveApiDefinitionPayload,
} from '@/entities/api-automation'
import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'
import type { WorkspaceItem } from '@/entities/workspace'
import ApiCaseCreateEditDialog from '@/features/api-case-create-edit/ApiCaseCreateEditDialog.vue'
import { getRequestErrorMessage } from '@/shared/api/error'
import ApiCodeEditor from './ApiCodeEditor.vue'
import ApiCaseDetailDrawer from './ApiCaseDetailDrawer.vue'
import ApiFastExtractionDrawer from './ApiFastExtractionDrawer.vue'
import type { FastExtractionConfig, FastExtractionMode, FastExtractionResponseFormat } from './fastExtraction'

type RequestContentTab = 'headers' | 'body' | 'params' | 'cookies' | 'auth' | 'pre' | 'post' | 'extractors' | 'tests' | 'settings' | 'cases'
type ResponseTab = 'body' | 'header' | 'console' | 'actualRequest' | 'assertions'
type DirectoryNodeType = 'root' | 'workspace' | 'module' | 'request' | 'unassigned'
type BodyType = 'NONE' | 'FORM_DATA' | 'FORM_URLENCODED' | 'RAW_JSON' | 'RAW_XML' | 'RAW_TEXT' | 'BINARY'
type BatchAddTarget = 'query' | 'header' | 'cookie' | 'body-form' | 'assertion' | 'extractor'
type ApiCaseDialogMode = 'create' | 'edit'
type ApiCaseDrawerTab = 'detail' | 'history' | 'changes'
type ApiCaseDetailRequestTab = 'headers' | 'body' | 'params' | 'auth' | 'pre' | 'post' | 'tests' | 'settings'
type ApiCaseHistoryView = 'list' | 'detail'
type ApiCaseHistoryResponseTab = Exclude<ResponseTab, 'actualRequest'>
type ApiAiCaseGenerationStatus = 'idle' | 'running' | 'done' | 'failed'
type ApiAiGeneratedCaseStatus = 'pending' | 'accepted' | 'discarded' | 'failed'
type ApiAiCaseResultFilter = 'all' | 'pending' | 'accepted' | 'discarded'
type ApiImportMode = 'swagger' | 'postman' | 'har'
type ApiImportInputMode = 'url' | 'file'
type ApiSoftPromptInputType = 'text' | 'textarea'
type RawBodyType = Extract<BodyType, 'RAW_JSON' | 'RAW_XML' | 'RAW_TEXT'>
type ApiBodyLanguage = 'json' | 'xml' | 'text'
type FastExtractionTarget =
  | { kind: 'assertionBody', assertion: ApiAssertionConfig, item: ApiAssertionItemConfig }
  | { kind: 'processorExtract', processor: ApiProcessorConfig, item: ApiProcessorExtractItem }

const CASE_RUN_HISTORY_LIMIT = 10
const CASE_RUN_HISTORY_TABLE_HEADER_HEIGHT = 40
const CASE_RUN_HISTORY_TABLE_ROW_HEIGHT = 54
const apiMethodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH', 'TRACE'] as const
const rawBodyTypes: RawBodyType[] = ['RAW_JSON', 'RAW_XML', 'RAW_TEXT']

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
  dataSourceId?: string | number | null
  dataSourceName?: string | null
  queryTimeout?: number | null
  variableNames?: string | null
  resultVariable?: string | null
  extractParams?: ApiProcessorSqlExtractParam[]
  delayMs?: number | null
  expression?: string | null
  variableName?: string | null
  sourceType?: string | null
  extractType?: string | null
  description?: string | null
  extractors?: ApiProcessorExtractItem[]
}

interface ApiProcessorSqlExtractParam {
  key?: string | null
  value?: string | null
  enabled?: boolean
}

interface ApiProcessorExtractItem {
  id?: string
  enabled?: boolean
  name?: string | null
  variableName?: string | null
  description?: string | null
  variableType?: string | null
  sourceType?: string | null
  extractScope?: string | null
  extractType?: string | null
  expression?: string | null
  expressionMatchingRule?: string | null
  resultMatchingRule?: string | null
  resultMatchingRuleNum?: number | null
  responseFormat?: string | null
}

interface ApiSoftPromptOptions {
  title: string
  message?: string
  value?: string
  placeholder?: string
  inputType?: ApiSoftPromptInputType
  requiredMessage?: string
  confirmText?: string
  cancelText?: string
}

interface DirectoryNode {
  key: string
  type: DirectoryNodeType
  label: string
  count: number
  moduleId: number | null
  workspaceCode: string
  definitionId: number | null
  fullPath?: string | null
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
  workspaces?: WorkspaceItem[]
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
const activeProcessorId = ref('')
const activeAssertionId = ref('')
const importDialogVisible = ref(false)
const importMode = ref<ApiImportMode>('swagger')
const importInputMode = ref<ApiImportInputMode>('url')
const importUrl = ref('')
const importFileName = ref('')
const softPromptVisible = ref(false)
const softPromptTitle = ref('')
const softPromptMessage = ref('')
const softPromptValue = ref('')
const softPromptPlaceholder = ref('')
const softPromptInputType = ref<ApiSoftPromptInputType>('text')
const softPromptRequiredMessage = ref('请输入内容')
const softPromptConfirmText = ref('确定')
const softPromptCancelText = ref('取消')
const softPromptError = ref('')
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
const caseDetailRequestTab = ref<ApiCaseDetailRequestTab>('headers')
const caseDetailResponseTab = ref<ResponseTab>('body')
const caseHistoryView = ref<ApiCaseHistoryView>('list')
const caseHistoryRequestTab = ref<'header' | 'body'>('header')
const caseHistoryResponseTab = ref<ApiCaseHistoryResponseTab>('body')
const caseListCurrentPage = ref(1)
const caseListPageSize = ref(10)
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
const fastExtractionVisible = ref(false)
const fastExtractionTarget = ref<FastExtractionTarget | null>(null)
const processorExtractMoreSettingsVisibleKey = ref<string | null>(null)
const responsePanelHeight = ref(360)
const responsePanelMinHeight = 300
const responsePanelMaxHeight = 520
const responsePanelHeightStorageKey = 'api-interface-response-panel-height'
let responseResizeStartY = 0
let responseResizeStartHeight = 0
let softPromptResolve: ((value: string | null) => void) | null = null

const bodyModes: Array<{ label: string; value: BodyType }> = [
  { label: 'none', value: 'NONE' },
  { label: 'form-data', value: 'FORM_DATA' },
  { label: 'x-www-form-urlencoded', value: 'FORM_URLENCODED' },
  { label: 'json', value: 'RAW_JSON' },
  { label: 'xml', value: 'RAW_XML' },
  { label: 'raw', value: 'RAW_TEXT' },
  { label: 'binary', value: 'BINARY' },
]

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

const importCapabilityItems: Array<{
  mode: ApiImportMode
  name: string
  description: string
  status: string
  accept: string
  icon: Component
  tone: 'green' | 'orange' | 'purple' | 'blue'
}> = [
  {
    mode: 'swagger',
    name: 'Swagger / OpenAPI',
    description: '支持 Swagger 2.0 / OpenAPI 3.x',
    status: '待后端接口',
    accept: '.json,.yaml,.yml',
    icon: LucideLink,
    tone: 'green',
  },
  {
    mode: 'postman',
    name: 'Postman Collection',
    description: '支持 Postman v2.0 / v2.1 格式',
    status: '待后端接口',
    accept: '.json',
    icon: LucideFileJson,
    tone: 'orange',
  },
  {
    mode: 'har',
    name: 'HAR 文件',
    description: '浏览器导出的 HTTP 存档文件',
    status: '待后端接口',
    accept: '.har',
    icon: LucideFileText,
    tone: 'purple',
  },
]

const selectedImportCapability = computed(() => (
  importCapabilityItems.find(item => item.mode === importMode.value) || importCapabilityItems[0]
))

function openApiSoftPrompt(options: ApiSoftPromptOptions) {
  if (softPromptResolve) {
    softPromptResolve(null)
  }
  softPromptTitle.value = options.title
  softPromptMessage.value = options.message || ''
  softPromptValue.value = options.value || ''
  softPromptPlaceholder.value = options.placeholder || ''
  softPromptInputType.value = options.inputType || 'text'
  softPromptRequiredMessage.value = options.requiredMessage || '请输入内容'
  softPromptConfirmText.value = options.confirmText || '确定'
  softPromptCancelText.value = options.cancelText || '取消'
  softPromptError.value = ''
  softPromptVisible.value = true

  return new Promise<string | null>((resolve) => {
    softPromptResolve = resolve
    void nextTick(() => {
      const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('.api-soft-dialog input, .api-soft-dialog textarea')
      input?.focus()
      input?.select()
    })
  })
}

function confirmApiSoftPrompt() {
  const value = softPromptValue.value.trim()
  if (!value) {
    softPromptError.value = softPromptRequiredMessage.value
    return
  }
  softPromptResolve?.(value)
  softPromptResolve = null
  softPromptVisible.value = false
}

function cancelApiSoftPrompt() {
  softPromptResolve?.(null)
  softPromptResolve = null
  softPromptVisible.value = false
}

function confirmApiAction(
  message: string,
  title: string,
  options: { confirmText?: string; cancelText?: string; danger?: boolean } = {},
) {
  return ElMessageBox.confirm(message, title, {
    type: options.danger ? 'error' : 'warning',
    confirmButtonText: options.confirmText || '确定',
    cancelButtonText: options.cancelText || '取消',
    customClass: `api-soft-message-box${options.danger ? ' is-danger' : ''}`,
    confirmButtonClass: options.danger ? 'api-soft-message-box__danger' : 'api-soft-message-box__primary',
    cancelButtonClass: 'api-soft-message-box__cancel',
  }).then(
    () => true,
    () => false,
  )
}

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
  { label: '长度等于', value: 'LENGTH_EQUALS' },
  { label: '长度不等于', value: 'LENGTH_NOT_EQUALS' },
  { label: '长度大于', value: 'LENGTH_GT' },
  { label: '长度大于等于', value: 'LENGTH_GT_OR_EQUALS' },
  { label: '长度小于', value: 'LENGTH_LT' },
  { label: '长度小于等于', value: 'LENGTH_LT_OR_EQUALS' },
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

const processorExtractTypeOptions = extractorExpressionTypeOptions.filter(item => item.value !== 'HEADER')

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

function extractionResultNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function pickPreferredRunStep(steps: ApiRunStepResult[]) {
  if (!steps.length) {
    return null
  }
  return steps.find(item => !item.success) ?? steps[steps.length - 1]
}

function appendProcessorConsoleLines(lines: string[], rows: unknown[]) {
  rows.forEach((row, index) => {
    const name = extractionResultText(extractionResultValue(row, 'name') ?? extractionResultValue(row, 'processorName') ?? `Processor ${index + 1}`)
    const stage = extractionResultText(extractionResultValue(row, 'stage') ?? extractionResultValue(row, 'processorStage'))
    const success = extractionResultValue(row, 'success')
    const duration = extractionResultNumber(extractionResultValue(row, 'durationMs'))
    const message = extractionResultText(extractionResultValue(row, 'message') ?? extractionResultValue(row, 'errorMessage') ?? extractionResultValue(row, 'result'))
    lines.push(`[Processor ${index + 1}] ${stage !== '-' ? `${stage} / ` : ''}${name} / ${success === false ? 'FAIL' : 'PASS'}${duration !== null ? ` / ${duration} ms` : ''}`)
    if (message !== '-') {
      lines.push(`  ${message}`)
    }
    const outputVariables = extractionResultValue(row, 'outputVariables')
    if (outputVariables && typeof outputVariables === 'object' && Object.keys(outputVariables).length) {
      lines.push(`  outputVariables: ${JSON.stringify(outputVariables)}`)
    }
    const logs = extractionResultValue(row, 'logs')
    if (Array.isArray(logs)) {
      logs.forEach(log => lines.push(`  ${String(log)}`))
    }
  })
}

function appendAssertionConsoleLines(lines: string[], rows: ApiRunStepResult['assertionResults']) {
  rows.forEach((item, index) => {
    lines.push(`[Assertion ${index + 1}] ${(item.name || item.type)} / ${item.success ? 'PASS' : 'FAIL'}`)
    if (item.message) {
      lines.push(`  ${item.message}`)
    }
    if (item.expectedValue !== undefined || item.actualValue !== undefined) {
      lines.push(`  expected: ${item.expectedValue ?? ''}`)
      lines.push(`  actual: ${item.actualValue ?? ''}`)
    }
  })
}

function appendExtractionConsoleLines(lines: string[], rows: unknown[]) {
  rows.forEach((row, index) => {
    const name = extractionResultText(extractionResultValue(row, 'name') ?? extractionResultValue(row, 'variableName') ?? `Extraction ${index + 1}`)
    const success = extractionResultValue(row, 'success')
    const value = extractionResultText(extractionResultValue(row, 'value') ?? extractionResultValue(row, 'actualValue'))
    const message = extractionResultText(extractionResultValue(row, 'message') ?? extractionResultValue(row, 'errorMessage'))
    lines.push(`[Extraction ${index + 1}] ${name} / ${success === false ? 'FAIL' : 'OK'}`)
    lines.push(`  ${value !== '-' ? value : message}`)
  })
}

function buildRunConsolePreview(
  debugError: string,
  processorResults: unknown[],
  assertionResults: ApiRunStepResult['assertionResults'],
  extractionResults: unknown[],
) {
  const lines: string[] = []
  if (debugError) {
    lines.push(`[Error] ${debugError}`)
  }
  appendProcessorConsoleLines(lines, processorResults)
  appendAssertionConsoleLines(lines, assertionResults)
  appendExtractionConsoleLines(lines, extractionResults)
  return lines.length ? lines.join('\n') : '暂无控制台内容'
}

function requestBodyPreview(config: ApiRequestConfigInput) {
  const body = config.body
  if (body.type === 'NONE') return null
  if (isRawBodyType(body.type)) return getModeBodyText(body) || null
  if (body.type === 'BINARY') {
    return body.fileName
      ? {
          fileName: body.fileName,
          fileSize: body.fileSize ?? null,
          contentType: body.contentType ?? null,
        }
      : null
  }
  const rows = enabledRows(body.formItems)
  if (!rows.length) return null
  return Object.fromEntries(rows.map(row => [row.key, row.fileName || row.value || '']))
}

function actualRequestPreviewFromConfig(config: ApiRequestConfigInput, method?: string | null, path?: string | null) {
  return {
    method: config.method || method || 'GET',
    url: config.path || path || '',
    headers: Object.fromEntries(enabledRows(config.headers).map(row => [row.key, row.value])),
    body: requestBodyPreview(config),
  }
}

function actualRequestPreviewFallback() {
  const detail = activeEditor.value?.detail
  if (!detail) {
    return null
  }
  return actualRequestPreviewFromConfig(detail.requestConfig, detail.method, detail.path)
}

function actualRequestPreview(request: ApiRunStepResult['request']) {
  if (!request) {
    return actualRequestPreviewFallback()
  }
  return {
    method: request.method || 'GET',
    url: request.url || '',
    headers: request.headers ?? {},
    body: request.body ?? null,
  }
}

function runStepDebugError(step: ApiRunStepResult | null, runError?: string | null, failureSummary?: string | null) {
  const explicitError = step?.errorMessage || runError || failureSummary || ''
  if (explicitError) return explicitError
  if (!step || step.success !== false) return ''
  if (step.assertionResults?.some(item => !item.success)) return ''
  if (!step.response) return '请求执行失败，未获取到响应内容'
  if (typeof step.response.statusCode === 'number' && step.response.statusCode >= 400) {
    return `请求返回 HTTP ${step.response.statusCode}`
  }
  return '请求执行失败'
}

function assertionRunResultPresentation(rows: ApiRunStepResult['assertionResults'], errorMessage?: string | null) {
  if (!rows.length) {
    if (errorMessage) {
      return { visible: true, label: '执行失败', tone: 'failed' }
    }
    return { visible: false, label: '', tone: 'empty' }
  }
  if (rows.some(item => !item.success)) {
    return { visible: true, label: '断言失败', tone: 'failed' }
  }
  if (errorMessage) {
    return { visible: true, label: '执行失败', tone: 'failed' }
  }
  return { visible: true, label: '断言通过', tone: 'success' }
}

const processorTypeOptions = [
  { label: '脚本', value: 'SCRIPT' },
  { label: 'SQL', value: 'SQL' },
  { label: '等待', value: 'TIME_WAITING' },
  { label: '提取', value: 'EXTRACT' },
]

function processorTypeOptionsFor(stage: 'pre' | 'post') {
  return stage === 'pre'
    ? processorTypeOptions.filter(item => item.value !== 'EXTRACT')
    : processorTypeOptions
}

const processorExtractVariableTypeOptions = [
  { label: '临时变量', value: 'TEMPORARY' },
  { label: '环境变量', value: 'ENVIRONMENT' },
]

const processorRegexExtractScopeOptions = [
  { label: '响应体', value: 'BODY' },
  { label: '响应头', value: 'RESPONSE_HEADERS' },
  { label: '请求头', value: 'REQUEST_HEADERS' },
  { label: '状态码', value: 'RESPONSE_CODE' },
  { label: '响应消息', value: 'RESPONSE_MESSAGE' },
  { label: 'URL', value: 'URL' },
]

const processorBodyExtractScopeOptions = [
  { label: '响应体', value: 'BODY' },
]

const contentTabs = computed<Array<{ label: string; value: RequestContentTab; count?: number }>>(() => [
  { label: '请求头', value: 'headers' },
  { label: '请求体', value: 'body' },
  { label: 'Params', value: 'params', count: enabledRows(activeEditor.value?.detail.requestConfig.queryParams).length },
  { label: 'Auth', value: 'auth' },
  { label: '前置处理', value: 'pre' },
  { label: '后置处理', value: 'post' },
  { label: '断言', value: 'tests', count: activeEditor.value?.detail.assertions.length || undefined },
  { label: '设置', value: 'settings' },
  { label: '用例', value: 'cases', count: activeDefinitionCases.value.length || undefined },
])

const activeEditor = computed(() => tabs.value.find(item => item.key === activeEditorKey.value) || null)
const activeDetail = computed(() => activeEditor.value?.detail || null)
const activeBodyRawText = computed({
  get: () => activeDetail.value ? getModeBodyText(activeDetail.value.requestConfig.body) : '',
  set: (value: string) => {
    if (!activeDetail.value) return
    setModeBodyText(activeDetail.value.requestConfig.body, value)
    markDirty()
  },
})
const activeBodyLanguage = computed<ApiBodyLanguage>(() => bodyLanguage(activeDetail.value?.requestConfig.body.type))
const activeDefinitionCases = computed(() => {
  const id = activeEditor.value?.definitionId
  return id ? cases.value.filter(item => item.definitionId === id) : []
})
const caseListTotalPages = computed(() => Math.max(1, Math.ceil(activeDefinitionCases.value.length / caseListPageSize.value)))
const pagedDefinitionCases = computed(() => {
  const start = (caseListCurrentPage.value - 1) * caseListPageSize.value
  return activeDefinitionCases.value.slice(start, start + caseListPageSize.value)
})
const caseRunHistoryTableHeight = computed(() => (
  CASE_RUN_HISTORY_TABLE_HEADER_HEIGHT
  + Math.max(caseRunHistories.value.length, 1) * CASE_RUN_HISTORY_TABLE_ROW_HEIGHT
))

watch(
  () => [activeEditor.value?.definitionId, activeDefinitionCases.value.length, caseListPageSize.value] as const,
  () => {
    if (caseListCurrentPage.value > caseListTotalPages.value) {
      caseListCurrentPage.value = caseListTotalPages.value
    }
    if (caseListCurrentPage.value < 1) {
      caseListCurrentPage.value = 1
    }
  },
)

function caseProtocolLabel() {
  const path = activeEditor.value?.detail.requestConfig.path || ''
  return /^https:\/\//i.test(path) ? 'HTTPS' : 'HTTP'
}

function casePriorityLabel(_row?: ApiDefinitionCaseItem) {
  return 'P0'
}

function caseStatusLabel(_row?: ApiDefinitionCaseItem) {
  return '进行中'
}

function formatCaseTags(tags?: string[] | null) {
  return Array.isArray(tags) && tags.length ? tags.join(', ') : '-'
}
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

const currentDefinitionWorkspaceLabel = computed(() => {
  const editor = activeEditor.value
  const targetWorkspaceCode = editor?.detail.workspaceCode || props.workspaceCode
  if (!targetWorkspaceCode) {
    return props.workspaceCode === 'ALL' ? '未选择空间' : '当前空间'
  }

  if (targetWorkspaceCode === 'ALL') return '未选择空间'

  const workspace = (props.workspaces || []).find(item =>
    item.workspaceCode === targetWorkspaceCode || item.code === targetWorkspaceCode,
  )
  const workspaceName = workspace?.workspaceName || workspace?.name
  if (workspaceName) return workspaceName

  const detailWorkspaceName = editor?.detail.workspaceName?.trim()
  if (detailWorkspaceName && detailWorkspaceName !== targetWorkspaceCode && detailWorkspaceName !== 'ALL') {
    return detailWorkspaceName
  }

  return targetWorkspaceCode
})

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
  type MutableNode = DirectoryNode & { childMap?: Map<string, MutableNode> }
  const workspaceCodes: string[] = props.workspaceCode === 'ALL'
    ? Array.from(new Set([
        ...(props.workspaces || [])
          .map(item => item.workspaceCode || item.code || '')
          .filter((code): code is string => Boolean(code) && code !== 'ALL'),
        ...modules.value
          .map(item => item.workspaceCode || '')
          .filter((code): code is string => Boolean(code)),
        ...filteredDefinitions.value
          .map(item => item.workspaceCode || '')
          .filter((code): code is string => Boolean(code)),
      ]))
    : [props.workspaceCode]

  const workspaceNodes: MutableNode[] = workspaceCodes.map((code): MutableNode => {
    const workspace = (props.workspaces || []).find(item => (item.workspaceCode || item.code) === code)
    return {
      key: `workspace:${code}`,
      type: 'workspace' as const,
      label: workspace?.workspaceName || workspace?.name || code,
      count: 0,
      moduleId: null,
      workspaceCode: code,
      definitionId: null,
      fullPath: null,
      children: [],
      childMap: new Map<string, MutableNode>(),
    }
  })
  const workspaceMap = new Map(workspaceNodes.map(item => [item.workspaceCode, item]))
  const unassignedRequestMap = new Map<string, MutableNode[]>()

  const ensureNode = (
    parentChildren: MutableNode[],
    parentMap: Map<string, MutableNode>,
    workspaceCode: string,
    label: string,
    fullPath: string,
    moduleId: number | null,
  ) => {
    let node = parentMap.get(fullPath)
    if (!node) {
      node = {
        key: `module:${workspaceCode}:${fullPath}`,
        type: 'module',
        label,
        count: 0,
        moduleId,
        workspaceCode,
        definitionId: null,
        fullPath,
        children: [],
        childMap: new Map<string, MutableNode>(),
      }
      parentMap.set(fullPath, node)
      parentChildren.push(node)
    }
    if (moduleId != null) {
      node.moduleId = moduleId
    }
    return node
  }

  const flattenModules = (items: ApiDefinitionModuleItem[]) => {
    const result: ApiDefinitionModuleItem[] = []
    const walk = (moduleItems: ApiDefinitionModuleItem[]) => {
      moduleItems.forEach((item) => {
        result.push(item)
        walk(item.children || [])
      })
    }
    walk(items)
    return result
  }

  flattenModules(modules.value).forEach((item) => {
    const workspaceNode = workspaceMap.get(item.workspaceCode)
    if (!workspaceNode) return
    const path = (item.fullPath || item.name || '').trim()
    if (!path) return
    const segments = path.split('/').map(part => part.trim()).filter(Boolean)
    let currentChildren = workspaceNode.children as MutableNode[]
    let currentMap = workspaceNode.childMap ?? new Map<string, MutableNode>()
    let assembled = ''
    segments.forEach((segment, index) => {
      assembled = assembled ? `${assembled}/${segment}` : segment
      const node = ensureNode(
        currentChildren,
        currentMap,
        item.workspaceCode,
        segment,
        assembled,
        index === segments.length - 1 ? item.id : null,
      )
      currentChildren = node.children as MutableNode[]
      currentMap = node.childMap ?? new Map<string, MutableNode>()
    })
  })

  filteredDefinitions.value.forEach((item) => {
    const workspaceNode = workspaceMap.get(item.workspaceCode)
    if (!workspaceNode) return
    const path = (item.directoryName || '').trim()
    const requestNode: MutableNode = {
      key: `request:${item.id}`,
      type: 'request',
      label: item.name,
      count: 0,
      moduleId: null,
      workspaceCode: item.workspaceCode,
      definitionId: item.id,
      fullPath: path || null,
      method: item.method,
      definition: item,
      children: [],
    }

    if (!path) {
      const requests = unassignedRequestMap.get(item.workspaceCode) ?? []
      requests.push(requestNode)
      unassignedRequestMap.set(item.workspaceCode, requests)
      return
    }

    const segments = path.split('/').map(part => part.trim()).filter(Boolean)
    let currentChildren = workspaceNode.children as MutableNode[]
    let currentMap = workspaceNode.childMap ?? new Map<string, MutableNode>()
    let assembled = ''
    segments.forEach((segment) => {
      assembled = assembled ? `${assembled}/${segment}` : segment
      const node = ensureNode(currentChildren, currentMap, item.workspaceCode, segment, assembled, null)
      node.count += 1
      currentChildren = node.children as MutableNode[]
      currentMap = node.childMap ?? new Map<string, MutableNode>()
    })
    workspaceNode.count += 1
    currentChildren.push(requestNode)
  })

  const stripChildMap = (nodes: MutableNode[]): DirectoryNode[] => {
    nodes.sort((left, right) => {
      const leftOrder = left.type === 'request' ? 1 : 0
      const rightOrder = right.type === 'request' ? 1 : 0
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }
      return left.label.localeCompare(right.label, 'zh-CN')
    })
    return nodes.map((node) => ({
      key: node.key,
      type: node.type,
      label: node.label,
      count: node.count,
      moduleId: node.moduleId,
      workspaceCode: node.workspaceCode,
      definitionId: node.definitionId,
      fullPath: node.fullPath,
      method: node.method,
      definition: node.definition,
      children: stripChildMap(node.children as MutableNode[]),
    }))
  }
  const workspaceTrees = workspaceNodes.map((workspaceNode) => {
    const children = stripChildMap(workspaceNode.children as MutableNode[])
    const unassignedRequests = unassignedRequestMap.get(workspaceNode.workspaceCode) ?? []
    if (unassignedRequests.length) {
      children.push({
        key: `definition-unassigned:${workspaceNode.workspaceCode}`,
        type: 'unassigned',
        label: '未规划请求',
        count: unassignedRequests.length,
        moduleId: null,
        workspaceCode: workspaceNode.workspaceCode,
        definitionId: null,
        fullPath: null,
        children: stripChildMap(unassignedRequests),
      })
    }
    return {
      key: workspaceNode.key,
      type: workspaceNode.type,
      label: workspaceNode.label,
      count: workspaceNode.count,
      moduleId: workspaceNode.moduleId,
      workspaceCode: workspaceNode.workspaceCode,
      definitionId: workspaceNode.definitionId,
      fullPath: workspaceNode.fullPath,
      children,
    }
  })

  return [{
    key: 'definition-root',
    type: 'root',
    label: '请求目录',
    count: filteredDefinitions.value.length,
    moduleId: null,
    workspaceCode: props.workspaceCode,
    definitionId: null,
    fullPath: null,
    children: workspaceTrees,
  }]
})

const visibleDirectoryTree = computed<DirectoryNode[]>(() => directoryTree.value[0]?.children ?? [])
const directoryTreeRenderKey = computed(() => `${props.workspaceCode}:${expandedKeys.value.join('|')}`)

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

watch(
  directoryTree,
  (tree) => {
    const available = new Set(collectExpandableDirectoryKeys(tree))
    const nextKeys = expandedKeys.value.filter(key => available.has(key))
    if (!nextKeys.length && tree.length) {
      expandedKeys.value = collectExpandableDirectoryKeys(tree)
      return
    }
    expandedKeys.value = nextKeys
  },
  { immediate: true },
)

const currentStep = computed<ApiRunStepResult | null>(() => pickPreferredRunStep(activeEditor.value?.runResult?.stepResults ?? []))
const caseDetailPreviewStep = computed<ApiRunStepResult | null>(() => pickPreferredRunStep(selectedCaseRunHistoryDetail.value?.stepResults ?? []))
const selectedCaseHistoryStep = computed<ApiRunStepResult | null>(() => pickPreferredRunStep(selectedCaseRunHistoryDetail.value?.stepResults ?? []))
const selectedEnvironment = computed(() => environments.value.find(item => item.id === selectedEnvironmentId.value) || null)
const selectedVariableSet = computed(() => variableSets.value.find(item => item.id === selectedVariableSetId.value) || null)
const currentEnvironmentName = computed(() => selectedEnvironment.value?.name || '未选择环境')
const currentVariableSetName = computed(() => selectedVariableSet.value?.name || '未选择变量集')
const responseStatus = computed(() => currentStep.value?.response?.statusCode ?? null)
const responseDuration = computed(() => currentStep.value?.durationMs ?? null)
const responseBody = computed(() => currentStep.value?.response?.body ?? '')
const responseBodyPretty = computed(() => {
  if (!responseBody.value) {
    return ''
  }
  return toPrettyJson(responseBody.value)
})
const responseBodyLanguage = computed<'json' | 'xml' | 'text'>(() =>
  inferResponseBodyLanguage(currentStep.value?.response?.contentType, responseBody.value),
)
const responseHeaders = computed(() => JSON.stringify(currentStep.value?.response?.headers ?? {}, null, 2))
const actualRequest = computed(() => JSON.stringify(actualRequestPreview(currentStep.value?.request ?? null), null, 2))
const responseDebugError = computed(() =>
  runStepDebugError(currentStep.value, activeEditor.value?.runError, activeEditor.value?.runResult?.failureSummary),
)
const responseConsole = computed(() => buildRunConsolePreview(
  responseDebugError.value,
  currentStep.value?.processorResults ?? [],
  currentStep.value?.assertionResults ?? [],
  currentStep.value?.extractionResults ?? [],
))
const assertionRows = computed(() => currentStep.value?.assertionResults ?? [])
const responseAssertionPresentation = computed(() =>
  assertionRunResultPresentation(assertionRows.value, responseDebugError.value),
)
const caseDetailBodyRawText = computed(() => viewingCaseDetail.value ? getModeBodyText(viewingCaseDetail.value.requestConfig.body) : '')
const caseDetailBodyLanguage = computed<ApiBodyLanguage>(() => bodyLanguage(viewingCaseDetail.value?.requestConfig.body.type))
const caseDetailResponseStatus = computed(() => caseDetailPreviewStep.value?.response?.statusCode ?? null)
const caseDetailResponseDuration = computed(() => caseDetailPreviewStep.value?.durationMs ?? null)
const caseDetailResponseBody = computed(() => toPrettyJson(caseDetailPreviewStep.value?.response?.body || caseDetailPreviewStep.value?.errorMessage || ''))
const caseDetailResponseBodyLanguage = computed<'json' | 'xml' | 'text'>(() =>
  inferResponseBodyLanguage(caseDetailPreviewStep.value?.response?.contentType, String(caseDetailPreviewStep.value?.response?.body || '')),
)
const caseDetailResponseHeaders = computed(() => JSON.stringify(caseDetailPreviewStep.value?.response?.headers ?? {}, null, 2))
const caseDetailResponseDebugError = computed(() => runStepDebugError(caseDetailPreviewStep.value))
const caseDetailResponseConsole = computed(() => buildRunConsolePreview(
  caseDetailResponseDebugError.value,
  caseDetailPreviewStep.value?.processorResults ?? [],
  caseDetailPreviewStep.value?.assertionResults ?? [],
  caseDetailPreviewStep.value?.extractionResults ?? [],
))
const caseDetailAssertionRows = computed(() => caseDetailPreviewStep.value?.assertionResults ?? [])
const caseDetailAssertionPresentation = computed(() =>
  assertionRunResultPresentation(caseDetailAssertionRows.value, caseDetailResponseDebugError.value),
)
const caseDetailResponseSize = computed(() => formatResponseSize(caseDetailPreviewStep.value?.response?.body ? new Blob([caseDetailPreviewStep.value.response.body]).size : 0))
const caseDetailActualRequest = computed(() => {
  if (caseDetailPreviewStep.value?.request) {
    return JSON.stringify(actualRequestPreview(caseDetailPreviewStep.value.request), null, 2)
  }
  if (!viewingCaseDetail.value) {
    return '-'
  }
  return JSON.stringify(actualRequestPreviewFromConfig(viewingCaseDetail.value.requestConfig, viewingCaseDetail.value.method, viewingCaseDetail.value.path), null, 2)
})
const caseHistoryRequestHeaders = computed(() => JSON.stringify(selectedCaseHistoryStep.value?.request?.headers ?? {}, null, 2))
const caseHistoryRequestBody = computed(() => {
  const request = selectedCaseHistoryStep.value?.request
  if (!request) return '-'
  return toPrettyJson({
    queryParams: request.queryParams ?? [],
    cookies: request.cookies ?? [],
    bodyType: request.bodyType ?? null,
    bodyContentType: request.bodyContentType ?? null,
    bodyFormItems: request.bodyFormItems ?? [],
    bodyFileName: request.bodyFileName ?? null,
    bodyFileContentType: request.bodyFileContentType ?? null,
    body: request.body ?? null,
  })
})
const caseHistoryRequestBodyLanguage = computed<'json' | 'xml' | 'text'>(() =>
  inferResponseBodyLanguage(selectedCaseHistoryStep.value?.request?.bodyFileContentType, String(selectedCaseHistoryStep.value?.request?.body || '')),
)
const caseHistoryResponseBody = computed(() => toPrettyJson(selectedCaseHistoryStep.value?.response?.body || selectedCaseHistoryStep.value?.errorMessage || ''))
const caseHistoryResponseBodyLanguage = computed<'json' | 'xml' | 'text'>(() =>
  inferResponseBodyLanguage(selectedCaseHistoryStep.value?.response?.contentType, String(selectedCaseHistoryStep.value?.response?.body || '')),
)
const caseHistoryResponseHeaders = computed(() => JSON.stringify(selectedCaseHistoryStep.value?.response?.headers ?? {}, null, 2))
const caseHistoryDebugError = computed(() => runStepDebugError(selectedCaseHistoryStep.value, null, selectedCaseRunHistoryDetail.value?.failureSummary))
const caseHistoryConsole = computed(() => buildRunConsolePreview(
  caseHistoryDebugError.value,
  selectedCaseHistoryStep.value?.processorResults ?? [],
  selectedCaseHistoryStep.value?.assertionResults ?? [],
  selectedCaseHistoryStep.value?.extractionResults ?? [],
))
const caseHistoryAssertionRows = computed(() => selectedCaseHistoryStep.value?.assertionResults ?? [])
const responseSize = computed(() => {
  const text = responseBody.value || ''
  if (!text) {
    return '0 B'
  }
  const bytes = new Blob([text]).size
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`
})
const showResponseEmpty = computed(() => !currentStep.value && !activeEditor.value?.runError)
const shouldShowResponsePanel = computed(() => activeEditor.value?.activeTab !== 'cases')
const latestResponseBody = computed(() => String(currentStep.value?.response?.body || ''))
const hasLatestResponseBody = computed(() => Boolean(latestResponseBody.value.trim()))
const fastExtractionTitle = computed(() => (hasLatestResponseBody.value ? '从最近响应快速提取' : '请先发送请求，再使用快速提取'))
const fastExtractionMode = computed<FastExtractionMode>(() => {
  const target = fastExtractionTarget.value
  if (!target) return 'JSON_PATH'
  if (target.kind === 'assertionBody') return normalizeFastExtractionMode(target.assertion.assertionBodyType || target.assertion.expressionType)
  return normalizeFastExtractionMode(target.item.extractType)
})
const fastExtractionConfig = computed<FastExtractionConfig>(() => {
  const target = fastExtractionTarget.value
  if (!target) return { extractType: 'JSON_PATH', expression: '$' }
  if (target.kind === 'assertionBody') {
    return {
      extractType: normalizeFastExtractionMode(target.assertion.assertionBodyType || target.assertion.expressionType),
      expression: target.item.expression || target.assertion.expression || '',
      responseFormat: normalizeFastExtractionResponseFormat(activeAssertionBodyGroup(target.assertion).responseFormat),
    }
  }
  return {
    extractType: normalizeFastExtractionMode(target.item.extractType),
    expression: target.item.expression || '',
    responseFormat: 'JSON',
  }
})
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
const batchAddExamples = computed(() => {
  if (batchAddTarget.value === 'extractor') {
    return ['token=$.data.token', 'traceId: X-Trace-Id', 'userId\t$.data.user.id']
  }
  if (batchAddTarget.value === 'assertion') {
    return ['状态码=200', '响应包含: success', 'traceId\t不为空']
  }
  return ['token=abc', 'Content-Type: application/json', 'page\t1']
})

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
      jsonText: '',
      xmlText: '',
      plainText: '',
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

function setRowsEnabled(rows: ApiKeyValueInput[], checked: unknown) {
  rows.forEach(row => {
    row.enabled = Boolean(checked)
  })
  markDirty()
}

function markDirty() {
  if (activeEditor.value) {
    activeEditor.value.dirty = true
    activeEditor.value.method = activeEditor.value.detail.requestConfig.method
    activeEditor.value.title = editorTitle(activeEditor.value.detail)
  }
}

function isRawBodyType(type?: string | null): type is RawBodyType {
  return rawBodyTypes.includes(type as RawBodyType)
}

function bodyLanguage(type?: string | null): ApiBodyLanguage {
  if (type === 'RAW_JSON') return 'json'
  if (type === 'RAW_XML') return 'xml'
  return 'text'
}

function getModeBodyText(body: ApiRequestBodyInput) {
  if (body.type === 'RAW_JSON') return body.jsonText ?? body.rawText ?? ''
  if (body.type === 'RAW_XML') return body.xmlText ?? body.rawText ?? ''
  if (body.type === 'RAW_TEXT') return body.plainText ?? body.rawText ?? ''
  return body.rawText ?? ''
}

function setModeBodyText(body: ApiRequestBodyInput, value: string, type = body.type) {
  if (type === 'RAW_JSON') {
    body.jsonText = value
  } else if (type === 'RAW_XML') {
    body.xmlText = value
  } else if (type === 'RAW_TEXT') {
    body.plainText = value
  }
  body.rawText = value
}

function hydrateBodyModeText(body: ApiRequestBodyInput) {
  const rawText = body.rawText ?? ''
  body.jsonText = body.type === 'RAW_JSON' ? rawText : (body.jsonText ?? '')
  body.xmlText = body.type === 'RAW_XML' ? rawText : (body.xmlText ?? '')
  body.plainText = body.type === 'RAW_TEXT' ? rawText : (body.plainText ?? '')
}

function syncRequestBodyRawText(requestConfig: ApiRequestConfigInput) {
  if (isRawBodyType(requestConfig.body.type)) {
    setModeBodyText(requestConfig.body, getModeBodyText(requestConfig.body), requestConfig.body.type)
  }
}

function payloadRequestConfig(detail: ApiDefinitionDetail): ApiRequestConfigInput {
  syncRequestBodyRawText(detail.requestConfig)
  const requestConfig = clone({
    ...detail.requestConfig,
    method: detail.requestConfig.method || 'GET',
    path: detail.requestConfig.path || '',
    timeoutMs: Number(detail.requestConfig.timeoutMs || 10000),
  })
  delete requestConfig.body.jsonText
  delete requestConfig.body.xmlText
  delete requestConfig.body.plainText
  return requestConfig
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

function inferResponseBodyLanguage(contentType?: string | null, bodyText = ''): 'json' | 'xml' | 'text' {
  const normalizedContentType = String(contentType || '').toLowerCase()
  const text = bodyText.trim()
  if (normalizedContentType.includes('json')) return 'json'
  if (normalizedContentType.includes('xml') || normalizedContentType.includes('html')) return 'xml'
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      JSON.parse(text)
      return 'json'
    } catch {
      return 'text'
    }
  }
  if (text.startsWith('<') && text.endsWith('>')) return 'xml'
  return 'text'
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

function hasBodyContent(body: ApiDefinitionDetail['requestConfig']['body']) {
  if (body.type === 'NONE') return false
  if (['FORM_DATA', 'FORM_URLENCODED'].includes(body.type)) return body.formItems.some(row => row.key || row.value || row.fileName)
  if (body.type === 'BINARY') return Boolean(body.fileName)
  return Boolean(body.rawText || body.jsonText || body.xmlText || body.plainText)
}

function pickCaseDetailDefaultRequestTab(detail: ApiDefinitionCaseDetail): ApiCaseDetailRequestTab {
  if (detail.requestConfig.queryParams.some(row => row.key || row.value)) return 'params'
  if (hasBodyContent(detail.requestConfig.body)) return 'body'
  if (detail.requestConfig.headers.some(row => row.key || row.value)) return 'headers'
  if (detail.requestConfig.authConfig.authType !== 'NONE') return 'auth'
  return 'params'
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

function activeProcessorRows() {
  if (!activeEditor.value) return []
  const stage = activeEditor.value.activeTab === 'pre' ? 'pre' : 'post'
  return processorRowsFor(activeEditor.value.detail, stage)
}

function activeProcessorStage(): 'pre' | 'post' {
  return activeEditor.value?.activeTab === 'pre' ? 'pre' : 'post'
}

const activeProcessor = computed(() => {
  const rows = activeProcessorRows()
  if (!rows.length) return null
  return rows.find(item => item.id === activeProcessorId.value) || rows[0]
})

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
    processor.dataSourceId = processor.dataSourceId ?? null
    processor.dataSourceName = processor.dataSourceName ?? ''
    processor.queryTimeout = processor.queryTimeout || 30000
    processor.variableNames = processor.variableNames ?? ''
    processor.resultVariable = processor.resultVariable ?? ''
    processor.extractParams = normalizeSqlExtractParams(processor.extractParams)
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

function updateAssertionResponseTime(assertion: ApiAssertionConfig | null, value: number | undefined) {
  if (!assertion) return
  assertion.expectedValue = String(value || 1000)
  assertion.condition = 'LT_OR_EQUALS'
  assertion.operator = 'LT_OR_EQUALS'
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

function normalizeFastExtractionMode(type?: string | null): FastExtractionMode {
  if (type === 'X_PATH' || type === 'REGEX') return type
  return 'JSON_PATH'
}

function normalizeFastExtractionResponseFormat(format?: string | null): FastExtractionResponseFormat {
  if (format === 'XML' || format === 'HTML') return format
  return 'JSON'
}

function openAssertionFastExtraction(assertion: ApiAssertionConfig, item: ApiAssertionItemConfig) {
  if (!hasLatestResponseBody.value) return
  fastExtractionTarget.value = { kind: 'assertionBody', assertion, item }
  fastExtractionVisible.value = true
}

function openProcessorFastExtraction(processor: ApiProcessorConfig, item: ApiProcessorExtractItem) {
  if (!hasLatestResponseBody.value) return
  fastExtractionTarget.value = { kind: 'processorExtract', processor, item }
  fastExtractionVisible.value = true
}

function applyFastExtraction(config: FastExtractionConfig, matchResult: string[]) {
  const target = fastExtractionTarget.value
  if (!target) return
  const expression = config.expression || ''
  if (target.kind === 'assertionBody') {
    target.assertion.assertionType = 'RESPONSE_BODY'
    target.assertion.type = 'RESPONSE_BODY'
    target.assertion.assertionBodyType = config.extractType || 'JSON_PATH'
    target.assertion.expressionType = target.assertion.assertionBodyType
    const group = activeAssertionBodyGroup(target.assertion)
    if (config.responseFormat) group.responseFormat = config.responseFormat
    target.item.expression = expression
    target.assertion.expression = expression
    if (matchResult[0] !== undefined) {
      target.item.expectedValue = matchResult[0]
      target.assertion.expectedValue = matchResult[0]
    }
  } else {
    target.item.extractType = config.extractType || 'JSON_PATH'
    target.item.expression = expression
    syncProcessorScript(target.processor)
  }
  markDirty()
  ElMessage.success('已回填快速提取表达式')
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
  if (Number.isFinite(savedHeight) && savedHeight >= responsePanelMinHeight) {
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
    dataSourceId: type === 'SQL' ? null : null,
    dataSourceName: type === 'SQL' ? '' : null,
    queryTimeout: type === 'SQL' ? 30000 : null,
    variableNames: type === 'SQL' ? '' : null,
    resultVariable: type === 'SQL' ? '' : null,
    extractParams: type === 'SQL' ? [] : [],
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
    extractScope: 'BODY',
    extractType: 'JSON_PATH',
    expression: '',
    expressionMatchingRule: 'EXPRESSION',
    resultMatchingRule: 'RANDOM',
    resultMatchingRuleNum: 1,
    responseFormat: 'JSON',
    ...patch,
  }
}

function processorExtractScopeFromSource(source?: string | null) {
  if (source === 'RESPONSE_HEADER') return 'RESPONSE_HEADERS'
  if (source === 'REQUEST_HEADER') return 'REQUEST_HEADERS'
  if (source === 'STATUS_CODE') return 'RESPONSE_CODE'
  if (source === 'URL') return 'URL'
  return 'BODY'
}

function processorSourceFromExtractScope(scope?: string | null) {
  if (scope === 'RESPONSE_HEADERS') return 'RESPONSE_HEADER'
  if (scope === 'REQUEST_HEADERS') return 'REQUEST_HEADER'
  if (scope === 'RESPONSE_CODE') return 'STATUS_CODE'
  if (scope === 'URL') return 'URL'
  return 'RESPONSE_BODY'
}

function processorExtractScopeOptions(item: ApiProcessorExtractItem) {
  return item.extractType === 'REGEX' ? processorRegexExtractScopeOptions : processorBodyExtractScopeOptions
}

function showProcessorExtractRegexSettings(item: ApiProcessorExtractItem) {
  return item.extractType === 'REGEX'
}

function showProcessorExtractXPathSettings(item: ApiProcessorExtractItem) {
  return item.extractType === 'X_PATH'
}

function showProcessorExtractSpecificIndex(item: ApiProcessorExtractItem) {
  return (item.resultMatchingRule || 'RANDOM') === 'SPECIFIC'
}

function normalizeProcessorExtractByType(item: ApiProcessorExtractItem) {
  const scopeOptions = processorExtractScopeOptions(item)
  if (!scopeOptions.some(option => option.value === item.extractScope)) {
    item.extractScope = 'BODY'
  }
  item.sourceType = processorSourceFromExtractScope(item.extractScope)
  if (item.extractType !== 'REGEX') {
    item.expressionMatchingRule = 'EXPRESSION'
  }
  if (item.extractType === 'JSON_PATH') {
    item.responseFormat = 'JSON'
  } else if (item.extractType === 'X_PATH') {
    item.responseFormat = item.responseFormat === 'HTML' ? 'HTML' : 'XML'
  } else {
    item.responseFormat = item.responseFormat || 'JSON'
  }
}

function processorExtractExpressionPlaceholder(item: ApiProcessorExtractItem) {
  if (item.extractType === 'X_PATH') return '例如 /response/data/token'
  if (item.extractType === 'REGEX') return '例如 "token":"([^"]+)"'
  return '例如 $.data.token'
}

function handleProcessorExtractTypeChange(processor: ApiProcessorConfig, item: ApiProcessorExtractItem) {
  normalizeProcessorExtractByType(item)
  syncProcessorScript(processor)
}

function handleProcessorExtractScopeChange(processor: ApiProcessorConfig, item: ApiProcessorExtractItem) {
  item.sourceType = processorSourceFromExtractScope(item.extractScope)
  syncProcessorScript(processor)
}

function setProcessorExtractMoreSettingsVisible(processorId: string | undefined, index: number, visible: boolean) {
  processorExtractMoreSettingsVisibleKey.value = visible && processorId ? `${processorId}-${index}` : null
}

function normalizeProcessorExtractItem(item: ApiProcessorExtractItem): ApiProcessorExtractItem {
  item.id = item.id || `extract-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  item.enabled = item.enabled !== false
  item.name = item.name ?? ''
  item.variableName = item.variableName ?? ''
  item.description = item.description ?? ''
  item.variableType = item.variableType || 'TEMPORARY'
  item.sourceType = item.sourceType || 'RESPONSE_BODY'
  item.extractScope = item.extractScope || processorExtractScopeFromSource(item.sourceType)
  item.extractType = item.extractType || 'JSON_PATH'
  item.expression = item.expression ?? ''
  item.expressionMatchingRule = item.expressionMatchingRule || 'EXPRESSION'
  item.resultMatchingRule = item.resultMatchingRule || 'RANDOM'
  item.resultMatchingRuleNum = item.resultMatchingRuleNum || 1
  item.responseFormat = item.responseFormat || (item.extractType === 'X_PATH' ? 'XML' : 'JSON')
  normalizeProcessorExtractByType(item)
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

function normalizeSqlExtractParams(items: ApiProcessorSqlExtractParam[] | undefined) {
  const rows = Array.isArray(items) ? items : []
  rows.forEach(row => {
    row.key = row.key ?? ''
    row.value = row.value ?? ''
    row.enabled = row.enabled !== false
  })
  return rows
}

function addSqlExtractParam(processor: ApiProcessorConfig) {
  processor.extractParams = normalizeSqlExtractParams(processor.extractParams)
  processor.extractParams.push({ key: '', value: '', enabled: true })
  syncProcessorScript(processor)
}

function removeSqlExtractParam(processor: ApiProcessorConfig, index: number) {
  const rows = normalizeSqlExtractParams(processor.extractParams)
  rows.splice(index, 1)
  processor.extractParams = rows
  syncProcessorScript(processor)
}

function processorDefaultName(stage: 'pre' | 'post', type?: string) {
  if (type === 'SCRIPT') return stage === 'pre' ? '前置脚本' : '后置脚本'
  if (type === 'SQL') return 'SQL 处理器'
  if (type === 'TIME_WAITING') return '等待处理器'
  if (type === 'EXTRACT') return '提取处理器'
  return stage === 'pre' ? '前置处理器' : '后置处理器'
}

function processorTypeLabel(type?: string | null) {
  if (type === 'SCRIPT') return '脚本处理器'
  if (type === 'SQL') return 'SQL 处理器'
  if (type === 'TIME_WAITING') return '等待处理器'
  if (type === 'EXTRACT') return '提取处理器'
  return type || '处理器'
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
    processor.dataSourceId = processor.dataSourceId ?? null
    processor.dataSourceName = processor.dataSourceName ?? ''
    processor.queryTimeout = processor.queryTimeout || 30000
    processor.variableNames = processor.variableNames ?? ''
    processor.resultVariable = processor.resultVariable ?? ''
    processor.extractParams = normalizeSqlExtractParams(processor.extractParams)
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
  const processor = createProcessor(stage, type)
  processorRowsFor(activeEditor.value.detail, stage).push(processor)
  activeProcessorId.value = processor.id || ''
  markDirty()
}

function addProcessorFromCommand(stage: 'pre' | 'post', command: string | number | object) {
  const type = String(command)
  if (stage === 'pre' && type === 'EXTRACT') {
    return
  }
  addProcessor(stage, type)
}

function removeProcessor(stage: 'pre' | 'post', index: number) {
  if (!activeEditor.value) return
  const rows = processorRowsFor(activeEditor.value.detail, stage)
  const removed = rows.splice(index, 1)
  if (removed.some(item => item.id === activeProcessorId.value)) {
    activeProcessorId.value = rows[Math.min(index, rows.length - 1)]?.id || ''
  }
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
  activeProcessorId.value = copied.id || ''
  markDirty()
}

function moveProcessor(stage: 'pre' | 'post', index: number, direction: -1 | 1) {
  if (!activeEditor.value) return
  const rows = processorRowsFor(activeEditor.value.detail, stage)
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(targetIndex, 0, row)
  activeProcessorId.value = row.id || ''
  markDirty()
}

function selectProcessor(processor: ApiProcessorConfig) {
  activeProcessorId.value = processor.id || ''
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
    requestConfig: payloadRequestConfig(detail),
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

function currentRunPayload() {
  return {
    workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
    environmentId: selectedEnvironmentId.value || null,
    variableSetId: selectedVariableSetId.value || null,
  }
}

function isAllWorkspaceSelected() {
  return props.workspaceCode === 'ALL'
}

function hasConcreteEditorWorkspace(editor: EditorTab) {
  return Boolean(editor.detail.workspaceCode && editor.detail.workspaceCode !== 'ALL')
}

function guardAllWorkspaceAction(editor: EditorTab, actionText: string) {
  if (!isAllWorkspaceSelected()) return true
  if (editor.definitionId && hasConcreteEditorWorkspace(editor)) return true
  ElMessage.warning(`请先切换到具体工作空间后再${actionText}`)
  return false
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
    await nextTick()
    expandedKeys.value = collectExpandableDirectoryKeys(directoryTree.value)
    restoreRunOptions()
    emit('loaded', { definitions: definitions.value, modules: modules.value, cases: cases.value })
    if (!tabs.value.length && props.workspaceCode === 'ALL') {
      openNewRequestTab()
    } else if (!tabs.value.length && definitions.value.length) {
      void openDefinition(definitions.value[0], false)
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
  hydrateBodyModeText(detail.requestConfig.body)
  const key = source?.id ? `definition:${source.id}:${Date.now()}` : `draft:${Date.now()}`
  const tab: EditorTab = {
    key,
    definitionId: source?.id || null,
    title: editorTitle(detail),
    method: detail.requestConfig.method || detail.method || 'GET',
    dirty: Boolean(source),
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

async function openDefinition(item: ApiDefinitionItem, syncDirectory = true) {
  const existed = tabs.value.find(tab => tab.definitionId === item.id)
  if (existed) {
    activeEditorKey.value = existed.key
    if (syncDirectory) {
      selectedDirectoryKey.value = `request:${item.id}`
    }
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
  if (syncDirectory) {
    selectedDirectoryKey.value = `request:${item.id}`
  }

  try {
    const detail = await apiAutomationApi.getDefinitionDetail(props.workspaceCode, item.id)
    hydrateBodyModeText(detail.requestConfig.body)
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
    const confirmed = await confirmApiAction('当前请求有未保存修改，关闭后会丢失，确认关闭吗？', '关闭标签')
    if (!confirmed) return
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
    const confirmed = await confirmApiAction('其他标签中有未保存修改，关闭后会丢失，确认关闭吗？', '关闭其他标签')
    if (!confirmed) return
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
    const confirmed = await confirmApiAction('草稿标签中有未保存修改，关闭后会丢失，确认关闭吗？', '关闭全部草稿')
    if (!confirmed) return
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
  syncRequestBodyRawText(activeDetail.value.requestConfig)
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
  const rowMap = new Map<string, { key: string; value: string; description: string }>()

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line || /^[=:]/.test(line) || rawLine.startsWith('\t')) {
      return
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
    if (!row.key) {
      return
    }
    rowMap.delete(row.key)
    rowMap.set(row.key, row)
  })

  return Array.from(rowMap.values())
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
  const value = await openApiSoftPrompt({
    title: '新建模块',
    message: '请输入模块名称',
    requiredMessage: '模块名称不能为空',
  })
  if (!value) return
  await apiAutomationApi.createDefinitionModule(props.workspaceCode, {
    workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
    parentId,
    name: value,
  })
  await loadWorkspaceData()
  ElMessage.success('模块已创建')
}

async function renameModule(node: DirectoryNode) {
  if (!node.moduleId) return
  const value = await openApiSoftPrompt({
    title: '重命名模块',
    message: '请输入新的模块名称',
    value: node.label.split('/').pop() || node.label,
    requiredMessage: '模块名称不能为空',
  })
  if (!value) return
  await apiAutomationApi.updateDefinitionModule(props.workspaceCode, node.moduleId, {
    workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
    name: value,
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
  const confirmed = await confirmApiAction('删除后不可恢复，确认删除该模块吗？', '删除模块', { danger: true })
  if (!confirmed) return
  await apiAutomationApi.deleteDefinitionModule(props.workspaceCode, node.moduleId)
  await loadWorkspaceData()
  ElMessage.success('模块已删除')
}

async function renameRequest(node: DirectoryNode) {
  if (!node.definitionId || !node.definition) return
  const value = await openApiSoftPrompt({
    title: '重命名请求',
    message: '请输入新的请求名称',
    value: node.definition.name,
    requiredMessage: '请求名称不能为空',
  })
  if (!value) return
  const detail = await apiAutomationApi.getDefinitionDetail(props.workspaceCode, node.definitionId)
  const saved = await apiAutomationApi.updateDefinition(props.workspaceCode, node.definitionId, {
    ...buildPayload({ ...detail, name: value }),
    name: value,
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
  const confirmed = await confirmApiAction('删除后不可恢复，确认删除该请求吗？', '删除请求', { danger: true })
  if (!confirmed) return
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
  if (!guardAllWorkspaceAction(editor, '保存接口')) return
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
  if (!guardAllWorkspaceAction(editor, '发送请求')) return
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

  const confirmed = await confirmApiAction('删除后不可恢复，确认删除当前接口吗？', '删除接口', { danger: true })
  if (!confirmed) return
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
  if (!guardAllWorkspaceAction(activeEditor.value, '保存为用例')) return
  if (!activeEditor.value.definitionId) {
    try {
      const confirmed = await confirmApiAction('当前请求还未保存为接口，请先保存接口，再保存为用例。是否现在保存接口？', '保存为用例', {
        confirmText: '先保存接口',
      })
      if (!confirmed) return
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
  const value = await openApiSoftPrompt({
    title: 'Curl 导入',
    message: '粘贴 curl 命令，支持 method、URL、Headers、Body 的最小解析',
    inputType: 'textarea',
    placeholder: `curl -X POST "https://example.com/api" -H "Content-Type: application/json" -d '{"name":"demo"}'`,
    requiredMessage: '请输入 curl 命令',
    confirmText: '导入',
  })
  if (!value) return
  try {
    applyCurlToActiveEditor(value)
    ElMessage.success('Curl 已填充到当前请求')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Curl 解析失败')
  }
}

function openImportDialog() {
  importMode.value = 'swagger'
  importInputMode.value = 'url'
  importUrl.value = ''
  importFileName.value = ''
  importDialogVisible.value = true
}

function closeImportDialog() {
  importDialogVisible.value = false
}

function handleImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  importFileName.value = input.files?.[0]?.name || ''
}

function submitImportDialog() {
  ElMessage.info('当前导入类型需要后端接口支持')
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
    setModeBodyText(detail.requestConfig.body, body, detail.requestConfig.body.type)
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
    requestConfig: payloadRequestConfig(detail),
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

function latestCaseRunHistories(items: ApiRunHistoryItem[]) {
  return [...items]
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, CASE_RUN_HISTORY_LIMIT)
}

function aiGeneratedDraftExtra(result: ApiAiGeneratedCaseResult | null, key: string) {
  if (!result) return null
  return (result.draft as unknown as Record<string, unknown>)[key] ?? null
}

async function batchAcceptAiGeneratedCases() {
  let pending = selectedPendingAiCaseResults.value
  if (!pending.length && aiCasePendingResults.value.length) {
    try {
      const confirmed = await confirmApiAction('当前未勾选生成结果，是否采纳全部待处理结果？', '批量采纳', {
        confirmText: '采纳全部',
      })
      if (!confirmed) return
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
      const confirmed = await confirmApiAction('当前未勾选生成结果，是否弃用全部待处理结果？', '批量弃用', {
        confirmText: '弃用全部',
        danger: true,
      })
      if (!confirmed) return
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
  caseDetailRequestTab.value = 'headers'
  caseDetailResponseTab.value = 'body'
  caseHistoryView.value = 'list'
  caseHistoryRequestTab.value = 'header'
  caseHistoryResponseTab.value = 'body'
  caseDetailDrawerVisible.value = true
  await Promise.all([loadViewingCaseDetail(item.id), loadCaseRunHistories(item.id)])
}

async function loadViewingCaseDetail(caseId: number) {
  viewingCaseDetailLoading.value = true
  viewingCaseDetailErrorMessage.value = ''
  try {
    const detail = await apiAutomationApi.getCaseDetail(props.workspaceCode, caseId)
    viewingCaseDetail.value = detail
    caseDetailRequestTab.value = pickCaseDetailDefaultRequestTab(detail)
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
    const page = await apiAutomationApi.getCaseRunHistory(props.workspaceCode, caseId, {
      pageNo: 1,
      pageSize: CASE_RUN_HISTORY_LIMIT,
    })
    const recentHistories = latestCaseRunHistories(page.items)
    caseRunHistories.value = recentHistories
    caseHistoryView.value = 'list'
    selectedCaseRunHistoryId.value = null
    selectedCaseRunHistoryDetail.value = null
    caseRunHistoryDetailErrorMessage.value = ''
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

async function openCaseRunHistorySecondaryDetail(item: ApiRunHistoryItem) {
  caseHistoryView.value = 'detail'
  await openCaseRunHistoryDetail(item)
}

function backToCaseRunHistoryList() {
  caseHistoryView.value = 'list'
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
  const confirmed = await confirmApiAction('删除后不可恢复，确认删除该用例吗？', '删除用例', {
    confirmText: '确认',
    danger: true,
  })
  if (!confirmed) return
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
      <div class="api-interface-tab-nav">
        <button class="api-interface-tab is-active" type="button">接口</button>
        <button class="api-interface-tab" type="button" disabled>场景</button>
        <button class="api-interface-tab" type="button" disabled>执行</button>
        <button class="api-interface-tab" type="button" disabled>报告</button>
        <button class="api-interface-tab" type="button" disabled>设置</button>
      </div>
    </div>

    <div v-if="activeTopTab === 'definitions'" class="api-interface-shell">
      <aside class="api-interface-sidebar">
        <div class="api-interface-sidebar__actions">
          <button type="button" class="api-sidebar-primary" @click="openNewRequestTab()">
            <el-icon><Plus /></el-icon>
            新建请求
          </button>
          <button type="button" class="api-sidebar-secondary" @click="openImportDialog">
            <LucideUpload class="api-sidebar-button-icon" />
            导入
          </button>
        </div>

        <div class="api-sidebar-search">
          <el-input v-model="directoryKeyword" clearable placeholder="搜索模块或请求" :prefix-icon="Search" />
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
            :key="directoryTreeRenderKey"
            :data="visibleDirectoryTree"
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
                <div class="api-directory-node__main">
                  <template v-if="data.type === 'request'">
                    <span :class="['api-method', requestMethodClass(data.method)]">{{ data.method }}</span>
                    <span class="api-directory-node__name">{{ data.label }}</span>
                  </template>
                  <template v-else>
                    <span :class="['api-directory-node__folder', { 'is-open': expandedKeys.includes(data.key) }]">
                      <LucideFolderOpen v-if="expandedKeys.includes(data.key)" class="api-directory-node__icon" />
                      <LucideFolder v-else class="api-directory-node__icon" />
                    </span>
                    <span class="api-directory-node__name">{{ data.label }}</span>
                    <span class="api-directory-node__count">{{ data.count }}</span>
                  </template>
                </div>

                <div class="api-directory-node__actions" @click.stop>
                  <button
                    v-if="data.type === 'workspace' || data.type === 'module'"
                    type="button"
                    class="api-directory-node__action"
                    title="新建模块"
                    @click.stop="createModule(data.type === 'module' ? data.moduleId : null)"
                  >
                    <LucidePlus class="api-directory-node__lucide-action" />
                  </button>
                  <el-dropdown v-if="data.type === 'module' || data.type === 'request'" trigger="click" @click.stop>
                    <button type="button" class="api-directory-node__action is-more" title="更多操作" @click.stop>
                      <LucideMoreHorizontal class="api-directory-node__lucide-action" />
                    </button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <template v-if="data.type === 'module'">
                          <el-dropdown-item @click="renameModule(data)">重命名模块</el-dropdown-item>
                          <el-dropdown-item @click="deleteModule(data)">删除模块</el-dropdown-item>
                        </template>
                        <template v-else-if="data.type === 'request'">
                          <el-dropdown-item @click="renameRequest(data)">重命名请求</el-dropdown-item>
                          <el-dropdown-item divided @click="deleteRequest(data)">删除请求</el-dropdown-item>
                        </template>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </template>
          </el-tree>
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
              <span v-if="tabs.length > 1" class="api-editor-tab__close" @click.stop="closeEditorTab(item.key)">
                <el-icon><Close /></el-icon>
              </span>
            </button>
          </div>
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
                popper-class="api-method-popper"
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
            <button
              type="button"
              class="api-send-button"
              :disabled="sending || !activeEditor.detail.requestConfig.path.trim()"
              @click="sendActiveEditor"
            >
              <LucidePlay class="api-send-button__icon" />
              发送
            </button>
            <el-dropdown
              split-button
              class="api-save-dropdown"
              popper-class="api-save-dropdown-menu"
              :disabled="!activeEditor.detail.requestConfig.path.trim()"
              :loading="saving"
              @click="saveActiveEditor"
            >
              <span class="api-save-label">
                <LucideSave class="api-button-icon" />
                保存
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="activeEditor.definitionId" @click="saveAsCase">保存为用例</el-dropdown-item>
                  <el-dropdown-item @click="duplicateActiveEditor">
                    复制接口
                  </el-dropdown-item>
                  <el-dropdown-item @click="deleteActiveEditor">
                    {{ activeEditor.definitionId ? '删除接口' : '删除接口' }}
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

            <div :class="['api-request-body', `is-${activeEditor.activeTab}`]">
              <template v-if="activeEditor.activeTab === 'params'">
                <div class="api-param-table is-query">
                  <div class="api-param-header">
                    <span class="api-drag-cell"></span>
                    <span class="api-checkbox-cell"><el-checkbox :model-value="activeEditor.detail.requestConfig.queryParams.every(row => row.enabled)" @change="setRowsEnabled(activeEditor.detail.requestConfig.queryParams, $event)" /></span>
                    <span class="api-header-title">Query 参数</span>
                    <span class="api-type-header">类型</span>
                    <span>参数值</span>
                    <span class="api-length-header">长度范围</span>
                    <span>编码</span>
                    <span>描述</span>
                    <button type="button" class="api-link-button" @click="openBatchAdd('query')">批量添加</button>
                  </div>
                  <div v-for="(row, index) in activeEditor.detail.requestConfig.queryParams" :key="`query-${index}`" class="api-param-row">
                    <span class="api-drag-cell">
                      <span class="api-drag-handle" aria-hidden="true">
                        <span v-for="dotIndex in 6" :key="`query-dot-${index}-${dotIndex}`" class="api-drag-dot"></span>
                      </span>
                    </span>
                    <span class="api-checkbox-cell"><el-checkbox v-model="row.enabled" @change="markDirty" /></span>
                    <el-input v-model="row.key" placeholder="参数名称" @input="markDirty" />
                    <div class="api-type-field">
                      <button type="button" :class="['api-required-button', { active: row.required }]" :title="row.required ? '必填' : '非必填'" @click="row.required = !row.required; markDirty()">*</button>
                      <el-select v-model="row.paramType" placeholder="类型" @change="markDirty">
                        <el-option v-for="type in paramTypeOptions.filter(item => item !== 'file')" :key="type" :label="type" :value="type" />
                      </el-select>
                    </div>
                    <el-input v-model="row.value" placeholder="参数值 / {{variable}}" @input="markDirty" />
                    <div class="api-length-range">
                      <el-input-number v-model="row.minLength" :min="0" :controls="false" placeholder="最小" @change="markDirty" />
                      <span>至</span>
                      <el-input-number v-model="row.maxLength" :min="0" :controls="false" placeholder="最大" @change="markDirty" />
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
                  <div class="api-param-header">
                    <span class="api-drag-cell"></span>
                    <span class="api-checkbox-cell"><el-checkbox :model-value="activeEditor.detail.requestConfig.headers.every(row => row.enabled)" @change="setRowsEnabled(activeEditor.detail.requestConfig.headers, $event)" /></span>
                    <span class="api-header-title">参数名称</span>
                    <span>参数值</span>
                    <span>描述</span>
                    <button type="button" class="api-link-button" @click="openBatchAdd('header')">批量添加</button>
                  </div>
                  <div v-for="(row, index) in activeEditor.detail.requestConfig.headers" :key="`header-${index}`" class="api-param-row">
                    <span class="api-drag-cell">
                      <span class="api-drag-handle" aria-hidden="true">
                        <span v-for="dotIndex in 6" :key="`header-dot-${index}-${dotIndex}`" class="api-drag-dot"></span>
                      </span>
                    </span>
                    <span class="api-checkbox-cell"><el-checkbox v-model="row.enabled" @change="markDirty" /></span>
                    <el-input v-model="row.key" placeholder="参数名称" @input="markDirty" />
                    <el-input v-model="row.value" placeholder="参数值" @input="markDirty" />
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
                  <div
                    :class="[
                      'api-body-editor',
                      {
                        'is-empty': activeEditor.detail.requestConfig.body.type === 'NONE',
                        'is-code': isRawBodyType(activeEditor.detail.requestConfig.body.type),
                      },
                    ]"
                  >
                    <div v-if="activeEditor.detail.requestConfig.body.type === 'NONE'" class="api-empty-body">请求没有 Body</div>
                    <ApiCodeEditor
                      v-else-if="isRawBodyType(activeEditor.detail.requestConfig.body.type)"
                      v-model="activeBodyRawText"
                      :language="activeBodyLanguage"
                      height="300px"
                      placeholder="请输入请求体"
                      @change="markDirty"
                    />
                    <div v-else-if="['FORM_DATA', 'FORM_URLENCODED'].includes(activeEditor.detail.requestConfig.body.type)" class="api-param-table is-body-form">
                      <div class="api-param-header">
                        <span class="api-drag-cell"></span>
                        <span class="api-checkbox-cell"><el-checkbox :model-value="activeEditor.detail.requestConfig.body.formItems.every(row => row.enabled)" @change="setRowsEnabled(activeEditor.detail.requestConfig.body.formItems, $event)" /></span>
                        <span class="api-header-title">参数名称</span>
                        <span class="api-type-header">类型</span>
                        <span>参数值</span>
                        <span class="api-length-header">长度范围</span>
                        <span>描述</span>
                        <button type="button" class="api-link-button" @click="openBatchAdd('body-form')">批量添加</button>
                      </div>
                      <div v-for="(row, index) in activeEditor.detail.requestConfig.body.formItems" :key="`body-${index}`" class="api-param-row">
                        <span class="api-drag-cell">
                          <span class="api-drag-handle" aria-hidden="true">
                            <span v-for="dotIndex in 6" :key="`body-dot-${index}-${dotIndex}`" class="api-drag-dot"></span>
                          </span>
                        </span>
                        <span class="api-checkbox-cell"><el-checkbox v-model="row.enabled" @change="markDirty" /></span>
                        <el-input v-model="row.key" placeholder="参数名称" @input="markDirty" />
                        <div class="api-type-field">
                          <button type="button" :class="['api-required-button', { active: row.required }]" :title="row.required ? '必填' : '非必填'" @click="row.required = !row.required; markDirty()">*</button>
                          <el-select v-model="row.paramType" placeholder="类型" @change="markDirty">
                            <el-option
                              v-for="type in (activeEditor.detail.requestConfig.body.type === 'FORM_DATA' ? paramTypeOptions : paramTypeOptions.filter(item => item !== 'file'))"
                              :key="type"
                              :label="type"
                              :value="type"
                            />
                          </el-select>
                        </div>
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
                          <el-input-number v-model="row.minLength" :min="0" :controls="false" placeholder="最小" @change="markDirty" />
                          <span>至</span>
                          <el-input-number v-model="row.maxLength" :min="0" :controls="false" placeholder="最大" @change="markDirty" />
                        </div>
                        <el-input v-model="row.description" placeholder="描述" @input="markDirty" />
                        <button type="button" class="api-row-remove" @click="removeRow(activeEditor.detail.requestConfig.body.formItems, index)">删除</button>
                      </div>
                      <button type="button" class="api-add-row" @click="addRow(activeEditor.detail.requestConfig.body.formItems)">+ 添加一行</button>
                    </div>
                    <div v-else class="api-binary-panel">
                      <div class="api-binary-row">
                        <div class="api-binary-label">File</div>
                        <div class="api-binary-actions">
                          <label class="api-binary-pick">
                            {{ activeEditor.detail.requestConfig.body.fileName ? '重新选择' : '选择文件' }}
                            <input type="file" @change="handleBinaryFileChange" />
                          </label>
                          <button
                            type="button"
                            class="api-binary-clear"
                            :disabled="!activeEditor.detail.requestConfig.body.binaryBase64"
                            @click="clearBinaryFile"
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      <div class="api-binary-row">
                        <div class="api-binary-label">已选文件</div>
                        <div class="api-binary-selected">
                          <template v-if="activeEditor.detail.requestConfig.body.fileName">
                            <span class="api-binary-file-name">{{ activeEditor.detail.requestConfig.body.fileName }}</span>
                            <span v-if="activeEditor.detail.requestConfig.body.fileSize" class="api-binary-file-size">{{ formatFileSize(activeEditor.detail.requestConfig.body.fileSize) }}</span>
                          </template>
                          <template v-else>
                            尚未选择二进制文件
                          </template>
                        </div>
                      </div>
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
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.basicAuth!.userName" class="api-auth-form-control" placeholder="username" @input="markDirty" />
                    <label>Password</label>
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.basicAuth!.password" class="api-auth-form-control" show-password placeholder="password" @input="markDirty" />
                  </div>
                  <div v-else-if="activeEditor.detail.requestConfig.authConfig.authType === 'DIGEST'" class="api-auth-grid">
                    <label>Username</label>
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.digestAuth!.userName" class="api-auth-form-control" placeholder="username" @input="markDirty" />
                    <label>Password</label>
                    <el-input v-model="activeEditor.detail.requestConfig.authConfig.digestAuth!.password" class="api-auth-form-control" show-password placeholder="password" @input="markDirty" />
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
                  <div class="api-settings-control-cell">
                    <el-input-number
                      v-model="activeEditor.detail.requestConfig.timeoutMs"
                      :min="1000"
                      :step="1000"
                      class="api-settings-timeout-number"
                      @change="markDirty"
                    />
                  </div>
                  <label>描述</label>
                  <el-input v-model="activeEditor.detail.description" type="textarea" :rows="4" placeholder="接口描述、调用约束或备注" @input="markDirty" />
                  <div class="api-settings-footer">
                    <span>写入空间 {{ currentDefinitionWorkspaceLabel }}</span>
                    <span>调试上下文 {{ currentEnvironmentName }} / {{ currentVariableSetName }}</span>
                    <span>最后运行 {{ activeEditor.runResult ? '已运行' : '未运行' }}</span>
                  </div>
                </div>
              </template>

              <template v-else-if="activeEditor.activeTab === 'cases'">
                <div class="ms-like-request-body case-list-request-body">
                  <div class="request-section case-list-panel">
                    <div class="editor-actions left">
                      <el-button
                        type="primary"
                        :title="activeEditor.definitionId ? '新建用例' : '请先保存接口，再创建用例'"
                        :disabled="!activeEditor.definitionId"
                        @click="openCreateCaseDialog"
                      >
                        新建用例
                      </el-button>
                      <button
                        type="button"
                        class="case-ai-generate-button"
                        :disabled="!activeEditor.definitionId"
                        :title="activeEditor.definitionId ? 'AI 生成接口用例' : '请先保存接口，再使用 AI 生成用例'"
                        @click="openAiCaseDrawer"
                      >
                        <el-icon><MagicStick /></el-icon>
                        <span>AI生成用例</span>
                      </button>
                    </div>

                    <div v-if="!activeDefinitionCases.length" class="empty-hint">当前接口下还没有用例</div>
                    <div v-else class="case-list-table-wrap">
                      <el-table :data="pagedDefinitionCases" size="small" class="case-list-table">
                        <el-table-column prop="id" label="ID" width="92" />
                        <el-table-column prop="name" label="用例名称" min-width="200" show-overflow-tooltip />
                        <el-table-column label="协议" width="90">
                          <template #default>
                            {{ caseProtocolLabel() }}
                          </template>
                        </el-table-column>
                        <el-table-column label="用例等级" width="100">
                          <template #default="{ row }">
                            {{ casePriorityLabel(row) }}
                          </template>
                        </el-table-column>
                        <el-table-column label="状态" width="110">
                          <template #default="{ row }">
                            {{ caseStatusLabel(row) }}
                          </template>
                        </el-table-column>
                        <el-table-column prop="path" label="路径" min-width="240" show-overflow-tooltip />
                        <el-table-column label="标签" min-width="160" show-overflow-tooltip>
                          <template #default="{ row }">
                            {{ formatCaseTags(row.tags) }}
                          </template>
                        </el-table-column>
                        <el-table-column label="创建人" width="110">
                          <template #default>-</template>
                        </el-table-column>
                        <el-table-column width="148" fixed="right" align="center" header-align="center">
                          <template #header>
                            <div class="case-list-operation-header">
                              <span>操作</span>
                              <el-button text class="table-settings-trigger case-list-settings-trigger" title="表格设置">
                                <el-icon><Setting /></el-icon>
                              </el-button>
                            </div>
                          </template>
                          <template #default="{ row }">
                            <div class="case-list-actions">
                              <el-button text type="primary" size="small" class="case-list-action-button" @click="openEditCaseDialog(row)">编辑</el-button>
                              <el-button text size="small" type="primary" :loading="caseRunningId === row.id" @click="runCase(row)">执行</el-button>
                              <el-dropdown trigger="click" placement="bottom-end">
                                <el-button text type="primary" size="small" class="case-list-more-button">
                                  <el-icon><MoreFilled /></el-icon>
                                </el-button>
                                <template #dropdown>
                                  <el-dropdown-menu class="case-list-more-menu">
                                    <el-dropdown-item class="case-list-menu-item" @click="openCaseDetailDrawer(row)">查看详情</el-dropdown-item>
                                    <el-dropdown-item class="case-list-menu-item" @click="duplicateCase(row)">复制</el-dropdown-item>
                                    <el-dropdown-item class="case-list-menu-item is-danger" @click="deleteCase(row)">删除</el-dropdown-item>
                                  </el-dropdown-menu>
                                </template>
                              </el-dropdown>
                            </div>
                          </template>
                        </el-table-column>
                      </el-table>
                      <div class="case-list-pagination">
                        <div class="case-list-pagination-summary">共 {{ activeDefinitionCases.length }} 条 / {{ caseListTotalPages }} 页</div>
                        <el-pagination
                          v-model:current-page="caseListCurrentPage"
                          v-model:page-size="caseListPageSize"
                          :page-sizes="[10, 20, 30, 40, 50]"
                          size="small"
                          layout="sizes, prev, pager, next"
                          :total="activeDefinitionCases.length"
                        />
                      </div>
                    </div>
                  </div>
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
                  <div class="api-assertion-editor">
                    <aside class="api-assertion-list">
                      <div class="api-assertion-toolbar">
                        <el-dropdown trigger="click" @command="addAssertionFromCommand">
                          <button type="button" class="api-legacy-primary">添加断言</button>
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item v-for="item in assertionTypeOptions" :key="item.value" :command="item.value">{{ item.label }}</el-dropdown-item>
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                        <button type="button" class="api-assertion-batch-link" @click="openBatchAdd('assertion')">批量添加</button>
                      </div>
                      <button
                        v-for="(assertion, index) in assertionRowsFor(activeEditor.detail)"
                        :key="assertion.id || index"
                        type="button"
                        :class="['api-assertion-list-item', { 'is-active': activeAssertion?.id === assertion.id }]"
                        @click="selectAssertion(assertion)"
                      >
                        <span class="api-assertion-list-item__main">
                          <el-switch v-model="assertion.enabled" size="small" @click.stop @change="markDirty" />
                          <span class="api-assertion-list-copy">
                            <span class="api-assertion-list-title">{{ assertion.name || `断言 ${index + 1}` }}</span>
                            <span class="api-assertion-list-meta">{{ assertionTypeLabel(assertion.assertionType || assertion.type) }}</span>
                          </span>
                        </span>
                        <span class="api-assertion-list-actions">
                          <button type="button" class="api-assertion-ghost-action" :disabled="index === 0" @click.stop="moveAssertion(index, -1)">上移</button>
                          <button type="button" class="api-assertion-ghost-action" :disabled="index === assertionRowsFor(activeEditor.detail).length - 1" @click.stop="moveAssertion(index, 1)">下移</button>
                        </span>
                      </button>
                      <div v-if="!assertionRowsFor(activeEditor.detail).length" class="api-assertion-empty">暂无断言</div>
                    </aside>
                    <section v-if="activeAssertion" class="api-assertion-detail">
                      <div class="api-assertion-detail-header">
                        <div class="api-assertion-detail-fields">
                          <el-input v-model="activeAssertion.name" placeholder="断言名称" @input="markDirty" />
                          <el-tag size="small" effect="plain">{{ assertionTypeLabel(activeAssertion.assertionType || activeAssertion.type) }}</el-tag>
                        </div>
                        <div class="api-assertion-detail-actions">
                          <button type="button" @click="copyAssertion(assertionRowsFor(activeEditor.detail).indexOf(activeAssertion))">复制</button>
                          <button type="button" class="api-row-remove" @click="removeAssertion(assertionRowsFor(activeEditor.detail).indexOf(activeAssertion))">删除</button>
                        </div>
                      </div>

                      <div v-if="activeAssertion.assertionType === 'RESPONSE_CODE'" class="api-assertion-type-panel">
                        <div class="api-assertion-form-grid">
                          <label>
                            <span>条件</span>
                            <el-select v-model="activeAssertion.condition" @change="activeAssertion.operator = activeAssertion.condition; markDirty()">
                              <el-option v-for="item in assertionConditionOptions" :key="item.value" :label="item.label" :value="item.value" />
                            </el-select>
                          </label>
                          <label>
                            <span>期望值</span>
                            <el-input v-model="activeAssertion.expectedValue" placeholder="200" @input="markDirty" />
                          </label>
                        </div>
                      </div>

                      <div v-else-if="activeAssertion.assertionType === 'RESPONSE_HEADER'" class="api-assertion-type-panel">
                        <div class="api-assertion-item-list">
                          <div v-for="(item, index) in activeAssertion.assertions" :key="`${activeAssertion.id}-header-${index}`" class="api-assertion-item-row is-header">
                            <el-checkbox v-model="item.enabled" @change="markDirty" />
                            <el-input v-model="item.header" placeholder="响应头名称" @input="activeAssertion.expression = item.header || ''; markDirty()" />
                            <el-select v-model="item.condition" @change="item.operator = item.condition; markDirty()">
                              <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
                            </el-select>
                            <el-input v-model="item.expectedValue" placeholder="期望值" @input="activeAssertion.expectedValue = item.expectedValue || ''; markDirty()" />
                            <button type="button" @click="copyAssertionItem(activeAssertion.assertions || [], index)">复制</button>
                            <button type="button" class="api-row-remove" @click="removeAssertionItem(activeAssertion.assertions || [], index, { header: '', condition: 'EQUALS', expectedValue: '' })">删除</button>
                          </div>
                          <button type="button" class="api-assertion-add-row" @click="addAssertionItem(activeAssertion.assertions || (activeAssertion.assertions = []), { header: '' })">+ 添加响应头断言</button>
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
                            <el-checkbox v-model="item.enabled" @change="markDirty" />
                            <el-input v-model="item.expression" placeholder="$.data.id / /root/id / 正则" @input="activeAssertion.expression = item.expression || ''; markDirty()">
                              <template #suffix>
                                <button
                                  type="button"
                                  :class="['api-fast-extraction-suffix-button', { 'is-disabled': !hasLatestResponseBody }]"
                                  :disabled="!hasLatestResponseBody"
                                  :title="fastExtractionTitle"
                                  @click.stop="openAssertionFastExtraction(activeAssertion, item)"
                                >
                                  <el-icon><MagicStick /></el-icon>
                                </button>
                              </template>
                            </el-input>
                            <el-select v-model="item.condition" @change="item.operator = item.condition; markDirty()">
                              <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
                            </el-select>
                            <el-input v-model="item.expectedValue" placeholder="期望值" @input="activeAssertion.expectedValue = item.expectedValue || ''; markDirty()" />
                            <button type="button" @click="testAssertionExpression(activeAssertion, item)">测试</button>
                            <button type="button" @click="copyAssertionItem(activeAssertionBodyGroup(activeAssertion).assertions, index)">复制</button>
                            <button type="button" class="api-row-remove" @click="removeAssertionItem(activeAssertionBodyGroup(activeAssertion).assertions, index, { expression: defaultAssertionExpression(activeAssertion.assertionBodyType), condition: 'EQUALS', expectedValue: '' })">删除</button>
                          </div>
                        </div>
                      </div>

                      <div v-else-if="activeAssertion.assertionType === 'RESPONSE_TIME'" class="api-assertion-type-panel">
                        <div class="api-assertion-form-row">
                          <span class="api-assertion-form-label">最大耗时(ms)</span>
                          <el-input-number
                            :model-value="Number(activeAssertion.expectedValue || 1000)"
                            :min="1"
                            :step="100"
                            @update:model-value="updateAssertionResponseTime(activeAssertion, $event)"
                          />
                        </div>
                      </div>

                      <div v-else-if="activeAssertion.assertionType === 'VARIABLE'" class="api-assertion-type-panel">
                        <div class="api-assertion-hint">可校验后置 SQL 写入的变量，例如 firstToken / id_1 / sqlRows。</div>
                        <div class="api-assertion-item-list">
                          <div v-for="(item, index) in activeAssertion.variableAssertionItems" :key="`${activeAssertion.id}-variable-${index}`" class="api-assertion-item-row is-variable">
                            <el-checkbox v-model="item.enabled" @change="markDirty" />
                            <el-input v-model="item.variableName" placeholder="变量名" @input="activeAssertion.expression = item.variableName || ''; markDirty()" />
                            <el-select v-model="item.condition" @change="item.operator = item.condition; markDirty()">
                              <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
                            </el-select>
                            <el-input v-model="item.expectedValue" placeholder="期望值" @input="activeAssertion.expectedValue = item.expectedValue || ''; markDirty()" />
                            <button type="button" @click="copyAssertionItem(activeAssertion.variableAssertionItems || [], index)">复制</button>
                            <button type="button" class="api-row-remove" @click="removeAssertionItem(activeAssertion.variableAssertionItems || [], index, { variableName: '', condition: 'EQUALS', expectedValue: '' })">删除</button>
                          </div>
                          <button type="button" class="api-assertion-add-row" @click="addAssertionItem(activeAssertion.variableAssertionItems || (activeAssertion.variableAssertionItems = []), { variableName: '' })">+ 添加变量断言</button>
                        </div>
                      </div>

                      <div v-else class="api-assertion-type-panel">
                        <div class="api-assertion-editor-actions">
                          <span class="api-processor-language-tag">JavaScript</span>
                          <button type="button" @click="activeAssertion.script = ''; markDirty()">清空</button>
                          <button type="button" @click="activeAssertion.script = (activeAssertion.script || '').trim(); markDirty()">格式化</button>
                        </div>
                        <ApiCodeEditor
                          v-model="activeAssertion.script"
                          height="360px"
                          language="javascript"
                          placeholder="if (response.statusCode !== 200) { throw new Error('状态码不正确') }"
                          @change="markDirty"
                        />
                        <small class="api-assertion-hint">发送时由后端执行脚本断言；当前只保存真实脚本内容，不做前端伪执行。</small>
                      </div>
                    </section>
                    <section v-else class="api-assertion-detail api-assertion-empty api-assertion-empty--inline">请选择一个断言进行编辑</section>
                  </div>
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
                          <el-dropdown-item v-for="item in processorTypeOptionsFor(activeEditor?.activeTab === 'pre' ? 'pre' : 'post')" :key="item.value" :command="item.value">{{ item.label }}</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                  <div class="api-processor-editor">
                    <aside class="api-processor-sidebar">
                      <div class="api-processor-toolbar">
                        <el-dropdown trigger="click" @command="(command: string | number | object) => addProcessorFromCommand(activeEditor?.activeTab === 'pre' ? 'pre' : 'post', command)">
                          <button type="button" class="api-legacy-primary">添加</button>
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item v-for="item in processorTypeOptionsFor(activeEditor?.activeTab === 'pre' ? 'pre' : 'post')" :key="item.value" :command="item.value">{{ item.label }}</el-dropdown-item>
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>
                      <div v-if="activeProcessorRows().length" class="api-processor-sidebar-list">
                        <button
                          v-for="(processor, index) in activeProcessorRows()"
                          :key="processor.id || index"
                          type="button"
                          :class="['api-processor-list-item', { 'is-active': activeProcessor?.id === processor.id }]"
                          @click="selectProcessor(processor)"
                        >
                          <span class="api-processor-list-item__main">
                            <el-switch v-model="processor.enabled" size="small" @click.stop @change="markDirty" />
                            <span class="api-processor-list-copy">
                              <span class="api-processor-list-title">{{ processor.name || processorDefaultName(activeProcessorStage(), processor.processorType) }}</span>
                              <span class="api-processor-list-meta">{{ processorTypeLabel(processor.processorType) }}</span>
                            </span>
                          </span>
                          <span class="api-processor-list-actions">
                            <el-button text :icon="ArrowUp" :disabled="index === 0" @click.stop="moveProcessor(activeProcessorStage(), index, -1)" />
                            <el-button text :icon="ArrowDown" :disabled="index === activeProcessorRows().length - 1" @click.stop="moveProcessor(activeProcessorStage(), index, 1)" />
                          </span>
                        </button>
                      </div>
                      <div v-else class="api-processor-empty">暂无处理器</div>
                    </aside>

                    <section class="api-processor-detail">
                      <template v-if="activeProcessor">
                        <div class="api-processor-detail-header">
                          <div class="api-processor-detail-fields">
                            <el-input v-model="activeProcessor.name" placeholder="处理器名称" @input="markDirty" />
                            <el-tag size="small" effect="plain">{{ processorTypeLabel(activeProcessor.processorType) }}</el-tag>
                          </div>
                          <div class="api-processor-detail-actions">
                            <button type="button" @click="copyProcessor(activeProcessorStage(), activeProcessorRows().indexOf(activeProcessor))">复制</button>
                            <button type="button" class="api-row-remove" @click="removeProcessor(activeProcessorStage(), activeProcessorRows().indexOf(activeProcessor))">删除</button>
                          </div>
                        </div>

                        <template v-if="activeProcessor.processorType === 'SCRIPT'">
                          <div class="api-processor-editor-actions">
                            <span class="api-processor-language-tag">JavaScript</span>
                            <button type="button" @click="activeProcessor.script = ''; markDirty()">清空</button>
                            <button type="button" @click="activeProcessor.script = (activeProcessor.script || '').trim(); markDirty()">格式化</button>
                          </div>
                          <ApiCodeEditor
                            v-model="activeProcessor.script"
                            height="360px"
                            language="javascript"
                            placeholder="请输入 JavaScript 脚本"
                            @change="markDirty"
                          />
                          <div class="api-processor-hint">可使用 setVar / getVar / removeVar / log / fail / request / response。</div>
                        </template>

                        <template v-else-if="activeProcessor.processorType === 'SQL'">
                          <div class="api-processor-form-grid">
                            <label>
                              <span>数据库连接</span>
                              <el-select
                                v-model="activeProcessor.dataSourceName"
                                filterable
                                clearable
                                allow-create
                                default-first-option
                                placeholder="选择数据库连接"
                                @change="markDirty"
                              />
                            </label>
                            <label>
                              <span>查询超时(ms)</span>
                              <el-input-number
                                v-model="activeProcessor.queryTimeout"
                                :min="1000"
                                :step="1000"
                                @change="markDirty"
                              />
                            </label>
                            <label>
                              <span>按列存储变量</span>
                              <el-input v-model="activeProcessor.variableNames" placeholder="id,email" @input="markDirty" />
                            </label>
                            <label>
                              <span>完整结果变量</span>
                              <el-input v-model="activeProcessor.resultVariable" placeholder="resultJson" @input="markDirty" />
                            </label>
                          </div>
                          <ApiCodeEditor
                            v-model="activeProcessor.sql"
                            height="260px"
                            language="sql"
                            placeholder="请输入 SQL 语句"
                            @change="syncProcessorScript(activeProcessor)"
                          />
                          <div class="api-sql-extract-table">
                            <div class="api-sql-extract-table__header">
                              <span>变量名</span>
                              <span>列名</span>
                              <span></span>
                            </div>
                            <div
                              v-for="(param, sqlParamIndex) in normalizeSqlExtractParams(activeProcessor.extractParams)"
                              :key="`${activeProcessor.id}-sql-${sqlParamIndex}`"
                              class="api-sql-extract-table__row"
                            >
                              <el-input v-model="param.key" placeholder="变量名" @input="markDirty" />
                              <el-input v-model="param.value" placeholder="列名" @input="markDirty" />
                              <button type="button" class="api-row-remove" @click="removeSqlExtractParam(activeProcessor, sqlParamIndex)">删除</button>
                            </div>
                            <button type="button" class="api-sql-extract-table__add" @click="addSqlExtractParam(activeProcessor)">+ 添加提取参数</button>
                          </div>
                        </template>

                        <template v-else-if="activeProcessor.processorType === 'EXTRACT'">
                          <div class="api-processor-extract-panel">
                            <div class="api-processor-extract-toolbar">
                              <span>提取参数</span>
                              <button type="button" @click="addProcessorExtractItem(activeProcessor)">+ 添加提取项</button>
                            </div>
                            <div class="api-processor-extract-scroll">
                              <div class="api-processor-extract-grid">
                                <div class="api-processor-extract-header">
                                  <span>变量名</span>
                                  <span>描述</span>
                                  <span>变量类型</span>
                                  <span>提取方式</span>
                                  <span>提取范围</span>
                                  <span>表达式</span>
                                  <span>操作</span>
                                </div>
                                <div
                                  v-for="(item, extractIndex) in normalizeProcessorExtractItems(activeProcessor.extractors, activeProcessor)"
                                  :key="item.id || extractIndex"
                                  class="api-processor-extract-row"
                                >
                                <el-input v-model="item.variableName" placeholder="例如 token" @input="syncProcessorScript(activeProcessor)" />
                                <el-input v-model="item.description" placeholder="可选" @input="syncProcessorScript(activeProcessor)" />
                                <el-select v-model="item.variableType" @change="syncProcessorScript(activeProcessor)">
                                  <el-option v-for="option in processorExtractVariableTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
                                </el-select>
                                <el-select v-model="item.extractType" @change="handleProcessorExtractTypeChange(activeProcessor, item)">
                                  <el-option v-for="option in processorExtractTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
                                </el-select>
                                <el-select
                                  v-model="item.extractScope"
                                  :disabled="item.extractType !== 'REGEX'"
                                  @change="handleProcessorExtractScopeChange(activeProcessor, item)"
                                >
                                  <el-option v-for="option in processorExtractScopeOptions(item)" :key="option.value" :label="option.label" :value="option.value" />
                                </el-select>
                                <el-input v-model="item.expression" :placeholder="processorExtractExpressionPlaceholder(item)" @input="syncProcessorScript(activeProcessor)">
                                  <template #suffix>
                                    <button
                                      type="button"
                                      :class="['api-fast-extraction-suffix-button', { 'is-disabled': !hasLatestResponseBody }]"
                                      :disabled="!hasLatestResponseBody"
                                      :title="fastExtractionTitle"
                                      @click.stop="openProcessorFastExtraction(activeProcessor, item)"
                                    >
                                      <el-icon><MagicStick /></el-icon>
                                    </button>
                                  </template>
                                </el-input>
                                <span class="api-processor-extract-actions">
                                  <el-popover
                                    placement="bottom-end"
                                    :width="340"
                                    trigger="click"
                                    :visible="processorExtractMoreSettingsVisibleKey === `${activeProcessor?.id || ''}-${extractIndex}`"
                                    @update:visible="(value: boolean) => setProcessorExtractMoreSettingsVisible(activeProcessor?.id, extractIndex, value)"
                                  >
                                    <template #reference>
                                      <button type="button" class="api-processor-extract-more" aria-label="更多设置">
                                        <el-icon><MoreFilled /></el-icon>
                                      </button>
                                    </template>
                                    <div class="api-processor-extract-more-panel">
                                      <button type="button" class="api-processor-extract-copy" @click="copyProcessorExtractItem(activeProcessor, extractIndex)">复制当前提取项</button>
                                      <div class="api-processor-extract-more-divider"></div>
                                      <div class="api-processor-extract-more-title">高级设置</div>
                                      <div class="api-processor-extract-more-group">
                                        <div class="api-processor-extract-more-label">结果匹配规则</div>
                                        <el-radio-group v-model="item.resultMatchingRule" size="small" @change="syncProcessorScript(activeProcessor)">
                                          <el-radio value="RANDOM">随机</el-radio>
                                          <el-radio value="SPECIFIC">指定</el-radio>
                                          <el-radio value="ALL">全部</el-radio>
                                        </el-radio-group>
                                      </div>
                                      <div v-if="showProcessorExtractSpecificIndex(item)" class="api-processor-extract-more-group">
                                        <div class="api-processor-extract-more-label">指定序号</div>
                                        <el-input-number v-model="item.resultMatchingRuleNum" :min="1" :step="1" size="small" @change="syncProcessorScript(activeProcessor)" />
                                      </div>
                                      <div v-if="showProcessorExtractRegexSettings(item)" class="api-processor-extract-more-group">
                                        <div class="api-processor-extract-more-label">正则匹配规则</div>
                                        <el-radio-group v-model="item.expressionMatchingRule" size="small" @change="syncProcessorScript(activeProcessor)">
                                          <el-radio value="EXPRESSION">整段匹配</el-radio>
                                          <el-radio value="GROUP">分组 1</el-radio>
                                        </el-radio-group>
                                      </div>
                                      <div v-if="showProcessorExtractXPathSettings(item)" class="api-processor-extract-more-group">
                                        <div class="api-processor-extract-more-label">内容格式</div>
                                        <el-radio-group v-model="item.responseFormat" size="small" @change="syncProcessorScript(activeProcessor)">
                                          <el-radio value="XML">XML</el-radio>
                                          <el-radio value="HTML">HTML</el-radio>
                                        </el-radio-group>
                                      </div>
                                    </div>
                                  </el-popover>
                                  <button type="button" class="api-row-remove api-processor-extract-delete" aria-label="删除提取项" @click="removeProcessorExtractItem(activeProcessor, extractIndex)">删除</button>
                                </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </template>

                        <template v-else>
                          <div class="api-processor-form-row">
                            <span class="api-processor-form-label">等待时长(ms)</span>
                            <el-input-number v-model="activeProcessor.delayMs" :min="1" :max="600000" :step="100" @change="markDirty" />
                          </div>
                        </template>

                        <el-input v-model="activeProcessor.description" placeholder="说明" @input="markDirty" />
                      </template>
                      <div v-else class="api-processor-empty api-processor-empty--inline">请选择一个处理器进行编辑</div>
                    </section>
                  </div>

                  <div v-if="false && activeEditor" class="api-processor-list">
                    <div
                      v-for="(processor, index) in activeProcessorRows()"
                      :key="processor.id || index"
                      class="api-processor-card"
                    >
                      <div class="api-processor-card__head">
                        <el-switch v-model="processor.enabled" size="small" @change="markDirty" />
                        <el-input v-model="processor.name" placeholder="处理器名称" @input="markDirty" />
                        <el-select
                          v-model="processor.processorType"
                          @change="normalizeProcessorForType(processor, activeProcessorStage())"
                        >
                          <el-option v-for="item in processorTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                        </el-select>
                        <div class="api-processor-card__actions">
                          <button type="button" @click="copyProcessor(activeProcessorStage(), index)">复制</button>
                          <button type="button" @click="moveProcessor(activeProcessorStage(), index, -1)">上移</button>
                          <button type="button" @click="moveProcessor(activeProcessorStage(), index, 1)">下移</button>
                          <button type="button" class="api-row-remove" @click="removeProcessor(activeProcessorStage(), index)">删除</button>
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
                            <el-input v-model="item.expression" placeholder="$.data.token / Header name / Regex" @input="syncProcessorScript(processor)">
                              <template #suffix>
                                <button
                                  type="button"
                                  :class="['api-fast-extraction-suffix-button', { 'is-disabled': !hasLatestResponseBody }]"
                                  :disabled="!hasLatestResponseBody"
                                  :title="fastExtractionTitle"
                                  @click.stop="openProcessorFastExtraction(processor, item)"
                                >
                                  <el-icon><MagicStick /></el-icon>
                                </button>
                              </template>
                            </el-input>
                            <el-input v-model="item.description" placeholder="说明" @input="syncProcessorScript(processor)" />
                            <button type="button" @click="copyProcessorExtractItem(processor, extractIndex)">复制</button>
                            <button type="button" class="api-row-remove" @click="removeProcessorExtractItem(processor, extractIndex)">删除</button>
                          </div>
                        </div>
                      </div>
                      <div v-else class="api-wait-row">
                        <span>等待时长 ms</span>
                        <el-input-number v-model="processor.delayMs" :min="1" :max="600000" :step="100" @change="markDirty" />
                      </div>
                      <el-input v-model="processor.description" placeholder="说明" @input="markDirty" />
                    </div>
                    <div v-if="!activeProcessorRows().length" class="api-empty-body">
                      暂无{{ activeProcessorStage() === 'pre' ? '前置' : '后置' }}处理器
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div v-if="shouldShowResponsePanel" class="api-response-shell" :style="{ minHeight: `${responsePanelHeight}px` }">
              <div class="api-response-resizer" title="拖拽调整响应区高度" @pointerdown="startResponseResize"></div>
              <div class="api-response-header">
                <strong>响应内容</strong>
                <div class="api-response-header__right">
                  <div v-if="!showResponseEmpty" class="api-response-metrics">
                    <span
                      v-if="responseAssertionPresentation.visible"
                      :class="['api-response-result-pill', `is-${responseAssertionPresentation.tone}`]"
                    >
                      {{ responseAssertionPresentation.label }}
                    </span>
                    <span :class="['api-response-pill', `is-${statusTone(responseStatus)}`]">状态 {{ responseStatus ?? '-' }}</span>
                    <span>耗时 {{ responseDuration ?? '-' }}<template v-if="responseDuration !== null"> ms</template></span>
                    <span>大小 {{ responseSize }}</span>
                  </div>
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
                    <button :class="{ 'is-active': activeEditor.responseTab === 'console' }" @click="activeEditor.responseTab = 'console'">控制台</button>
                    <button :class="{ 'is-active': activeEditor.responseTab === 'actualRequest' }" @click="activeEditor.responseTab = 'actualRequest'">实际请求</button>
                    <button :class="{ 'is-active': activeEditor.responseTab === 'assertions' }" @click="activeEditor.responseTab = 'assertions'">断言</button>
                  </div>
                  <div v-if="activeEditor.responseTab === 'body'" class="api-response-code">
                    <ApiCodeEditor
                      :model-value="responseBodyPretty"
                      :language="responseBodyLanguage"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                  </div>
                  <div v-else-if="activeEditor.responseTab === 'header'" class="api-response-code">
                    <ApiCodeEditor
                      :model-value="responseHeaders"
                      language="json"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                  </div>
                  <div v-else-if="activeEditor.responseTab === 'console'" class="api-response-code is-text">
                    <ApiCodeEditor
                      :model-value="responseConsole"
                      language="api-console"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                  </div>
                  <div v-else-if="activeEditor.responseTab === 'actualRequest'" class="api-response-code">
                    <ApiCodeEditor
                      :model-value="actualRequest"
                      language="json"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                  </div>
                  <el-table v-else-if="assertionRows.length" :data="assertionRows" size="small">
                    <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
                    </el-table-column>
                    <el-table-column label="断言对象" width="96">
                      <template #default="{ row }">{{ assertionTypeLabel(row.type) }}</template>
                    </el-table-column>
                    <el-table-column label="条件" width="100">
                      <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
                    </el-table-column>
                    <el-table-column label="期望值" min-width="120" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.expectedValue ?? '-' }}</template>
                    </el-table-column>
                    <el-table-column label="实际值" min-width="120" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.actualValue ?? '-' }}</template>
                    </el-table-column>
                    <el-table-column label="结果" width="90">
                      <template #default="{ row }">
                        <span :class="['api-assertion-result-pill', assertionResultClass(row.success)]">
                          {{ assertionResultLabel(row.success) }}
                        </span>
                      </template>
                    </el-table-column>
                    <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
                    </el-table-column>
                  </el-table>
                  <div v-else class="api-empty-body">当前请求未配置断言</div>
                </template>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <el-dialog
      v-model="softPromptVisible"
      width="420px"
      append-to-body
      :show-close="false"
      align-center
      class="api-soft-dialog-shell"
      @closed="cancelApiSoftPrompt"
    >
      <div class="api-soft-dialog">
        <div class="api-soft-dialog__header">
          <strong>{{ softPromptTitle }}</strong>
          <button type="button" class="api-soft-dialog__close" @click="cancelApiSoftPrompt">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="api-soft-dialog__body">
          <p v-if="softPromptMessage">{{ softPromptMessage }}</p>
          <el-input
            v-if="softPromptInputType === 'textarea'"
            v-model="softPromptValue"
            type="textarea"
            :rows="8"
            resize="none"
            :placeholder="softPromptPlaceholder"
            @keydown.ctrl.enter.prevent="confirmApiSoftPrompt"
          />
          <el-input
            v-else
            v-model="softPromptValue"
            :placeholder="softPromptPlaceholder"
            @keyup.enter="confirmApiSoftPrompt"
          />
          <div v-if="softPromptError" class="api-soft-dialog__error">{{ softPromptError }}</div>
        </div>
        <div class="api-soft-dialog__footer">
          <button type="button" class="api-soft-dialog__cancel" @click="cancelApiSoftPrompt">{{ softPromptCancelText }}</button>
          <button type="button" class="api-soft-dialog__submit" @click="confirmApiSoftPrompt">{{ softPromptConfirmText }}</button>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="importDialogVisible"
      width="520px"
      append-to-body
      destroy-on-close
      :show-close="false"
      class="api-import-dialog-shell"
    >
      <div class="api-import-dialog">
        <div class="api-import-header">
          <div class="api-import-title">
            <LucideUpload class="api-import-title-icon" />
            <span>导入接口</span>
          </div>
          <button type="button" class="api-import-close" @click="closeImportDialog">
            <LucideX />
          </button>
        </div>

        <div class="api-import-body">
          <section class="api-import-section">
            <div class="api-import-section-title">选择导入格式</div>
            <div class="api-import-format-list">
              <button
                v-for="item in importCapabilityItems"
                :key="item.mode"
                type="button"
                :class="['api-import-format', `is-${item.tone}`, { 'is-active': importMode === item.mode }]"
                @click="importMode = item.mode"
              >
                <span class="api-import-format-icon">
                  <component :is="item.icon" />
                </span>
                <span class="api-import-format-copy">
                  <span>{{ item.name }}</span>
                  <small>{{ item.description }}</small>
                </span>
                <span class="api-import-check">
                  <LucideCheck v-if="importMode === item.mode" />
                </span>
              </button>
            </div>
          </section>

          <section class="api-import-section">
            <div class="api-import-section-title">导入方式</div>
            <div class="api-import-mode-switch">
              <button
                type="button"
                :class="{ 'is-active': importInputMode === 'url' }"
                @click="importInputMode = 'url'"
              >
                URL 导入
              </button>
              <button
                type="button"
                :class="{ 'is-active': importInputMode === 'file' }"
                @click="importInputMode = 'file'"
              >
                文件上传
              </button>
            </div>
            <el-input
              v-if="importInputMode === 'url'"
              v-model="importUrl"
              class="api-import-url"
              :placeholder="importMode === 'swagger' ? 'https://api.example.com/v3/api-docs' : '输入文件远程地址'"
            />
            <label v-else class="api-import-upload">
              <LucideUpload class="api-import-upload-icon" />
              <span>{{ importFileName || '点击或拖拽文件到此处' }}</span>
              <small>支持 {{ selectedImportCapability.accept }}</small>
              <input
                type="file"
                :accept="selectedImportCapability.accept"
                @change="handleImportFileChange"
              >
            </label>
          </section>
        </div>

        <div class="api-import-footer">
          <button type="button" class="api-import-cancel" @click="closeImportDialog">取消</button>
          <button type="button" class="api-import-submit" @click="submitImportDialog">开始导入</button>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="batchAddVisible"
      width="560px"
      append-to-body
      :show-close="false"
      class="api-batch-dialog-shell"
    >
      <div class="api-batch-dialog">
        <div class="api-batch-dialog__header">
          <strong>{{ batchAddTitle }}</strong>
          <button type="button" class="api-soft-dialog__close" @click="batchAddVisible = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="api-batch-dialog__body">
          <p>{{ batchAddHint }}</p>
          <div class="api-batch-dialog__examples">
            <span>格式示例</span>
            <code v-for="item in batchAddExamples" :key="item">{{ item }}</code>
          </div>
          <div class="api-batch-dialog__notes">
            <span>空行会自动忽略</span>
            <span>重复 key 以后输入的值为准</span>
            <span>无 key 的行不会写入</span>
          </div>
          <el-input
            v-model="batchAddText"
            type="textarea"
            :rows="10"
            resize="none"
            :placeholder="batchAddPlaceholder"
          />
        </div>
        <div class="api-batch-dialog__footer">
          <button type="button" class="api-soft-dialog__cancel" @click="batchAddVisible = false">取消</button>
          <button type="button" class="api-soft-dialog__submit" @click="applyBatchAdd">确认添加</button>
        </div>
      </div>
    </el-dialog>

    <ApiCaseDetailDrawer
      v-model="caseDetailDrawerVisible"
      :title="viewingCaseItem?.name || '用例详情'"
      :subtitle="viewingCaseItem?.definitionName || activeEditor?.detail.name || '-'"
      :method="viewingCaseItem?.method || '-'"
      :path="viewingCaseItem?.path || '未设置路径'"
      @request-close="caseDetailDrawerVisible = false"
    >
      <div class="api-case-drawer-tabs">
        <div class="ms-like-top-tabs case-drawer-view-tabs">
          <button :class="['ms-like-top-tab', { active: caseDetailDrawerTab === 'detail' }]" @click="caseDetailDrawerTab = 'detail'">详情</button>
          <button :class="['ms-like-top-tab', { active: caseDetailDrawerTab === 'history' }]" @click="caseDetailDrawerTab = 'history'">执行历史</button>
          <button :class="['ms-like-top-tab', { active: caseDetailDrawerTab === 'changes' }]" @click="caseDetailDrawerTab = 'changes'">变更历史</button>
        </div>
      </div>

      <div v-if="caseDetailDrawerTab === 'detail'" class="api-case-detail-panel" v-loading="viewingCaseDetailLoading">
            <div v-if="viewingCaseDetailErrorMessage" class="api-empty-body">{{ viewingCaseDetailErrorMessage }}</div>
            <template v-else-if="viewingCaseDetail">
              <div class="ms-like-top-tabs case-drawer-top-tabs">
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'headers' }]" @click="caseDetailRequestTab = 'headers'">请求头</button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'body' }]" @click="caseDetailRequestTab = 'body'">请求体</button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'params' }]" @click="caseDetailRequestTab = 'params'">
                  Params
                  <span v-if="enabledRows(viewingCaseDetail.requestConfig.queryParams).length" class="ms-like-tab-badge">{{ enabledRows(viewingCaseDetail.requestConfig.queryParams).length }}</span>
                </button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'auth' }]" @click="caseDetailRequestTab = 'auth'">Auth</button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'pre' }]" @click="caseDetailRequestTab = 'pre'">前置处理</button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'post' }]" @click="caseDetailRequestTab = 'post'">后置处理</button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'tests' }]" @click="caseDetailRequestTab = 'tests'">
                  断言
                  <span v-if="viewingCaseDetail.assertions.length" class="ms-like-tab-badge">{{ viewingCaseDetail.assertions.length }}</span>
                </button>
                <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'settings' }]" @click="caseDetailRequestTab = 'settings'">设置</button>
              </div>

              <div class="api-request-body api-case-readonly-body">
                <template v-if="caseDetailRequestTab === 'headers'">
                  <div class="api-param-table is-header is-readonly">
                    <div class="api-param-header">
                      <span class="api-drag-cell"></span>
                      <span class="api-checkbox-cell"></span>
                      <span class="api-header-title">参数名称</span>
                      <span>参数值</span>
                      <span>描述</span>
                    </div>
                    <div v-for="(row, index) in viewingCaseDetail.requestConfig.headers" :key="`case-header-${index}`" class="api-param-row">
                      <span class="api-drag-cell"></span>
                      <span class="api-checkbox-cell"><el-checkbox :model-value="row.enabled !== false" disabled /></span>
                      <el-input :model-value="row.key" disabled placeholder="参数名称" />
                      <el-input :model-value="row.value" disabled placeholder="参数值" />
                      <el-input :model-value="row.description" disabled placeholder="描述" />
                    </div>
                    <div v-if="!viewingCaseDetail.requestConfig.headers.length" class="api-empty-body">暂无请求头</div>
                  </div>
                </template>

                <template v-else-if="caseDetailRequestTab === 'params'">
                  <div class="api-param-table is-query is-readonly">
                    <div class="api-param-header">
                      <span class="api-drag-cell"></span>
                      <span class="api-checkbox-cell"></span>
                      <span class="api-header-title">Query 参数</span>
                      <span class="api-type-header">类型</span>
                      <span>参数值</span>
                      <span class="api-length-header">长度范围</span>
                      <span>编码</span>
                      <span>描述</span>
                    </div>
                    <div v-for="(row, index) in viewingCaseDetail.requestConfig.queryParams" :key="`case-query-${index}`" class="api-param-row">
                      <span class="api-drag-cell"></span>
                      <span class="api-checkbox-cell"><el-checkbox :model-value="row.enabled !== false" disabled /></span>
                      <el-input :model-value="row.key" disabled placeholder="参数名称" />
                      <div class="api-type-field">
                        <button type="button" :class="['api-required-button', { active: row.required }]" disabled>*</button>
                        <el-select :model-value="row.paramType" disabled>
                          <el-option v-for="type in paramTypeOptions.filter(item => item !== 'file')" :key="type" :label="type" :value="type" />
                        </el-select>
                      </div>
                      <el-input :model-value="row.value" disabled placeholder="参数值" />
                      <div class="api-length-range">
                        <el-input-number :model-value="row.minLength" :controls="false" disabled placeholder="最小" />
                        <span>至</span>
                        <el-input-number :model-value="row.maxLength" :controls="false" disabled placeholder="最大" />
                      </div>
                      <el-switch :model-value="row.encode" size="small" disabled />
                      <el-input :model-value="row.description" disabled placeholder="描述" />
                    </div>
                    <div v-if="!viewingCaseDetail.requestConfig.queryParams.length" class="api-empty-body">暂无 Query 参数</div>
                  </div>
                </template>

                <template v-else-if="caseDetailRequestTab === 'body'">
                  <div class="api-body-section">
                    <div class="api-body-modes">
                      <button
                        v-for="mode in bodyModes"
                        :key="mode.value"
                        :class="['api-body-chip', { 'is-active': viewingCaseDetail.requestConfig.body.type === mode.value }]"
                        type="button"
                        disabled
                      >
                        {{ mode.label }}
                      </button>
                    </div>
                    <div :class="['api-body-editor', { 'is-empty': viewingCaseDetail.requestConfig.body.type === 'NONE', 'is-code': isRawBodyType(viewingCaseDetail.requestConfig.body.type) }]">
                      <div v-if="viewingCaseDetail.requestConfig.body.type === 'NONE'" class="api-empty-body">请求没有 Body</div>
                      <ApiCodeEditor
                        v-else-if="isRawBodyType(viewingCaseDetail.requestConfig.body.type)"
                        :model-value="caseDetailBodyRawText"
                        :language="caseDetailBodyLanguage"
                        read-only
                        :show-format-button="false"
                        height="300px"
                      />
                      <div v-else-if="['FORM_DATA', 'FORM_URLENCODED'].includes(viewingCaseDetail.requestConfig.body.type)" class="api-param-table is-body-form is-readonly">
                        <div class="api-param-header">
                          <span class="api-drag-cell"></span>
                          <span class="api-checkbox-cell"></span>
                          <span class="api-header-title">参数名称</span>
                          <span class="api-type-header">类型</span>
                          <span>参数值</span>
                          <span class="api-length-header">长度范围</span>
                          <span>描述</span>
                        </div>
                        <div v-for="(row, index) in viewingCaseDetail.requestConfig.body.formItems" :key="`case-body-${index}`" class="api-param-row">
                          <span class="api-drag-cell"></span>
                          <span class="api-checkbox-cell"><el-checkbox :model-value="row.enabled !== false" disabled /></span>
                          <el-input :model-value="row.key" disabled placeholder="参数名称" />
                          <div class="api-type-field">
                            <button type="button" :class="['api-required-button', { active: row.required }]" disabled>*</button>
                            <el-select :model-value="row.paramType" disabled>
                              <el-option v-for="type in paramTypeOptions" :key="type" :label="type" :value="type" />
                            </el-select>
                          </div>
                          <el-input :model-value="row.fileName || row.value" disabled placeholder="参数值" />
                          <div class="api-length-range">
                            <el-input-number :model-value="row.minLength" :controls="false" disabled placeholder="最小" />
                            <span>至</span>
                            <el-input-number :model-value="row.maxLength" :controls="false" disabled placeholder="最大" />
                          </div>
                          <el-input :model-value="row.description" disabled placeholder="描述" />
                        </div>
                        <div v-if="!viewingCaseDetail.requestConfig.body.formItems.length" class="api-empty-body">暂无表单参数</div>
                      </div>
                      <div v-else class="api-binary-panel is-readonly">
                        <div class="api-binary-row">
                          <div class="api-binary-label">File</div>
                          <div class="api-binary-actions">
                            <button type="button" class="api-binary-pick" disabled>{{ viewingCaseDetail.requestConfig.body.fileName ? '重新选择' : '选择文件' }}</button>
                            <button type="button" class="api-binary-clear" disabled>清空</button>
                          </div>
                        </div>
                        <div class="api-binary-row">
                          <div class="api-binary-label">已选文件</div>
                          <div class="api-binary-selected">
                            <template v-if="viewingCaseDetail.requestConfig.body.fileName">
                              <span class="api-binary-file-name">{{ viewingCaseDetail.requestConfig.body.fileName }}</span>
                              <span v-if="viewingCaseDetail.requestConfig.body.fileSize" class="api-binary-file-size">{{ formatFileSize(viewingCaseDetail.requestConfig.body.fileSize) }}</span>
                            </template>
                            <template v-else>尚未选择二进制文件</template>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else-if="caseDetailRequestTab === 'auth'">
                  <div class="api-auth-panel">
                    <span class="api-form-label">认证方式</span>
                    <el-radio-group :model-value="viewingCaseDetail.requestConfig.authConfig.authType" disabled>
                      <el-radio-button value="NONE">No Auth</el-radio-button>
                      <el-radio-button value="BASIC">Basic Auth</el-radio-button>
                      <el-radio-button value="DIGEST">Digest Auth</el-radio-button>
                    </el-radio-group>
                    <div v-if="viewingCaseDetail.requestConfig.authConfig.authType === 'BASIC'" class="api-auth-grid">
                      <label>Username</label>
                      <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.basicAuth?.userName" class="api-auth-form-control" disabled />
                      <label>Password</label>
                      <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.basicAuth?.password ? '已配置' : ''" class="api-auth-form-control" disabled />
                    </div>
                    <div v-else-if="viewingCaseDetail.requestConfig.authConfig.authType === 'DIGEST'" class="api-auth-grid">
                      <label>Username</label>
                      <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.digestAuth?.userName" class="api-auth-form-control" disabled />
                      <label>Password</label>
                      <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.digestAuth?.password ? '已配置' : ''" class="api-auth-form-control" disabled />
                    </div>
                  </div>
                </template>

                <template v-else-if="caseDetailRequestTab === 'settings'">
                  <div class="api-settings-panel is-readonly">
                    <label>用例名称</label>
                    <el-input :model-value="viewingCaseDetail.name" disabled />
                    <label>所属接口</label>
                    <el-input :model-value="viewingCaseDetail.definitionName" disabled />
                    <label>标签</label>
                    <el-input :model-value="formatCaseTags(viewingCaseDetail.tags)" disabled />
                    <label>超时时间</label>
                    <div class="api-settings-control-cell">
                      <el-input-number :model-value="viewingCaseDetail.requestConfig.timeoutMs" class="api-settings-timeout-number" disabled />
                    </div>
                    <label>描述</label>
                    <el-input :model-value="viewingCaseDetail.description || ''" type="textarea" :rows="4" disabled />
                    <div class="api-settings-footer">
                      <span>写入空间 {{ viewingCaseDetail.workspaceName || viewingCaseDetail.workspaceCode || '未选择' }}</span>
                      <span>最近结果 {{ runResultLabel(viewingCaseDetail.lastRunResult) }}</span>
                      <span>最后运行 {{ formatDateTime(viewingCaseDetail.lastRunAt) }}</span>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div class="request-section api-case-code-section">
                    <ApiCodeEditor
                      :model-value="caseDetailRequestTab === 'pre' ? toPrettyJson(viewingCaseDetail.preProcessors) : caseDetailRequestTab === 'post' ? toPrettyJson(viewingCaseDetail.postProcessors) : toPrettyJson(viewingCaseDetail.assertions)"
                      language="json"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                  </div>
                </template>
              </div>

              <div class="ms-like-response-shell case-drawer-response-shell">
                <div class="ms-like-response-header">
                  <div class="ms-like-response-title">响应内容</div>
                  <div v-if="caseDetailPreviewStep" class="ms-like-response-metrics">
                    <span v-if="caseDetailAssertionPresentation.visible" :class="['ms-like-result-pill', `is-${caseDetailAssertionPresentation.tone}`]">{{ caseDetailAssertionPresentation.label }}</span>
                    <span :class="['ms-like-response-metric', `is-${statusTone(caseDetailResponseStatus)}`]">状态 {{ caseDetailResponseStatus ?? '-' }}</span>
                    <span class="ms-like-response-metric">耗时 {{ caseDetailResponseDuration ?? '-' }}<template v-if="caseDetailResponseDuration !== null"> ms</template></span>
                    <span>大小 {{ caseDetailResponseSize }}</span>
                  </div>
                </div>
                <div v-if="!caseDetailPreviewStep" class="ms-like-response-empty">
                  <div class="ms-like-response-empty-card">
                    <div class="ms-like-response-empty-visual">
                      <div class="ms-like-response-empty-window"><span></span><span></span><span></span></div>
                    </div>
                    <div class="ms-like-response-empty-text">点击 <span>执行</span> 获取响应内容</div>
                  </div>
                </div>
                <template v-else>
                  <div class="ms-like-response-tabs">
                    <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'body' }]" @click="caseDetailResponseTab = 'body'">Body</button>
                    <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'header' }]" @click="caseDetailResponseTab = 'header'">Header</button>
                    <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'console' }]" @click="caseDetailResponseTab = 'console'">控制台</button>
                    <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'actualRequest' }]" @click="caseDetailResponseTab = 'actualRequest'">实际请求</button>
                    <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'assertions' }]" @click="caseDetailResponseTab = 'assertions'">断言</button>
                  </div>
                  <div class="ms-like-response-body">
                    <ApiCodeEditor
                      v-if="caseDetailResponseTab === 'body'"
                      :model-value="caseDetailResponseBody"
                      :language="caseDetailResponseBodyLanguage"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                    <ApiCodeEditor
                      v-else-if="caseDetailResponseTab === 'header'"
                      :model-value="caseDetailResponseHeaders"
                      language="json"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                    <ApiCodeEditor
                      v-else-if="caseDetailResponseTab === 'console'"
                      :model-value="caseDetailResponseConsole"
                      language="api-console"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                    <ApiCodeEditor
                      v-else-if="caseDetailResponseTab === 'actualRequest'"
                      :model-value="caseDetailActualRequest"
                      language="json"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                    <el-table v-else-if="caseDetailAssertionRows.length" :data="caseDetailAssertionRows" size="small" class="assertion-result-table">
                      <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
                      </el-table-column>
                      <el-table-column label="断言对象" width="96">
                        <template #default="{ row }">{{ assertionTypeLabel(row.type) }}</template>
                      </el-table-column>
                      <el-table-column label="条件" width="92">
                        <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
                      </el-table-column>
                      <el-table-column label="期望值" min-width="120" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.expectedValue || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="实际值" min-width="120" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.actualValue || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="结果" width="78">
                        <template #default="{ row }">
                          <span :class="['case-drawer-history-result', assertionResultClass(row.success)]">{{ assertionResultLabel(row.success) }}</span>
                        </template>
                      </el-table-column>
                      <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
                      </el-table-column>
                    </el-table>
                    <div v-else class="api-empty-body">当前请求未配置断言</div>
                  </div>
                </template>
              </div>
            </template>
            <div v-else class="api-empty-body">暂无用例详情</div>
          </div>

          <div v-else-if="caseDetailDrawerTab === 'history'" class="case-drawer-history-panel">
            <div v-if="caseRunHistoryErrorMessage" class="api-empty-body">{{ caseRunHistoryErrorMessage }}</div>
            <template v-else-if="caseHistoryView === 'list'">
              <div class="case-drawer-history-toolbar">
                <span class="case-drawer-history-limit-note">仅展示最近 10 次执行历史</span>
              </div>
              <div class="case-drawer-history-table-section" :style="{ height: `${caseRunHistoryTableHeight}px` }">
              <el-table
                v-loading="caseRunHistoryLoading"
                :data="caseRunHistories"
                size="small"
                class="case-drawer-history-table"
                :height="caseRunHistoryTableHeight"
                row-key="id"
                highlight-current-row
                @row-click="openCaseRunHistorySecondaryDetail"
              >
              <el-table-column label="执行时间" min-width="162" show-overflow-tooltip>
                <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column label="结果" width="78">
                <template #default="{ row }">
                  <span :class="['case-drawer-history-result', runResultClass(row.result)]">{{ runResultLabel(row.result) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态码" width="78" align="center">
                <template #default="{ row }">{{ row.statusCode ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="耗时" width="92">
                <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
              </el-table-column>
              <el-table-column label="大小" width="92">
                <template #default="{ row }">{{ formatResponseSize(row.responseSize) }}</template>
              </el-table-column>
              <el-table-column label="环境" min-width="108" show-overflow-tooltip>
                <template #default="{ row }">{{ row.environmentName || '默认' }}</template>
              </el-table-column>
              <el-table-column label="变量集" min-width="108" show-overflow-tooltip>
                <template #default="{ row }">{{ row.variableSetName || '未选择' }}</template>
              </el-table-column>
              <el-table-column label="执行人" min-width="96" show-overflow-tooltip>
                <template #default="{ row }">{{ row.operator || '-' }}</template>
              </el-table-column>
              <template #empty>
                <div class="case-drawer-history-table-empty">暂无执行历史</div>
              </template>
              </el-table>
              </div>
            </template>

            <div v-else class="ms-like-response-shell case-drawer-history-detail-shell" v-loading="caseRunHistoryDetailLoading">
              <div class="case-drawer-history-detail-nav">
                <button type="button" class="case-drawer-history-back" @click="backToCaseRunHistoryList">← 执行历史</button>
                <span v-if="selectedCaseRunHistoryDetail" class="case-drawer-history-detail-time">{{ formatDateTime(selectedCaseRunHistoryDetail.createdAt) }}</span>
              </div>
              <div class="ms-like-response-header">
                <div class="ms-like-response-title">历史详情</div>
                <div v-if="selectedCaseRunHistoryDetail" class="ms-like-response-metrics">
                  <span :class="['ms-like-result-pill', runResultClass(selectedCaseRunHistoryDetail.result)]">{{ runResultLabel(selectedCaseRunHistoryDetail.result) }}</span>
                  <span class="ms-like-response-metric">状态 {{ selectedCaseRunHistoryDetail.statusCode ?? '-' }}</span>
                  <span class="ms-like-response-metric">耗时 {{ formatDuration(selectedCaseRunHistoryDetail.durationMs) }}</span>
                  <span>大小 {{ formatResponseSize(selectedCaseRunHistoryDetail.responseSize) }}</span>
                </div>
              </div>
              <div v-if="caseRunHistoryDetailErrorMessage" class="api-empty-body">{{ caseRunHistoryDetailErrorMessage }}</div>
              <div v-else-if="!selectedCaseRunHistoryDetail" class="api-empty-body">选择一条执行记录查看详情</div>
              <div v-else-if="!selectedCaseRunHistoryDetail.stepResults.length" class="api-empty-body">该历史暂无步骤详情</div>
              <div v-else class="case-drawer-history-section">
                <div class="case-drawer-history-meta">
                  <span>执行环境 {{ selectedCaseRunHistoryDetail.environmentName || '默认' }}</span>
                  <span>变量集 {{ selectedCaseRunHistoryDetail.variableSetName || '未选择' }}</span>
                  <span>执行人 {{ selectedCaseRunHistoryDetail.operator || '-' }}</span>
                </div>

                <div class="case-drawer-history-step">
                  <div class="case-drawer-history-section-title">实际请求</div>
                  <div class="case-drawer-history-request-summary">
                    <span :class="['case-drawer-method-tag', `request-method-${String(selectedCaseHistoryStep?.request?.method || viewingCaseItem?.method || 'GET').toLowerCase()}`]">{{ selectedCaseHistoryStep?.request?.method || viewingCaseItem?.method || '-' }}</span>
                    <span>{{ selectedCaseHistoryStep?.request?.url || viewingCaseItem?.path || '-' }}</span>
                  </div>
                  <div class="ms-like-response-tabs case-drawer-history-request-tabs">
                    <button :class="['ms-like-top-tab', { active: caseHistoryRequestTab === 'header' }]" @click="caseHistoryRequestTab = 'header'">Header</button>
                    <button :class="['ms-like-top-tab', { active: caseHistoryRequestTab === 'body' }]" @click="caseHistoryRequestTab = 'body'">Body</button>
                  </div>
                  <div class="ms-like-response-body case-drawer-history-request-body">
                    <ApiCodeEditor
                      v-if="caseHistoryRequestTab === 'header'"
                      :model-value="caseHistoryRequestHeaders"
                      language="json"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                    <ApiCodeEditor
                      v-else
                      :model-value="caseHistoryRequestBody"
                      :language="caseHistoryRequestBodyLanguage"
                      read-only
                      :show-format-button="false"
                      fit-content
                      :max-fit-content-height="1000"
                      height="100%"
                    />
                  </div>
                </div>

                <div class="case-drawer-history-step">
                  <div class="case-drawer-history-section-title">响应结果</div>
                  <div v-if="caseHistoryDebugError" class="response-error-inline">{{ caseHistoryDebugError }}</div>
                  <div class="ms-like-response-tabs">
                    <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'body' }]" @click="caseHistoryResponseTab = 'body'">Body</button>
                    <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'header' }]" @click="caseHistoryResponseTab = 'header'">Header</button>
                    <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'console' }]" @click="caseHistoryResponseTab = 'console'">控制台</button>
                    <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'assertions' }]" @click="caseHistoryResponseTab = 'assertions'">断言</button>
                  </div>
                  <div class="ms-like-response-body">
                  <ApiCodeEditor
                    v-if="caseHistoryResponseTab === 'body'"
                    :model-value="caseHistoryResponseBody"
                    :language="caseHistoryResponseBodyLanguage"
                    read-only
                    :show-format-button="false"
                    fit-content
                    :max-fit-content-height="1000"
                    height="100%"
                  />
                  <ApiCodeEditor
                    v-else-if="caseHistoryResponseTab === 'header'"
                    :model-value="caseHistoryResponseHeaders"
                    language="json"
                    read-only
                    :show-format-button="false"
                    fit-content
                    :max-fit-content-height="1000"
                    height="100%"
                  />
                  <ApiCodeEditor
                    v-else-if="caseHistoryResponseTab === 'console'"
                    :model-value="caseHistoryConsole"
                    language="api-console"
                    read-only
                    :show-format-button="false"
                    fit-content
                    :max-fit-content-height="1000"
                    height="100%"
                  />
                  <el-table v-else-if="caseHistoryAssertionRows.length" :data="caseHistoryAssertionRows" size="small" class="assertion-result-table">
                    <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
                    </el-table-column>
                    <el-table-column label="断言对象" width="96">
                      <template #default="{ row }">{{ assertionTypeLabel(row.type) }}</template>
                    </el-table-column>
                    <el-table-column label="条件" width="92">
                      <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
                    </el-table-column>
                    <el-table-column label="期望值" min-width="120" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.expectedValue || '-' }}</template>
                    </el-table-column>
                    <el-table-column label="实际值" min-width="120" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.actualValue || '-' }}</template>
                    </el-table-column>
                    <el-table-column label="结果" width="78">
                      <template #default="{ row }">
                        <span :class="['case-drawer-history-result', assertionResultClass(row.success)]">{{ assertionResultLabel(row.success) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
                      <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
                    </el-table-column>
                  </el-table>
                  <div v-else class="api-empty-body">当前请求未配置断言</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="case-drawer-history-panel">
            <div class="api-empty-body">当前后端暂未提供接口用例变更历史接口，本轮不伪造变更记录。</div>
          </div>
    </ApiCaseDetailDrawer>

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
    <ApiFastExtractionDrawer
      v-model:visible="fastExtractionVisible"
      :response="latestResponseBody"
      :mode="fastExtractionMode"
      :config="fastExtractionConfig"
      @apply="applyFastExtraction"
    />
  </section>
</template>

<style scoped>
.api-interface-workspace {
  --api-workspace-font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Inter, Arial, sans-serif;

  display: flex;
  min-width: 0;
  height: calc(100dvh - 112px);
  min-height: 560px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: none;
  transform: translate(8px, -8px);
  width: calc(100% - 8px);
  font-family: var(--api-workspace-font-family);
}

.api-interface-workspace button,
.api-interface-workspace input,
.api-interface-workspace textarea,
.api-interface-workspace select {
  font-family: inherit;
}

.api-interface-workspace :deep(.el-button),
.api-interface-workspace :deep(.el-input__inner),
.api-interface-workspace :deep(.el-textarea__inner),
.api-interface-workspace :deep(.el-select),
.api-interface-workspace :deep(.el-select__placeholder),
.api-interface-workspace :deep(.el-select__selected-item),
.api-interface-workspace :deep(.el-dropdown-menu),
.api-interface-workspace :deep(.el-table) {
  font-family: inherit;
}

:global(.api-method-popper),
:global(.api-save-dropdown-menu),
:global(.api-soft-message-box),
:global(.el-dialog.api-import-dialog-shell),
:global(.el-dialog.api-soft-dialog-shell),
:global(.el-dialog.api-batch-dialog-shell),
:global(.api-case-detail-drawer),
:global(.api-ai-case-drawer),
:global(.el-dialog.api-ai-case-detail-dialog) {
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Inter, Arial, sans-serif;
}

:global(.api-method-popper .el-select-dropdown__item),
:global(.api-save-dropdown-menu .el-dropdown-menu__item),
:global(.api-soft-message-box .el-message-box__title),
:global(.api-soft-message-box .el-message-box__content),
:global(.api-soft-message-box .el-button),
:global(.el-dialog.api-import-dialog-shell .el-button),
:global(.el-dialog.api-import-dialog-shell .el-input__inner),
:global(.el-dialog.api-import-dialog-shell .el-upload),
:global(.el-dialog.api-soft-dialog-shell .el-button),
:global(.el-dialog.api-soft-dialog-shell .el-input__inner),
:global(.el-dialog.api-batch-dialog-shell .el-button),
:global(.api-case-detail-drawer .el-button),
:global(.api-case-detail-drawer .el-input__inner),
:global(.api-ai-case-drawer .el-button),
:global(.api-ai-case-drawer .el-input__inner),
:global(.api-ai-case-drawer .el-textarea__inner),
:global(.api-ai-case-drawer .el-select),
:global(.el-dialog.api-ai-case-detail-dialog .el-button) {
  font-family: inherit;
}

:global(.el-dialog.api-soft-dialog-shell .el-textarea__inner),
:global(.el-dialog.api-batch-dialog-shell .el-textarea__inner),
:global(.el-dialog.api-batch-dialog-shell code),
:global(.api-ai-case-drawer .api-ai-case-log),
:global(.el-dialog.api-ai-case-detail-dialog pre) {
  font-family: Consolas, Monaco, monospace;
}

.api-interface-tabs {
  display: flex;
  height: 48px;
  min-height: 48px;
  align-items: center;
  padding: 6px 24px;
  border-bottom: 1px solid var(--app-border);
  border-radius: 12px 12px 0 0;
  background: var(--app-bg-panel);
}

.api-interface-tab-nav {
  display: inline-flex;
  width: auto;
  height: 36px;
  flex: 0 0 auto;
  align-items: center;
  padding: 3px;
  border-radius: 10px;
  background: #f3f4f6;
}

.api-interface-tab {
  min-width: 64px;
  height: 30px;
  padding: 0 18px;
  border: 0;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 30px;
}

.api-interface-tab.is-active {
  background: #fff;
  color: var(--app-text-primary);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}

.api-interface-tab:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.api-interface-shell {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 272px minmax(0, 1fr);
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
  padding: 16px 16px 0;
  background: #fff;
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
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  background: #fff;
  color: var(--app-text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
}

.api-sidebar-primary,
.api-send-button {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: #fff;
}

.api-sidebar-secondary,
.api-curl-button {
  border-color: var(--app-border-strong);
  color: var(--app-text-secondary);
}

.api-sidebar-secondary:hover,
.api-curl-button:hover {
  background: #f9fafb;
  border-color: var(--app-border-strong);
  color: var(--app-text-primary);
}

.api-sidebar-primary:hover,
.api-send-button:hover {
  border-color: var(--app-primary-hover);
  background: var(--app-primary-hover);
}

.api-sidebar-primary:disabled,
.api-sidebar-secondary:disabled,
.api-send-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.api-sidebar-secondary:disabled:hover {
  border-color: var(--app-border-strong);
  background: #fff;
  color: var(--app-text-primary);
}

.api-sidebar-primary :deep(.el-icon),
.api-sidebar-secondary :deep(.el-icon),
.api-send-button :deep(.el-icon),
.api-curl-button :deep(.el-icon) {
  width: 16px;
  height: 16px;
  font-size: 16px;
}

.api-send-button__icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  stroke-width: 2.25;
}

.api-sidebar-button-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.api-sidebar-search {
  position: relative;
  padding: 12px 16px 0;
  background: #fff;
}

.api-sidebar-search :deep(.el-input__wrapper) {
  height: 38px;
  min-height: 38px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-sidebar-search :deep(.el-input__prefix) {
  color: var(--app-text-subtle);
}

.api-directory-title {
  display: flex;
  height: 40px;
  align-items: center;
  justify-content: space-between;
  margin: 12px 12px 0;
  padding: 0 4px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
  color: var(--app-text-secondary);
  font-size: 14px;
  font-weight: 600;
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
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.api-directory-title button:hover,
.api-editor-tab-add:hover,
.api-editor-tab-more:hover {
  background: var(--app-bg-page);
  color: var(--app-primary);
}

.api-editor-tab-add,
.api-editor-tab-more {
  width: 36px;
  height: 40px;
  border-radius: 0;
  color: #909399;
}

.api-directory-body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 8px 8px 12px;
  background: #fff;
}

.api-directory-error {
  margin: 12px 8px;
  padding: 10px;
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: 14px;
}

.api-directory-tree {
  background: transparent;
}

.api-directory-tree :deep(.el-tree-node__content) {
  min-height: 32px;
  height: auto;
  border-radius: var(--app-radius-md);
  transition: background-color 0.15s ease;
}

.api-directory-tree :deep(.el-tree-node__content:hover) {
  background: var(--app-bg-muted);
}

.api-directory-tree :deep(.el-tree-node__expand-icon.is-leaf) {
  color: transparent;
}

.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-soft);
}

.api-directory-node {
  display: flex;
  min-height: 30px;
  min-width: 0;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  line-height: 21px;
}

.api-directory-node__main {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.api-directory-node__actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.api-directory-node__action {
  display: inline-flex;
  width: 24px;
  height: 24px;
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

.api-directory-node__actions .api-directory-node__action {
  opacity: 1;
  pointer-events: auto;
}

.api-directory-node:hover .api-directory-node__actions,
.api-directory-node:focus-within .api-directory-node__actions,
.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content) .api-directory-node__actions {
  opacity: 1;
}

.api-directory-node__action:hover {
  background: #fff;
  color: var(--app-primary);
}

.api-directory-node__action.is-more {
  border-radius: 4px;
}

.api-directory-node__lucide-action {
  width: 15px;
  height: 15px;
  stroke-width: 2;
}

.api-directory-node__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #374151;
  font-size: 14px;
  line-height: 21px;
}

.api-directory-node__folder {
  display: inline-flex;
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
}

.api-directory-node__icon {
  width: 16px;
  height: 16px;
  color: #60a5fa;
}

.api-directory-node__folder.is-open .api-directory-node__icon {
  color: #3b82f6;
}

.api-directory-node__count {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: 16px;
}

.api-method {
  display: inline-flex;
  height: 18px;
  align-items: center;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.method-get { color: #15803d; }
.method-post { color: #ea580c; }
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
  box-sizing: border-box;
  height: 40px;
  min-height: 40px;
  align-items: center;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
  overflow: hidden;
}

.api-editor-tabs__nav {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 0 1 auto;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.api-editor-tabs__nav::-webkit-scrollbar {
  display: none;
}

.api-editor-tab {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  flex: 0 0 auto;
  max-width: 220px;
  height: 40px;
  min-height: 40px;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  border: 0;
  border-right: 1px solid var(--app-border);
  border-bottom: 3px solid transparent;
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: 14px;
  line-height: 20px;
}

.api-editor-tab:hover,
.api-editor-tab.is-active {
  background: #fff;
  color: var(--app-text-primary);
}

.api-editor-tab.is-active {
  border-bottom-color: var(--app-primary);
}

.api-editor-tab__label {
  display: inline-flex;
  height: 20px;
  align-items: center;
  min-width: 0;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-editor-tab__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--app-primary);
}

.api-editor-tab__close {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--app-text-subtle);
  opacity: 0;
  flex: 0 0 auto;
  transition: opacity 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.api-editor-tab.is-active .api-editor-tab__close {
  background: transparent;
  color: #667085;
  opacity: 0.42;
}

.api-editor-tab:hover .api-editor-tab__close {
  background: rgba(15, 23, 42, 0.08);
  color: #344054;
  opacity: 1;
}

.api-editor-tab__close :deep(.el-icon) {
  font-size: 14px;
  font-weight: 700;
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
  display: grid;
  grid-template-columns: minmax(320px, 1fr) 96px auto;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.api-url-compose {
  display: grid;
  min-width: 0;
  grid-template-columns: 104px minmax(0, 1fr) 68px;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: #fff;
}

.api-run-options {
  display: none;
}

.api-run-options .el-select {
  width: 160px;
}

.api-run-options :deep(.el-select__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
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
  min-height: 38px;
  border-radius: 0;
  font-size: 14px;
  line-height: 20px;
}

.api-method-select :deep(.el-select__wrapper) {
  min-height: 38px;
  padding: 0 10px;
  border-color: var(--app-border);
  border-style: solid;
  border-width: 0 1px 0 0;
  border-radius: var(--app-radius-md);
  background: #f9fafb;
  box-shadow: none;
  color: var(--app-text-primary);
}

.api-method-select :deep(.el-select__wrapper:hover),
.api-method-select :deep(.el-select__wrapper.is-focused),
.api-method-select.is-focus :deep(.el-select__wrapper) {
  border-color: var(--app-border);
  border-style: solid;
  border-width: 0 1px 0 0;
  background: #f9fafb;
  box-shadow: none;
  color: var(--app-text-primary);
}

.api-method-select {
  width: 104px;
  min-width: 104px;
  line-height: 21px;
}

.api-method-select :deep(.el-select__selected-item) {
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.api-method-option {
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.api-method-select.method-get :deep(.el-select__selected-item),
.api-method-select.method-get :deep(.el-select__placeholder) {
  color: #15803d;
}

.api-method-select.method-post :deep(.el-select__selected-item),
.api-method-select.method-post :deep(.el-select__placeholder) {
  color: #ea580c;
}

.api-method-select.method-put :deep(.el-select__selected-item),
.api-method-select.method-put :deep(.el-select__placeholder) {
  color: #2563eb;
}

.api-method-select.method-patch :deep(.el-select__selected-item),
.api-method-select.method-patch :deep(.el-select__placeholder),
.api-method-select.method-options :deep(.el-select__selected-item),
.api-method-select.method-options :deep(.el-select__placeholder) {
  color: #7c3aed;
}

.api-method-select.method-trace :deep(.el-select__selected-item),
.api-method-select.method-trace :deep(.el-select__placeholder) {
  color: #6b7280;
}

.api-method-select.method-head :deep(.el-select__selected-item),
.api-method-select.method-head :deep(.el-select__placeholder) {
  color: #15803d;
}

.api-method-select.method-delete :deep(.el-select__selected-item),
.api-method-select.method-delete :deep(.el-select__placeholder) {
  color: #dc2626;
}

:global(.api-method-popper .el-select-dropdown__item) {
  height: 34px;
  font-weight: 600;
  line-height: 34px;
}

:global(.api-method-popper .method-get) {
  color: #15803d;
}

:global(.api-method-popper .method-post) {
  color: #ea580c;
}

:global(.api-method-popper .method-put) {
  color: #2563eb;
}

:global(.api-method-popper .method-patch),
:global(.api-method-popper .method-options) {
  color: #7c3aed;
}

:global(.api-method-popper .method-trace) {
  color: #6b7280;
}

:global(.api-method-popper .method-head) {
  color: #15803d;
}

:global(.api-method-popper .method-delete) {
  color: #dc2626;
}

:global(.api-method-popper.el-select-dropdown) {
  border-radius: 4px;
}

.api-url-compose :deep(.el-input__wrapper) {
  padding-inline: 14px;
  box-shadow: none;
}

.api-url-compose :deep(.el-input__inner) {
  color: #111827;
}

.api-url-compose :deep(.el-input__inner::placeholder) {
  color: #9ca3af;
}

.api-curl-button {
  border-width: 0 0 0 1px;
  border-color: var(--app-border);
  color: var(--app-primary);
  font-size: 12px;
}

.api-send-button {
  width: 96px;
  min-width: 96px;
  height: 38px;
  padding: 0 16px;
}

.api-save-dropdown {
  width: 113px;
}

.api-save-dropdown :deep(.el-button),
.api-save-dropdown :deep(.el-button-group > .el-button) {
  height: 38px;
  border-color: var(--app-border-strong);
  background: #fff;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.api-save-dropdown :deep(.el-button-group > .el-button:first-child) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  padding: 0 14px;
}

.api-save-dropdown :deep(.el-button-group > .el-button:last-child) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  padding: 0 9px;
}

.api-save-dropdown :deep(.el-button:hover:not(.is-disabled)) {
  border-color: var(--app-text-subtle);
  background: var(--app-bg-page);
  color: var(--app-text-primary);
}

.api-save-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.api-button-icon {
  width: 16px;
  height: 16px;
}

:global(.api-save-dropdown-menu .el-dropdown-menu__item) {
  gap: 6px;
  min-height: 32px;
  padding: 5px 16px;
  color: #606266;
  font-size: 14px;
  line-height: 22px;
}

:global(.api-save-dropdown-menu .el-dropdown-menu) {
  min-width: 88px;
  padding: 5px 0;
  border-radius: 4px;
}

:global(.api-save-dropdown-menu .el-dropdown-menu__item:hover) {
  background: var(--app-bg-page);
  color: var(--app-text-primary);
}

:global(.api-save-dropdown-menu .el-dropdown-menu__item .el-icon) {
  width: 16px;
  height: 16px;
  font-size: 16px;
}

:global(.api-save-dropdown-menu .el-dropdown-menu__item.is-danger) {
  color: var(--app-danger);
}

:global(.api-save-dropdown-menu .el-dropdown-menu__item.is-danger:hover) {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-editor-scroll {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  background: #fff;
}

.api-content-tabs,
.api-response-tabs {
  display: flex;
  height: 46px;
  min-height: 46px;
  align-items: center;
  gap: 0;
  overflow: hidden;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.api-content-tab,
.api-response-tabs button {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  height: 45px;
  align-items: center;
  gap: 6px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  padding: 0 12px;
  white-space: nowrap;
}

.api-content-tab.is-active,
.api-response-tabs button.is-active {
  border-bottom-color: var(--app-primary);
  color: var(--app-primary);
  font-weight: 500;
}

.api-content-tab:not(.is-active):hover,
.api-response-tabs button:not(.is-active):hover {
  color: var(--app-text-secondary);
}

.api-content-tab.is-active::after,
.api-response-tabs button.is-active::after {
  content: none;
}

.api-response-tabs {
  height: 41px;
  min-height: 41px;
}

.api-response-tabs button {
  height: 41px;
}

.api-tab-badge {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
  padding: 0 5px;
}

.api-request-body {
  min-height: 362px;
  flex: 0 0 362px;
  overflow: auto;
  padding: 8px 16px 16px;
  border-bottom: 0;
  background: #fff;
}

.api-request-body.is-params,
.api-request-body.is-headers {
  min-height: 320px;
  flex-basis: 320px;
}

.api-request-body.is-pre,
.api-request-body.is-post,
.api-request-body.is-tests {
  min-height: 360px;
  flex: 0 0 auto;
  overflow: visible;
}

.api-request-body.is-settings {
  min-height: 320px;
  flex: 0 0 auto;
  overflow: visible;
}

.api-request-body.is-cases {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden auto;
  padding: 14px 16px;
}

.api-param-table {
  min-height: 296px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
}

.api-param-toolbar {
  display: flex;
  min-width: 0;
  height: 40px;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
}

.api-param-toolbar button,
.api-advanced-actions button,
.api-case-actions button {
  min-height: 28px;
  padding: 0 4px;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  white-space: nowrap;
}

.api-param-toolbar button:hover,
.api-advanced-actions button:hover,
.api-case-actions button:hover,
.api-row-remove:hover,
.api-add-row:hover {
  background: #eff6ff;
  color: var(--app-primary-hover);
}

.api-param-header,
.api-param-row {
  display: grid;
  width: 100%;
  min-width: 100%;
  grid-template-columns: 24px 32px 240px 150px 240px 200px 80px minmax(220px, 1fr) 90px;
  align-items: center;
  gap: 0;
  padding: 5px 10px 5px 0;
}

.api-param-table.is-header .api-param-header,
.api-param-table.is-header .api-param-row {
  min-width: 100%;
  grid-template-columns: 24px 32px repeat(3, minmax(0, 1fr)) 80px;
}

.api-param-table.is-body-form .api-param-header,
.api-param-table.is-body-form .api-param-row {
  min-width: 100%;
  grid-template-columns: 24px 32px 240px 150px 240px 200px minmax(220px, 1fr) 90px;
}

.api-param-header {
  box-sizing: border-box;
  height: 40px;
  min-height: 40px;
  padding: 0 10px 0 0;
  background: #f9fafb;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.api-param-row {
  min-height: 44px;
  border-bottom: 1px solid var(--app-border-soft);
  transition: background-color 0.15s ease;
}

.api-param-row:hover {
  background: #fbfdff;
}

.api-drag-cell,
.api-checkbox-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
}

.api-drag-handle {
  display: grid;
  width: 14px;
  height: 19px;
  align-content: center;
  justify-content: center;
  grid-template-columns: repeat(2, 3px);
  grid-template-rows: repeat(3, 3px);
  gap: 2px;
}

.api-drag-dot {
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: #c0c4cc;
}

.api-param-row:hover .api-drag-dot {
  background: #9ca3af;
}

.api-header-title {
  display: inline-flex;
  align-items: center;
  padding-left: 0;
}

.api-type-header {
  padding-left: 30px;
}

.api-length-header {
  padding-left: 22px;
}

.api-type-field {
  display: grid;
  min-width: 0;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}

@media (max-width: 1480px) {
  .api-param-header,
  .api-param-row {
    grid-template-columns: 24px 28px 220px 140px 220px 180px 72px minmax(180px, 1fr) 72px;
  }

  .api-param-table.is-header .api-param-header,
  .api-param-table.is-header .api-param-row {
    grid-template-columns: 24px 28px repeat(3, minmax(0, 1fr)) 64px;
  }

  .api-param-table.is-body-form .api-param-header,
  .api-param-table.is-body-form .api-param-row {
    grid-template-columns: 24px 28px 220px 140px 220px 180px minmax(180px, 1fr) 72px;
  }
}

.api-required-button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.api-required-button.active {
  background: #fff1f3;
  color: #f04438;
}

.api-link-button {
  justify-self: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.api-param-row:last-of-type {
  border-bottom: 0;
}

.api-param-row :deep(.el-input__wrapper),
.api-param-row :deep(.el-select__wrapper),
.api-param-row :deep(.el-input-number) {
  min-height: 28px;
  border-radius: 6px;
  background: transparent;
  box-shadow: inset 0 0 0 1px transparent;
}

.api-param-row :deep(.el-input) {
  height: 30px;
}

.api-param-row :deep(.el-input__wrapper) {
  height: 30px;
}

.api-param-row :deep(.el-input__wrapper:hover),
.api-param-row :deep(.el-select__wrapper:hover) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #d0d5dd;
}

.api-param-row :deep(.el-input.is-focus .el-input__wrapper),
.api-param-row :deep(.el-select.is-focus .el-select__wrapper),
.api-param-row :deep(.el-select__wrapper.is-focused) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #3b82f6;
}

.api-param-row :deep(.el-input__inner),
.api-param-row :deep(.el-select__placeholder),
.api-param-row :deep(.el-select__selected-item) {
  font-size: 12px;
}

.api-length-range {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-length-range :deep(.el-input-number) {
  width: 100%;
}

.api-length-range :deep(.el-input-number__increase),
.api-length-range :deep(.el-input-number__decrease) {
  display: none;
}

.api-length-range :deep(.el-input-number .el-input__wrapper) {
  padding: 0 8px;
}

.api-row-remove,
.api-add-row {
  min-height: 17px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
}

.api-row-remove {
  justify-self: center;
  width: auto;
  min-width: 0;
}

.api-add-row {
  height: 37px;
  padding: 9px 10px 11px;
}

.api-row-remove,
.api-case-actions .is-danger {
  color: #ef4444;
}

.api-row-remove:hover,
.api-case-actions .is-danger:hover {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-body-section {
  display: flex;
  min-height: 300px;
  flex-direction: column;
}

.api-body-modes {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
}

.api-body-chip {
  height: 24px;
  padding: 0 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: var(--app-text-muted);
  cursor: pointer;
  font-family: Arial, sans-serif;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.api-body-chip.is-active {
  border-color: #3b82f6;
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

.api-body-editor.is-code {
  border: 0;
  border-radius: 0;
  background: transparent;
}

.api-body-editor.is-empty {
  border: 0;
  border-radius: var(--app-radius-sm);
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
  width: 100%;
  min-height: 300px;
  border: 0;
  border-radius: var(--app-radius-sm);
  font-size: 13px;
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

.api-cases-panel,
.api-assertion-panel,
.api-extractor-panel,
.api-processor-panel {
  min-height: 0;
}

.api-assertion-panel,
.api-extractor-panel,
.api-processor-panel {
  padding-bottom: 2px;
}

.api-processor-panel {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
}

.api-processor-panel .api-advanced-toolbar,
.api-processor-panel .api-processor-list {
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.api-processor-panel .api-advanced-toolbar {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 0;
}

.api-processor-panel .api-advanced-toolbar > div:first-child {
  display: none;
}

.api-processor-panel .api-advanced-toolbar .el-dropdown {
  display: flex;
  width: 100%;
  height: 48px;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-processor-panel .api-advanced-toolbar .api-sidebar-primary {
  width: auto;
  height: 32px;
  padding: 0 16px;
  border-radius: var(--app-radius-md);
  font-size: 0;
}

.api-processor-panel .api-advanced-toolbar .api-sidebar-primary::after {
  content: "添加";
  font-size: 13px;
  font-weight: 500;
}

.api-processor-panel .api-advanced-toolbar::after {
  content: "暂无处理器";
  position: absolute;
  inset: 48px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-processor-panel .api-processor-list {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.api-processor-panel .api-processor-list > .api-empty-body {
  min-height: 100%;
  background: transparent;
  color: transparent;
}

.api-processor-panel .api-processor-list > .api-empty-body::after {
  content: "请选择一个处理器进行编辑";
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-assertion-panel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
}

.api-assertion-panel .api-advanced-toolbar,
.api-assertion-panel > .api-empty-body {
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.api-assertion-panel .api-advanced-toolbar {
  position: relative;
  display: block;
  padding: 0;
}

.api-assertion-panel .api-advanced-toolbar > div:first-child {
  display: none;
}

.api-assertion-panel .api-advanced-toolbar::before {
  content: "";
  position: absolute;
  top: 48px;
  right: 0;
  left: 0;
  border-top: 1px solid var(--app-border-soft);
}

.api-assertion-panel .api-advanced-toolbar::after {
  content: "暂无断言";
  position: absolute;
  inset: 48px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-assertion-panel .api-advanced-actions {
  display: block;
}

.api-assertion-panel .api-advanced-actions > .el-dropdown:not(:last-child) {
  display: none;
}

.api-assertion-panel .api-advanced-actions > .el-dropdown:last-child {
  position: absolute;
  top: 6px;
  left: 12px;
}

.api-assertion-panel .api-advanced-actions > button:first-child {
  position: absolute;
  bottom: 4px;
  left: 6px;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 500;
}

.api-assertion-panel .api-advanced-actions .api-sidebar-primary {
  height: 32px;
  padding: 0 16px;
  border-radius: var(--app-radius-md);
  font-size: 13px;
  font-weight: 500;
}

.api-assertion-panel > .api-empty-body {
  min-height: 360px;
  background: #fff;
  color: transparent;
}

.api-assertion-panel > .api-empty-body::after {
  content: "请选择一个断言进行编辑";
  display: flex;
  width: calc(100% - 24px);
  height: calc(100% - 24px);
  align-items: center;
  justify-content: center;
  background: var(--app-bg-page);
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-auth-grid,
.api-settings-panel {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.api-settings-panel {
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
}

.api-settings-panel > label {
  display: flex;
  min-height: 0;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.api-settings-panel > .el-input,
.api-settings-panel > .el-input-number,
.api-settings-panel > .el-textarea {
  min-height: 0;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-settings-panel > .el-input-number {
  width: 100%;
}

.api-settings-panel > .api-settings-control-cell {
  display: flex;
  min-height: 0;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-settings-panel :deep(.el-input-number) {
  width: 100%;
}

.api-settings-timeout-number {
  width: 100%;
  line-height: 32px;
}

.api-settings-timeout-number :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-settings-timeout-number :deep(.el-input__inner) {
  text-align: center;
}

.api-settings-timeout-number :deep(.el-input__wrapper:hover) {
  box-shadow: inset 0 0 0 1px var(--app-text-subtle);
}

.api-settings-timeout-number :deep(.el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.api-assertion-form-row :deep(.el-input-number__increase),
.api-assertion-form-row :deep(.el-input-number__decrease),
.api-processor-form-grid :deep(.el-input-number__increase),
.api-processor-form-grid :deep(.el-input-number__decrease),
.api-processor-form-row :deep(.el-input-number__increase),
.api-processor-form-row :deep(.el-input-number__decrease) {
  width: 24px;
  height: 16px;
  line-height: 16px;
  color: var(--app-text-muted);
  font-size: 10px;
}

.api-settings-timeout-number :deep(.el-input-number__decrease),
.api-settings-timeout-number :deep(.el-input-number__increase) {
  top: 1px;
  width: 32px;
  height: 30px;
  border-color: var(--app-border);
  background: var(--app-bg-panel);
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 30px;
}

.api-settings-timeout-number :deep(.el-input-number__decrease) {
  left: 1px;
  right: auto;
  border-radius: 7px 0 0 7px;
}

.api-settings-timeout-number :deep(.el-input-number__increase) {
  right: 1px;
  left: auto;
  border-radius: 0 7px 7px 0;
}

.api-settings-timeout-number :deep(.el-input-number__decrease:hover),
.api-settings-timeout-number :deep(.el-input-number__increase:hover) {
  background: var(--app-bg-page);
  color: var(--app-primary);
}

.api-settings-panel > label:nth-of-type(5) {
  align-items: flex-start;
  padding-top: 18px;
}

.api-settings-panel > .el-textarea {
  min-height: 104px;
}

.api-settings-footer {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 18px;
  border-top: 1px solid var(--app-border-soft);
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.api-auth-grid label,
.api-settings-panel label,
.api-form-label {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-auth-form-control {
  width: min(100%, 450px);
}

.api-auth-form-control :deep(.el-input__wrapper) {
  min-height: 34px;
  border-radius: var(--app-radius-md);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-auth-form-control :deep(.el-input__wrapper:hover) {
  box-shadow: inset 0 0 0 1px var(--app-text-subtle);
}

.api-auth-form-control :deep(.el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.api-binary-hint {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
}

.api-binary-panel {
  display: block;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
}

.api-binary-row {
  display: grid;
  min-height: 0;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-binary-row:last-child {
  min-height: 0;
  border-bottom: 0;
}

.api-binary-label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.api-binary-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.api-binary-pick,
.api-binary-clear {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 15px;
  border: 1px solid var(--app-border-strong);
  border-radius: 4px;
  background: #fff;
  color: var(--app-text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.api-binary-pick input {
  display: none;
}

.api-binary-pick:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.api-binary-clear:disabled {
  border-color: var(--app-border-soft);
  background: var(--app-bg-muted);
  color: var(--app-text-subtle);
  cursor: not-allowed;
}

.api-binary-selected {
  display: flex;
  min-height: 0;
  min-width: 0;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-binary-file-name {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-binary-file-size {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 12px;
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

.api-cases-panel {
  position: relative;
  display: block;
  min-height: 362px;
}

.api-cases-toolbar {
  justify-content: flex-start;
  margin-bottom: 14px;
}

.api-cases-toolbar > span,
.api-cases-ai-entry > span {
  display: none;
}

.api-cases-ai-entry,
.api-cases-toolbar__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.api-cases-ai-entry {
  position: absolute;
  top: 2px;
  left: 94px;
  justify-content: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
}

.api-cases-panel > .api-empty-body {
  min-height: 58px;
  margin-top: 14px;
  border: 1px dashed var(--app-border-strong);
  border-radius: var(--app-radius-lg);
  background: #fff;
  color: var(--app-text-subtle);
  font-size: 13px;
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

.api-case-drawer-header {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.api-case-drawer-header strong {
  color: var(--app-text-primary);
  font-size: 16px;
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
  gap: 12px;
  padding: 14px 18px 18px;
}

.api-case-drawer-tabs {
  display: block;
  min-width: 0;
}

.api-case-detail-panel {
  display: grid;
  gap: 12px;
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
  padding: 9px 10px;
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
  gap: 7px;
  min-width: 0;
  padding: 9px 10px;
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
  grid-template-columns: 216px minmax(0, 1fr);
  gap: 12px;
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

.case-list-request-body {
  display: flex;
  min-height: 0;
  padding: 0;
}

.case-list-panel {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.case-list-panel .editor-actions.left {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.case-ai-generate-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 30px;
}

.case-ai-generate-button:hover:not(:disabled) {
  border-color: #2563eb;
  color: #2563eb;
}

.case-ai-generate-button:disabled {
  border-color: #e5e7eb;
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.case-ai-generate-button .el-icon {
  width: 14px;
  height: 14px;
  font-size: 14px;
}

.case-list-panel .empty-hint {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: center;
  margin-top: 14px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #9ca3af;
  font-size: 13px;
}

.case-list-table-wrap {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.case-list-table :deep(.el-table__header th) {
  height: 38px;
  background: #f9fafb;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}

.case-list-table :deep(.el-table__row td) {
  height: 42px;
  color: #374151;
  font-size: 13px;
}

.case-list-operation-header,
.case-list-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}

.case-list-settings-trigger {
  width: 24px;
  height: 24px;
  padding: 0;
  color: #6b7280;
}

.case-list-action-button,
.case-list-more-button,
.case-drawer-history-detail-button {
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 500;
}

.case-list-more-button {
  width: 26px;
  padding: 0;
}

.case-list-menu-item {
  height: 32px;
  font-size: 13px;
}

.case-list-menu-item.is-danger {
  color: #dc2626;
}

.case-list-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-top: 1px solid #f3f4f6;
  background: #fff;
}

.case-list-pagination-summary {
  color: #6b7280;
  font-size: 12px;
}

:global(.api-case-drawer-modal) {
  background: rgba(15, 23, 42, 0.28);
}

.case-drawer-history-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  min-height: 420px;
}

.ms-like-top-tabs,
.ms-like-response-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  height: 40px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.ms-like-top-tabs::-webkit-scrollbar,
.ms-like-response-tabs::-webkit-scrollbar {
  display: none;
}

.ms-like-top-tab {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
}

.ms-like-top-tab:hover {
  color: #111827;
}

.ms-like-top-tab.active {
  border-bottom-color: #2563eb;
  color: #2563eb;
  font-weight: 600;
}

.ms-like-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: 5px;
  padding: 0 5px;
  border-radius: 999px;
  background: #eef2ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
}

.ms-like-response-shell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.ms-like-response-header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 0;
}

.ms-like-response-title {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.ms-like-response-metrics {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.ms-like-response-metric,
.ms-like-result-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #667085;
  font-size: 12px;
  font-weight: 600;
}

.ms-like-result-pill.is-success,
.ms-like-result-pill.is-passed,
.ms-like-response-metric.is-success {
  background: #f0fdf4;
  color: #16a34a;
}

.ms-like-result-pill.is-failed,
.ms-like-response-metric.is-danger {
  background: #fef2f2;
  color: #dc2626;
}

.ms-like-response-metric.is-warning {
  background: #fff7ed;
  color: #ea580c;
}

.ms-like-response-body {
  min-width: 0;
  padding: 10px 0 12px;
}

.ms-like-response-empty {
  padding: 18px 0 20px;
}

.ms-like-response-empty-card {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 116px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.ms-like-response-empty-window {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 58px;
  height: 36px;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.ms-like-response-empty-window span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #9ca3af;
}

.ms-like-response-empty-text {
  color: #6b7280;
  font-size: 13px;
}

.ms-like-response-empty-text span {
  color: #2563eb;
  font-weight: 600;
}

.api-case-readonly-body {
  padding: 0;
}

.api-case-readonly-body .api-param-table {
  margin: 0;
}

.api-case-readonly-body .api-param-table.is-readonly .api-param-row {
  cursor: default;
}

.api-case-readonly-body .api-param-table.is-readonly :deep(.el-input__wrapper),
.api-case-readonly-body .api-param-table.is-readonly :deep(.el-select__wrapper) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.api-case-readonly-body .api-body-chip:disabled {
  cursor: default;
  opacity: 1;
}

.api-case-readonly-body .api-body-chip.is-active:disabled {
  color: #2563eb;
  border-color: #93c5fd;
  background: #eff6ff;
}

.api-case-code-section {
  min-height: 260px;
}

.case-drawer-history-toolbar,
.case-drawer-history-detail-nav {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.case-drawer-history-limit-note,
.case-drawer-history-detail-time {
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.case-drawer-history-back {
  display: inline-flex;
  height: 30px;
  align-items: center;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.case-drawer-history-back:hover,
.case-drawer-history-back:focus-visible {
  background: #eff6ff;
  color: #1d4ed8;
}

.case-drawer-history-table-section {
  position: relative;
  z-index: 1;
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
  contain: layout paint;
}

.case-drawer-history-table {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.case-drawer-history-table :deep(.el-table__header th) {
  height: 38px;
  background: #f9fafb;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}

.case-drawer-history-table :deep(.el-table__row td) {
  height: 42px;
  font-size: 13px;
}

.case-drawer-history-result {
  display: inline-flex;
  min-width: 44px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.case-drawer-history-result.is-passed {
  background: #f0fdf4;
  color: #16a34a;
}

.case-drawer-history-result.is-failed {
  background: #fef2f2;
  color: #dc2626;
}

.case-drawer-history-result.is-neutral {
  background: #f3f4f6;
  color: #6b7280;
}

.case-drawer-history-detail-shell,
.case-drawer-response-shell {
  min-height: 260px;
}

.case-drawer-history-detail-shell {
  position: relative;
  z-index: 0;
  margin-top: 2px;
  background: #fff;
}

.case-drawer-history-section,
.case-drawer-history-step {
  display: grid;
  gap: 10px;
}

.case-drawer-history-meta,
.case-drawer-history-request-summary {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.case-drawer-history-request-summary {
  color: #374151;
  font-size: 13px;
}

.case-drawer-history-request-summary > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.response-error-inline {
  padding: 8px 10px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 12px;
  line-height: 18px;
}

.case-drawer-history-section-title {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.case-drawer-history-table-empty {
  padding: 28px 0;
  color: #9ca3af;
  font-size: 13px;
}

.api-ai-case-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 14px 18px;
  border-bottom: 1px solid var(--app-border);
}

.api-ai-case-drawer :deep(.el-drawer__body) {
  padding: 0;
  background: var(--app-bg-panel);
}

.api-ai-case-body {
  display: grid;
  gap: 12px;
  padding: 14px 18px 18px;
}

.api-ai-case-section {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
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
  padding: 7px 10px;
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
  gap: 7px;
  min-width: 0;
  padding: 9px 10px;
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

.api-ai-case-detail-dialog :deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;
}

.api-ai-case-detail-dialog :deep(.el-dialog__header) {
  display: flex;
  align-items: center;
  min-height: 56px;
  margin-right: 0;
  padding: 0 20px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-ai-case-detail-dialog :deep(.el-dialog__title) {
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 700;
}

.api-ai-case-detail-dialog :deep(.el-dialog__headerbtn) {
  top: 12px;
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
  min-height: 38px;
  padding: 8px 10px;
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
  border-radius: var(--app-radius-md);
  background: #fff;
}

.api-assertion-header,
.api-assertion-row {
  display: grid;
  min-width: 920px;
  grid-template-columns: 64px 1.1fr 140px 130px 1fr 1fr 64px;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
}

.api-assertion-header {
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-assertion-row {
  min-height: 40px;
  border-top: 1px solid var(--app-border-soft);
}

.api-assertion-editor {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.api-assertion-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  overflow-x: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-xs);
}

.api-assertion-batch-link {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  white-space: nowrap;
}

.api-assertion-batch-link:hover {
  border-color: var(--app-primary);
  background: #eff6ff;
  color: var(--app-primary-hover);
}

.api-assertion-empty {
  display: flex;
  min-height: 160px;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: 13px;
  font-weight: 400;
}

.api-assertion-list > .api-assertion-empty {
  margin: 8px;
}

.api-assertion-empty--inline {
  min-height: 100%;
}

.api-assertion-list-item {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: calc(100% - 16px);
  margin: 0 8px 6px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.api-assertion-list-item:hover {
  background: var(--app-bg-page);
}

.api-assertion-list-item.is-active {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.api-assertion-list-item__main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
}

.api-assertion-list-copy {
  min-width: 0;
}

.api-assertion-list-title,
.api-assertion-list-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-assertion-list-title {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.api-assertion-list-meta {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 16px;
}

.api-assertion-list-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.api-assertion-ghost-action {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.api-assertion-ghost-action:hover:not(:disabled) {
  color: var(--app-text-primary);
}

.api-assertion-ghost-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.api-assertion-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  overflow-x: hidden;
  overflow-y: visible;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-xs);
}

.api-assertion-detail-header,
.api-assertion-detail-fields,
.api-assertion-detail-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-assertion-detail-header {
  justify-content: space-between;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-assertion-detail-fields {
  flex: 1;
  min-width: 280px;
}

.api-assertion-detail-fields :deep(.el-input) {
  flex: 1;
}

.api-assertion-detail-fields :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-assertion-detail-actions button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 0;
}

.api-assertion-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 12px;
}

.api-assertion-form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 400;
}

.api-assertion-form-grid :deep(.el-input__wrapper),
.api-assertion-form-grid :deep(.el-select__wrapper),
.api-assertion-form-row :deep(.el-input__wrapper),
.api-assertion-item-row :deep(.el-input__wrapper),
.api-assertion-item-row :deep(.el-select__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-assertion-form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-assertion-form-label {
  min-width: 72px;
}

.api-assertion-form-row :deep(.el-input-number) {
  width: 150px;
}

.api-assertion-type-panel {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
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
  font-weight: 500;
  white-space: nowrap;
}

.api-assertion-item-list {
  display: grid;
  gap: 0;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.api-assertion-item-row {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 6px 10px;
  border: 0;
  border-bottom: 1px solid var(--app-border-soft);
  border-radius: 0;
  background: var(--app-bg-panel);
}

.api-assertion-item-row:hover {
  background: var(--app-bg-page);
}

.api-assertion-item-row:last-child {
  border-bottom: 0;
}

.api-assertion-item-row.is-header {
  min-width: 720px;
  grid-template-columns: auto minmax(160px, 1fr) 170px minmax(160px, 1fr) auto auto;
}

.api-assertion-item-row.is-body {
  min-width: 820px;
  grid-template-columns: auto minmax(200px, 1.3fr) 170px minmax(160px, 1fr) auto auto auto;
}

.api-fast-extraction-suffix-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #165dff;
  cursor: pointer;
}

.api-fast-extraction-suffix-button:hover:not(:disabled) {
  background: #eff6ff;
}

.api-fast-extraction-suffix-button .el-icon {
  width: 16px;
  height: 16px;
  font-size: 16px;
}

.api-fast-extraction-suffix-button.is-disabled,
.api-fast-extraction-suffix-button:disabled {
  background: transparent;
  color: #c9cdd4;
  cursor: not-allowed;
}

.api-assertion-item-row.is-variable {
  min-width: 640px;
  grid-template-columns: 48px minmax(140px, 1fr) 132px minmax(120px, 1fr) repeat(2, auto);
}

.api-assertion-item-row .api-row-remove {
  color: var(--app-danger);
}

.api-assertion-add-row {
  align-self: flex-start;
  width: fit-content;
  margin: 6px 10px 8px 196px;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 700;
  white-space: nowrap;
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
  padding: 6px 10px;
}

.api-extractor-header {
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-extractor-row {
  min-height: 40px;
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

.api-assertion-panel {
  grid-template-columns: 1fr;
}

.api-assertion-panel:has(.api-assertion-editor) > .api-advanced-toolbar {
  display: none;
}

.api-assertion-toolbar {
  display: flex;
  height: 48px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
}

.api-assertion-toolbar + .api-assertion-list-item {
  margin-top: 8px;
}

.api-processor-panel {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.api-processor-panel > .api-advanced-toolbar {
  display: none;
}

.api-processor-editor {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
  color: var(--app-text-primary);
}

.api-processor-sidebar,
.api-processor-detail {
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-xs);
}

.api-processor-sidebar {
  display: flex;
  flex-direction: column;
}

.api-processor-toolbar {
  display: flex;
  height: 48px;
  align-items: center;
  justify-content: flex-start;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
}

.api-legacy-primary {
  height: 32px;
  padding: 0 16px;
  border: 1px solid var(--app-primary);
  border-radius: var(--app-radius-md);
  background: var(--app-primary);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.api-legacy-primary:hover {
  border-color: var(--app-primary-hover);
  background: var(--app-primary-hover);
}

.api-processor-sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  overflow-x: hidden;
}

.api-processor-list-item {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.api-processor-list-item:hover {
  background: var(--app-bg-page);
}

.api-processor-list-item.is-active {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.api-processor-list-item__main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.api-processor-list-copy {
  min-width: 0;
}

.api-processor-list-title,
.api-processor-list-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-processor-list-title {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.api-processor-list-meta,
.api-processor-form-label,
.api-processor-hint,
.api-processor-form-grid span {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 16px;
}

.api-processor-list-actions,
.api-processor-detail-actions,
.api-processor-detail-fields,
.api-processor-detail-header,
.api-processor-form-row,
.api-processor-editor-actions,
.api-assertion-editor-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-processor-list-actions {
  gap: 4px;
}

.api-processor-list-actions :deep(.el-button) {
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  color: var(--app-text-muted);
}

.api-processor-list-actions :deep(.el-button:hover) {
  color: var(--app-primary);
  background: transparent;
}

.api-processor-list-actions :deep(.el-button.is-disabled) {
  color: var(--app-text-subtle);
  background: transparent;
}

.api-processor-detail-actions button,
.api-processor-editor-actions button,
.api-assertion-editor-actions button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 0;
}

.api-processor-editor-actions button,
.api-assertion-editor-actions button {
  height: 32px;
  padding: 0 16px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
}

.api-processor-editor-actions button:hover,
.api-assertion-editor-actions button:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
  background: var(--app-bg-panel);
}

.api-processor-list-actions button:disabled {
  color: var(--app-text-subtle);
  cursor: not-allowed;
}

.api-processor-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-x: hidden;
  overflow-y: visible;
  padding: 12px;
}

.api-processor-detail-header {
  justify-content: space-between;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-processor-detail-fields {
  flex: 1;
  min-width: 280px;
}

.api-processor-detail-fields :deep(.el-input) {
  flex: 1;
}

.api-processor-detail-fields :deep(.el-input__wrapper),
.api-processor-form-grid :deep(.el-input__wrapper),
.api-processor-form-grid :deep(.el-select__wrapper),
.api-processor-extract-row :deep(.el-input__wrapper),
.api-processor-extract-row :deep(.el-select__wrapper),
.api-sql-extract-table__row :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-processor-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.api-processor-form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.api-processor-form-grid :deep(.el-input-number) {
  width: 100%;
}

.api-processor-form-grid :deep(.el-input-number .el-input__wrapper) {
  min-height: 32px;
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-processor-language-tag {
  display: inline-flex;
  height: 24px;
  align-items: center;
  padding: 0 8px;
  border: 1px solid #bfdbfe;
  border-radius: var(--app-radius-sm);
  background: #eff6ff;
  color: var(--app-primary);
  font-size: 12px;
  font-weight: 600;
}

.api-processor-empty {
  display: flex;
  min-height: 240px;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-processor-empty--inline {
  min-height: 160px;
  border: 1px dashed var(--app-border-strong);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-page);
}

.api-processor-card {
  display: grid;
  gap: 7px;
  padding: 9px 10px;
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
  gap: 8px 10px;
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
  font-weight: 500;
  white-space: nowrap;
}

.api-processor-extract-scroll {
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  scrollbar-width: thin;
  scrollbar-color: #d7dbe3 transparent;
}

.api-processor-extract-scroll::-webkit-scrollbar {
  height: 6px;
}

.api-processor-extract-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.api-processor-extract-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background-color: #d7dbe3;
}

.api-processor-extract-scroll::-webkit-scrollbar-thumb:hover {
  background-color: #d7dbe3;
}

.api-processor-extract-grid {
  width: max-content;
  min-width: 100%;
  overflow: visible;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.api-processor-extract-header,
.api-processor-extract-row {
  display: grid;
  grid-template-columns: 150px 150px 130px 110px 96px 220px 56px;
  align-items: start;
  gap: 8px;
  padding: 8px 12px;
}

.api-processor-extract-header {
  min-height: 40px;
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.api-processor-extract-row {
  min-height: 48px;
  border-top: 1px solid var(--app-border-soft);
}

.api-processor-extract-row:hover {
  background: var(--app-bg-page);
}

.api-processor-extract-row .api-row-remove {
  color: var(--app-danger);
}

.api-processor-extract-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 56px;
  min-height: 32px;
  white-space: nowrap;
}

.api-processor-extract-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: var(--app-radius-sm);
}

.api-processor-extract-more .el-icon {
  width: 16px;
  height: 16px;
  font-size: 16px;
}

.api-processor-extract-delete {
  min-width: 28px;
}

.api-processor-extract-more-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.api-processor-extract-copy {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.api-processor-extract-more-divider {
  height: 1px;
  background: var(--app-border-soft);
}

.api-processor-extract-more-title {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 700;
}

.api-processor-extract-more-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.api-processor-extract-more-label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.api-sql-extract-table {
  display: grid;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.api-sql-extract-table__header,
.api-sql-extract-table__row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) 72px;
  align-items: center;
  gap: 8px;
}

.api-sql-extract-table__header {
  min-height: 34px;
  padding: 0 10px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.api-sql-extract-table__row {
  min-height: 42px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-sql-extract-table__row .api-row-remove,
.api-sql-extract-table__add {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.api-sql-extract-table__row .api-row-remove {
  color: var(--app-danger);
}

.api-sql-extract-table__add {
  justify-self: start;
  min-height: 34px;
  padding: 0 10px;
}

.api-wait-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.api-assertion-panel .api-advanced-actions .api-sidebar-primary {
  min-height: 32px;
  padding: 0 16px;
  border: 1px solid var(--app-primary);
  border-radius: var(--app-radius-md);
  background: var(--app-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.api-assertion-panel .api-advanced-actions .api-sidebar-primary:hover {
  border-color: var(--app-primary-hover);
  background: var(--app-primary-hover);
  color: #fff;
}

.api-json-panel p {
  margin: 0;
  color: var(--app-text-muted);
  font-weight: 700;
}

.api-response-shell {
  position: relative;
  display: flex;
  min-height: 360px;
  flex: 0 0 auto;
  flex-direction: column;
  border-top: 1px solid var(--app-border);
  background: #fff;
  overflow: visible;
}

.api-response-resizer {
  position: absolute;
  z-index: 5;
  top: -3px;
  right: 0;
  left: 0;
  height: 6px;
  flex: none;
  background: transparent;
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
  height: 41px;
  min-height: 41px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.api-response-header strong {
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
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
  gap: 8px;
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 16px;
}

.api-response-result-pill {
  display: inline-flex;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
}

.api-response-result-pill.is-success {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-response-result-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
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
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  transition: border-color 0.16s ease, color 0.16s ease;
}

.api-response-case-button:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.api-response-pill {
  padding: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--app-text-subtle);
}

.api-response-pill.is-success {
  color: var(--app-success);
}

.api-response-pill.is-danger {
  color: var(--app-danger);
}

.api-response-pill.is-warning {
  color: var(--app-warning);
}

.api-response-content {
  display: flex;
  min-height: 300px;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.api-response-empty {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 0 4px;
  color: var(--app-text-muted);
}

.api-response-empty__window {
  display: flex;
  align-items: center;
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
  opacity: 0.6;
}

.api-response-empty p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.api-response-empty b {
  color: var(--app-primary);
  font-weight: 500;
}

.api-response-pre {
  min-height: 260px;
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

.api-response-code {
  display: flex;
  min-height: 0;
  flex: 0 0 auto;
  flex-direction: column;
  overflow: visible;
  margin: 12px;
}

.api-response-code :deep(.api-code-editor) {
  width: 100%;
  min-height: 0;
}

.api-import-dialog {
  display: grid;
  gap: 0;
}

.api-import-dialog-shell :deep(.el-dialog) {
  overflow: hidden;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

.api-import-dialog-shell :deep(.el-dialog__header),
.api-import-dialog-shell :deep(.el-dialog__body) {
  margin: 0;
  padding: 0;
}

:global(.el-dialog.api-import-dialog-shell) {
  overflow: hidden;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  font-size: 16px;
  line-height: 24px;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

:global(.el-dialog.api-import-dialog-shell .el-dialog__header),
:global(.el-dialog.api-import-dialog-shell .el-dialog__body) {
  margin: 0;
  padding: 0;
}

:global(.el-dialog.api-import-dialog-shell .el-dialog__header) {
  display: block;
  height: 64px;
}

.api-import-dialog {
  overflow: hidden;
  background: #fff;
  color: #374151;
  font-size: 14px;
  line-height: 21px;
}

.api-import-header,
.api-import-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.api-import-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.api-import-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.api-import-title-icon {
  width: 20px;
  height: 20px;
  color: #3b82f6;
}

.api-import-close {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  line-height: normal;
}

.api-import-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.api-import-close svg {
  width: 16px;
  height: 16px;
}

.api-import-body {
  display: grid;
  gap: 20px;
  padding: 24px;
}

.api-import-section {
  display: grid;
  gap: 12px;
}

.api-import-section-title {
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  height: 21px;
  line-height: 21px;
}

.api-import-format-list {
  display: grid;
  gap: 8px;
}

.api-import-format {
  display: grid;
  width: 100%;
  height: 64px;
  grid-template-columns: 36px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  font-size: 13.3333px;
  line-height: normal;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.api-import-format:nth-child(3) {
  height: 68px;
}

.api-import-format:hover {
  border-color: #d1d5db;
  background: #f9fafb;
}

.api-import-format.is-active.is-green {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.api-import-format.is-active.is-orange {
  border-color: #fed7aa;
  background: #fff7ed;
}

.api-import-format.is-active.is-purple {
  border-color: #e9d5ff;
  background: #faf5ff;
}

.api-import-format-icon,
.api-import-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}

.api-import-format-icon {
  width: 36px;
  height: 36px;
  background: #f3f4f6;
  color: #9ca3af;
}

.api-import-format.is-active.is-green .api-import-format-icon {
  background: #dcfce7;
  color: #16a34a;
}

.api-import-format.is-active.is-orange .api-import-format-icon {
  background: #ffedd5;
  color: #ea580c;
}

.api-import-format.is-active.is-purple .api-import-format-icon {
  background: #f3e8ff;
  color: #9333ea;
}

.api-import-format-icon svg {
  width: 18px;
  height: 18px;
}

.api-import-format-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
  line-height: normal;
}

.api-import-format-copy > span {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  line-height: 16px;
}

.api-import-format-copy small {
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-import-check {
  width: 18px;
  height: 18px;
  border: 2px solid #d1d5db;
  color: #2563eb;
}

.api-import-check svg {
  width: 12px;
  height: 12px;
}

.api-import-mode-switch {
  display: inline-flex;
  width: fit-content;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: #f3f4f6;
}

.api-import-mode-switch button {
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.api-import-mode-switch button.is-active {
  background: #fff;
  color: #2563eb;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}

.api-import-url :deep(.el-input__wrapper) {
  min-height: 42px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.api-import-url :deep(.el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.16);
}

.api-import-upload {
  display: flex;
  min-height: 112px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  background: #fff;
  color: #4b5563;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.api-import-upload:hover {
  border-color: #60a5fa;
  background: #eff6ff;
}

.api-import-upload input {
  display: none;
}

.api-import-upload-icon {
  width: 24px;
  height: 24px;
  color: #9ca3af;
}

.api-import-upload small {
  color: #9ca3af;
  font-size: 12px;
}

.api-import-footer {
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  background: #f9fafb;
}

.api-import-cancel,
.api-import-submit {
  height: 36px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.api-import-cancel {
  border-color: #d1d5db;
  background: #fff;
  color: #374151;
}

.api-import-cancel:hover {
  background: #f3f4f6;
}

.api-import-submit {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

.api-import-submit:hover {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

.api-soft-dialog-shell :deep(.el-dialog) {
  border: 1px solid var(--app-border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

.api-soft-dialog-shell :deep(.el-dialog__header),
.api-soft-dialog-shell :deep(.el-dialog__body) {
  padding: 0;
}

:global(.el-dialog.api-soft-dialog-shell) {
  overflow: hidden;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

:global(.el-dialog.api-soft-dialog-shell .el-dialog__header),
:global(.el-dialog.api-soft-dialog-shell .el-dialog__body) {
  margin: 0;
  padding: 0;
}

:global(.el-dialog.api-soft-dialog-shell .el-dialog__header) {
  display: none;
}

.api-soft-dialog {
  background: #fff;
}

.api-soft-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 65px;
  padding: 20px 28px 20px 24px;
}

.api-soft-dialog__header strong {
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.api-soft-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}

.api-soft-dialog__close:hover {
  background: #f3f4f6;
  color: #374151;
}

.api-soft-dialog__body {
  min-height: 111px;
  padding: 20px 24px;
  color: #374151;
  font-size: 14px;
  line-height: 21px;
}

.api-soft-dialog__body p {
  margin: 0 0 12px;
  color: #4b5563;
  font-size: 14px;
  line-height: 21px;
}

.api-soft-dialog__body :deep(.el-input__wrapper),
.api-soft-dialog__body :deep(.el-textarea__inner) {
  min-height: 38px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #d1d5db inset;
}

.api-soft-dialog__body :deep(.el-input__inner),
.api-soft-dialog__body :deep(.el-textarea__inner) {
  color: #374151;
}

.api-soft-dialog__body :deep(.el-input__wrapper.is-focus),
.api-soft-dialog__body :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #2563eb inset;
}

.api-soft-dialog__body :deep(.el-textarea__inner) {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
}

.api-soft-dialog__error {
  margin-top: 8px;
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
}

.api-soft-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  min-height: 71px;
  padding: 16px 24px;
  background: #fff;
}

.api-soft-dialog__cancel,
.api-soft-dialog__submit {
  min-width: 58px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.api-soft-dialog__cancel {
  border-color: #d1d5db;
  background: #fff;
  color: #111827;
}

.api-soft-dialog__cancel:hover {
  background: #f3f4f6;
}

.api-soft-dialog__submit {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

.api-soft-dialog__submit:hover {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

:global(.api-soft-message-box.el-message-box) {
  width: 420px;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

:global(.api-soft-message-box .el-message-box__header) {
  display: flex;
  align-items: center;
  min-height: 65px;
  padding: 20px 28px 20px 24px;
}

:global(.api-soft-message-box .el-message-box__title) {
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

:global(.api-soft-message-box .el-message-box__headerbtn) {
  top: 16px;
  right: 22px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

:global(.api-soft-message-box .el-message-box__content) {
  min-height: 72px;
  padding: 20px 24px;
  color: #4b5563;
  font-size: 14px;
  line-height: 21px;
}

:global(.api-soft-message-box .el-message-box__status) {
  top: 20px;
}

:global(.api-soft-message-box .el-message-box__message) {
  padding-left: 28px;
  line-height: 21px;
}

:global(.api-soft-message-box .el-message-box__btns) {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  min-height: 71px;
  padding: 16px 24px;
  background: #fff;
}

:global(.api-soft-message-box .el-button) {
  min-width: 58px;
  height: 38px;
  margin-left: 0;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

:global(.api-soft-message-box__cancel.el-button) {
  border-color: #d1d5db;
  background: #fff;
  color: #111827;
}

:global(.api-soft-message-box__cancel.el-button:hover) {
  border-color: #d1d5db;
  background: #f3f4f6;
  color: #111827;
}

:global(.api-soft-message-box__primary.el-button--primary) {
  border-color: #2563eb;
  background: #2563eb;
}

:global(.api-soft-message-box__primary.el-button--primary:hover) {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

:global(.api-soft-message-box__danger.el-button--primary) {
  border-color: #ef4444;
  background: #ef4444;
}

:global(.api-soft-message-box__danger.el-button--primary:hover) {
  border-color: #dc2626;
  background: #dc2626;
}

.api-batch-dialog-shell :deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
}

.api-batch-dialog-shell :deep(.el-dialog__header),
.api-batch-dialog-shell :deep(.el-dialog__body) {
  padding: 0;
}

.api-batch-dialog {
  background: #fff;
}

.api-batch-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-batch-dialog__header strong {
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 700;
}

.api-batch-dialog__body {
  padding: 16px 20px 18px;
}

.api-batch-dialog__body p {
  margin: 0 0 12px;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
}

.api-batch-dialog__examples {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-batch-dialog__examples span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-batch-dialog__examples code {
  color: var(--app-text-primary);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.api-batch-dialog__notes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.api-batch-dialog__notes span {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-batch-dialog__body :deep(.el-textarea__inner) {
  min-height: 220px;
  border-radius: var(--app-radius-md);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.api-batch-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--app-border-soft);
  background: var(--app-bg-page);
}

.api-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.api-dialog-footer :deep(.el-button) {
  height: 32px;
  padding: 0 14px;
  border-radius: var(--app-radius-sm);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.api-dialog-footer :deep(.el-button--primary) {
  border-color: var(--app-primary);
  background: var(--app-primary);
}

@media (max-width: 1480px) {
  .api-interface-shell {
    grid-template-columns: 272px minmax(0, 1fr);
  }
}

@media (max-width: 1180px) {
  .api-interface-shell {
    grid-template-columns: 260px minmax(0, 1fr);
  }
}
</style>
