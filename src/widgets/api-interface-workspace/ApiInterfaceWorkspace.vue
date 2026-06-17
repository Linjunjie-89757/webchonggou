<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiDefinitionDetail,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
  type ApiKeyValueInput,
  type ApiRequestConfigInput,
  type ApiRunResult,
  type ApiRunStepResult,
  type SaveApiDefinitionCasePayload,
  type SaveApiDefinitionPayload,
} from '@/entities/api-automation'
import ApiCaseCreateEditDialog from '@/features/api-case-create-edit/ApiCaseCreateEditDialog.vue'
import { getRequestErrorMessage } from '@/shared/api/error'

type RequestContentTab = 'headers' | 'body' | 'params' | 'auth' | 'pre' | 'post' | 'tests' | 'settings' | 'cases'
type ResponseTab = 'body' | 'header' | 'console' | 'actualRequest' | 'assertions'
type DirectoryNodeType = 'root' | 'module' | 'request' | 'unassigned'
type BodyType = 'NONE' | 'FORM_DATA' | 'FORM_URLENCODED' | 'RAW_JSON' | 'RAW_XML' | 'RAW_TEXT' | 'BINARY'
type BatchAddTarget = 'query' | 'header' | 'body-form' | 'assertion'
type ApiCaseDialogMode = 'create' | 'edit'

interface ApiAssertionConfig {
  id?: string
  assertionType?: string
  type?: string
  name?: string
  enabled?: boolean
  subject?: string
  condition?: string
  operator?: string
  expectedValue?: string
  description?: string | null
}

interface ApiProcessorConfig {
  id?: string
  processorType?: string
  name?: string
  enabled?: boolean
  script?: string | null
  delayMs?: number | null
  description?: string | null
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
const directoryKeyword = ref('')
const selectedDirectoryKey = ref('definition-root')
const expandedKeys = ref<string[]>(['definition-root'])
const tabs = ref<EditorTab[]>([])
const activeEditorKey = ref('')
const saving = ref(false)
const sending = ref(false)
const batchAddVisible = ref(false)
const batchAddTarget = ref<BatchAddTarget>('query')
const batchAddText = ref('')
const caseDialogVisible = ref(false)
const caseDialogMode = ref<ApiCaseDialogMode>('create')
const caseDialogSaving = ref(false)
const caseDetailLoading = ref(false)
const caseDetailErrorMessage = ref('')
const editingCaseItem = ref<ApiDefinitionCaseItem | null>(null)
const editingCaseDetail = ref<ApiDefinitionCaseDetail | null>(null)
const caseRunningId = ref<number | null>(null)

const bodyModes: Array<{ label: string; value: BodyType }> = [
  { label: 'none', value: 'NONE' },
  { label: 'form-data', value: 'FORM_DATA' },
  { label: 'x-www-form-urlencoded', value: 'FORM_URLENCODED' },
  { label: 'json', value: 'RAW_JSON' },
  { label: 'xml', value: 'RAW_XML' },
  { label: 'raw', value: 'RAW_TEXT' },
  { label: 'binary', value: 'BINARY' },
]

const paramTypeOptions = ['string', 'integer', 'number', 'boolean', 'array', 'json', 'file']
const assertionTypeOptions = [
  { label: '状态码', value: 'RESPONSE_CODE' },
  { label: '响应头', value: 'RESPONSE_HEADER' },
  { label: '响应体', value: 'RESPONSE_BODY' },
  { label: '响应时间', value: 'RESPONSE_TIME' },
  { label: '变量', value: 'VARIABLE' },
]
const assertionConditionOptions = [
  { label: '等于', value: 'EQUALS' },
  { label: '不等于', value: 'NOT_EQUALS' },
  { label: '包含', value: 'CONTAINS' },
  { label: '不包含', value: 'NOT_CONTAINS' },
  { label: '为空', value: 'EMPTY' },
  { label: '不为空', value: 'NOT_EMPTY' },
  { label: '大于', value: 'GT' },
  { label: '小于', value: 'LT' },
]
const processorTypeOptions = [
  { label: '脚本', value: 'SCRIPT' },
  { label: 'SQL', value: 'SQL' },
  { label: '等待', value: 'TIME_WAITING' },
  { label: '提取', value: 'EXTRACT' },
]

const contentTabs = computed<Array<{ label: string; value: RequestContentTab; count?: number }>>(() => [
  { label: '请求头', value: 'headers', count: enabledRows(activeEditor.value?.detail.requestConfig.headers).length },
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
const activeDefinitionCases = computed(() => {
  const id = activeEditor.value?.definitionId
  return id ? cases.value.filter(item => item.definitionId === id) : []
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

const currentStep = computed<ApiRunStepResult | null>(() => activeEditor.value?.runResult?.stepResults?.[0] || null)
const responseStatus = computed(() => currentStep.value?.response?.statusCode ?? null)
const responseDuration = computed(() => currentStep.value?.durationMs ?? null)
const responseBody = computed(() => currentStep.value?.response?.body ?? '')
const responseHeaders = computed(() => JSON.stringify(currentStep.value?.response?.headers ?? {}, null, 2))
const actualRequest = computed(() => JSON.stringify(currentStep.value?.request ?? {}, null, 2))
const responseConsole = computed(() => {
  if (activeEditor.value?.runError) {
    return activeEditor.value.runError
  }
  if (!currentStep.value) {
    return ''
  }
  return currentStep.value.errorMessage || activeEditor.value?.runResult?.failureSummary || '请求执行完成'
})
const assertionRows = computed(() => currentStep.value?.assertionResults ?? [])
const responseSize = computed(() => {
  const text = responseBody.value || ''
  if (!text) {
    return '-'
  }
  const bytes = new Blob([text]).size
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`
})
const showResponseEmpty = computed(() => !currentStep.value && !activeEditor.value?.runError)

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

function assertionRowsFor(detail: ApiDefinitionDetail): ApiAssertionConfig[] {
  return detail.assertions as ApiAssertionConfig[]
}

function processorRowsFor(detail: ApiDefinitionDetail, stage: 'pre' | 'post'): ApiProcessorConfig[] {
  return (stage === 'pre' ? detail.preProcessors : detail.postProcessors) as ApiProcessorConfig[]
}

function createAssertion(name = '状态码断言', expectedValue = '200'): ApiAssertionConfig {
  return {
    id: `assertion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    assertionType: 'RESPONSE_CODE',
    name,
    enabled: true,
    subject: '',
    condition: 'EQUALS',
    expectedValue,
  }
}

function addAssertion() {
  if (!activeEditor.value) return
  assertionRowsFor(activeEditor.value.detail).push(createAssertion())
  markDirty()
}

function removeAssertion(index: number) {
  if (!activeEditor.value) return
  assertionRowsFor(activeEditor.value.detail).splice(index, 1)
  markDirty()
}

function createProcessor(stage: 'pre' | 'post', type = 'SCRIPT'): ApiProcessorConfig {
  return {
    id: `${stage}-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    processorType: type,
    name: stage === 'pre' ? '前置处理器' : '后置处理器',
    enabled: true,
    script: type === 'TIME_WAITING' ? null : '',
    delayMs: type === 'TIME_WAITING' ? 1000 : null,
  }
}

function addProcessor(stage: 'pre' | 'post') {
  if (!activeEditor.value) return
  processorRowsFor(activeEditor.value.detail, stage).push(createProcessor(stage))
  markDirty()
}

function removeProcessor(stage: 'pre' | 'post', index: number) {
  if (!activeEditor.value) return
  processorRowsFor(activeEditor.value.detail, stage).splice(index, 1)
  markDirty()
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

async function loadWorkspaceData() {
  if (!props.workspaceReady) {
    return
  }

  loading.value = true
  moduleLoading.value = true
  definitionLoading.value = true
  moduleErrorMessage.value = ''
  definitionErrorMessage.value = ''

  try {
    const [moduleItems, definitionPage] = await Promise.all([
      apiAutomationApi.getDefinitionModules(props.workspaceCode),
      apiAutomationApi.getDefinitions(props.workspaceCode, { pageNo: 1, pageSize: 500 }),
    ])
    modules.value = moduleItems
    definitions.value = definitionPage.items
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
  } finally {
    loading.value = false
    moduleLoading.value = false
    definitionLoading.value = false
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
    await ElMessageBox.confirm('当前请求有未保存修改，关闭后会丢失，确认关闭吗？', '关闭标签', { type: 'warning' })
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
    await ElMessageBox.confirm('其他标签中有未保存修改，关闭后会丢失，确认关闭吗？', '关闭其他标签', { type: 'warning' })
  }
  tabs.value = [activeEditor.value]
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
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes('\t')
        ? line.split('\t')
        : line.includes(':')
          ? line.split(/:(.*)/).filter(Boolean)
          : line.split(/=(.*)/).filter(Boolean)
      return {
        key: (parts[0] || '').trim(),
        value: (parts[1] || '').trim(),
        description: (parts[2] || '').trim(),
      }
    })
    .filter(row => row.key)
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
  } else {
    const targetRows = batchAddTarget.value === 'query'
      ? activeEditor.value.detail.requestConfig.queryParams
      : batchAddTarget.value === 'header'
        ? activeEditor.value.detail.requestConfig.headers
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
  await ElMessageBox.confirm('删除后不可恢复，确认删除该模块吗？', '删除模块', { type: 'warning' })
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
  await ElMessageBox.confirm('删除后不可恢复，确认删除该请求吗？', '删除请求', { type: 'warning' })
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
  const detail = activeEditor.value.detail
  if (!detail.requestConfig.path.trim()) {
    ElMessage.warning('请输入请求 URL 或接口路径')
    return
  }

  saving.value = true
  try {
    const payload = buildPayload(detail)
    const saved = activeEditor.value.definitionId
      ? await apiAutomationApi.updateDefinition(props.workspaceCode, activeEditor.value.definitionId, payload)
      : await apiAutomationApi.createDefinition(props.workspaceCode, payload)

    activeEditor.value.definitionId = saved.id
    activeEditor.value.key = `definition:${saved.id}`
    activeEditor.value.detail = clone(saved)
    activeEditor.value.title = editorTitle(saved)
    activeEditor.value.method = saved.requestConfig.method || saved.method
    activeEditor.value.dirty = false
    activeEditorKey.value = activeEditor.value.key
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
      ? await apiAutomationApi.debugRunDefinition(props.workspaceCode, editor.definitionId, { workspaceCode: props.workspaceCode })
      : await apiAutomationApi.debugRunDefinitionDraft(props.workspaceCode, {
        ...buildPayload(detail),
        workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
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

  await ElMessageBox.confirm('删除后不可恢复，确认删除当前接口吗？', '删除接口', { type: 'warning' })
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

function saveAsCase() {
  openCreateCaseDialog()
}

async function promptImportCurl() {
  if (!activeEditor.value) return
  const { value } = await ElMessageBox.prompt('粘贴 curl 命令，支持 method、URL、Headers、Body 的最小解析', 'Curl 导入', {
    inputType: 'textarea',
    inputPlaceholder: `curl -X POST "https://example.com/api" -H "Content-Type: application/json" -d '{"name":"demo"}'`,
  })
  try {
    applyCurlToActiveEditor(value)
    ElMessage.success('Curl 已填充到当前请求')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Curl 解析失败')
  }
}

function openImportDialog() {
  ElMessage.info('当前后端未提供 Swagger/Postman/HAR 导入接口，本轮不伪造普通导入成功')
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
  await ElMessageBox.confirm('删除后不可恢复，确认删除该用例吗？', '删除用例', { type: 'warning' })
  await apiAutomationApi.deleteCase(props.workspaceCode, item.id)
  await loadCasesForDefinition(item.definitionId)
  ElMessage.success('用例已删除')
}

async function runCase(item: ApiDefinitionCaseItem) {
  caseRunningId.value = item.id
  try {
    await apiAutomationApi.runCase(props.workspaceCode, item.id, { workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode })
    await loadCasesForDefinition(item.definitionId)
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
  void loadWorkspaceData()
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
            暂无匹配的请求
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
            <el-dropdown v-if="tabs.length > 1" trigger="click" @command="closeOtherTabs">
              <button type="button" class="api-editor-tab-more">
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="closeOthers">关闭其他标签</el-dropdown-item>
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
                v-model="activeEditor.detail.requestConfig.path"
                placeholder="请输入包含 http/https 的完整 URL 或接口路径"
                @input="markDirty"
              />
              <button type="button" class="api-curl-button" @click="promptImportCurl">Curl</button>
            </div>
            <button type="button" class="api-send-button" :disabled="sending" @click="sendActiveEditor">
              <el-icon><VideoPlay /></el-icon>
              发送
            </button>
            <el-dropdown split-button class="api-save-dropdown" :loading="saving" @click="saveActiveEditor">
              保存
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :disabled="!activeEditor.definitionId" @click="saveAsCase">保存为用例</el-dropdown-item>
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
                        <el-input v-if="row.paramType === 'file'" v-model="row.fileName" placeholder="文件名（暂不上传文件）" @input="markDirty" />
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
                      <el-input v-model="activeEditor.detail.requestConfig.body.fileName" placeholder="文件名" @input="markDirty" />
                      <span class="api-binary-hint">二进制内容上传能力后续按旧项目补齐</span>
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
                  <el-table v-if="activeDefinitionCases.length" :data="activeDefinitionCases" size="small" height="300">
                    <el-table-column prop="name" label="用例名称" min-width="180" show-overflow-tooltip />
                    <el-table-column prop="path" label="路径" min-width="220" show-overflow-tooltip />
                    <el-table-column label="方法" width="80">
                      <template #default="{ row }">
                        <span :class="['api-method', requestMethodClass(row.method)]">{{ row.method }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="lastRunResult" label="最近结果" width="100" />
                    <el-table-column label="操作" width="220" fixed="right">
                      <template #default="{ row }">
                        <div class="api-case-actions">
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
                <div v-if="activeEditor.activeTab === 'tests'" class="api-assertion-panel">
                  <div class="api-advanced-toolbar">
                    <div>
                      <strong>断言</strong>
                      <span>发送时随请求一起执行</span>
                    </div>
                    <div class="api-advanced-actions">
                      <button type="button" @click="openBatchAdd('assertion')">批量添加</button>
                      <button type="button" class="api-sidebar-primary" @click="addAssertion">添加断言</button>
                    </div>
                  </div>
                  <div class="api-assertion-table">
                    <div class="api-assertion-header">
                      <span>启用</span><span>名称</span><span>断言对象</span><span>条件</span><span>期望值</span><span>说明</span><span></span>
                    </div>
                    <div v-for="(assertion, index) in assertionRowsFor(activeEditor.detail)" :key="assertion.id || index" class="api-assertion-row">
                      <el-switch v-model="assertion.enabled" size="small" @change="markDirty" />
                      <el-input v-model="assertion.name" placeholder="断言名称" @input="markDirty" />
                      <el-select v-model="assertion.assertionType" @change="markDirty">
                        <el-option v-for="item in assertionTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                      </el-select>
                      <el-select v-model="assertion.condition" @change="markDirty">
                        <el-option v-for="item in assertionConditionOptions" :key="item.value" :label="item.label" :value="item.value" />
                      </el-select>
                      <el-input v-model="assertion.expectedValue" placeholder="期望值" @input="markDirty" />
                      <el-input v-model="assertion.description" placeholder="说明" @input="markDirty" />
                      <button type="button" class="api-row-remove" @click="removeAssertion(index)">删除</button>
                    </div>
                    <div v-if="!assertionRowsFor(activeEditor.detail).length" class="api-empty-body">当前请求未配置断言</div>
                  </div>
                </div>

                <div v-else class="api-processor-panel">
                  <div class="api-advanced-toolbar">
                    <div>
                      <strong>{{ activeEditor.activeTab === 'pre' ? '前置处理' : '后置处理' }}</strong>
                      <span>{{ activeEditor.activeTab === 'pre' ? '请求发送前执行' : '响应返回后执行' }}</span>
                    </div>
                    <button type="button" class="api-sidebar-primary" @click="addProcessor(activeEditor.activeTab === 'pre' ? 'pre' : 'post')">添加处理器</button>
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
                        <el-select v-model="processor.processorType" @change="markDirty">
                          <el-option v-for="item in processorTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                        </el-select>
                        <button type="button" class="api-row-remove" @click="removeProcessor(activeEditor.activeTab === 'pre' ? 'pre' : 'post', index)">删除</button>
                      </div>
                      <el-input
                        v-if="processor.processorType !== 'TIME_WAITING'"
                        v-model="processor.script"
                        type="textarea"
                        :rows="5"
                        resize="none"
                        placeholder="脚本 / SQL / 提取配置"
                        @input="markDirty"
                      />
                      <div v-else class="api-wait-row">
                        <span>等待时长 ms</span>
                        <el-input-number v-model="processor.delayMs" :min="1" :max="600000" :step="100" controls-position="right" @change="markDirty" />
                      </div>
                    </div>
                    <div v-if="!processorRowsFor(activeEditor.detail, activeEditor.activeTab === 'pre' ? 'pre' : 'post').length" class="api-empty-body">
                      暂无{{ activeEditor.activeTab === 'pre' ? '前置' : '后置' }}处理器
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div class="api-response-shell">
              <div class="api-response-header">
                <strong>响应内容</strong>
                <div v-if="!showResponseEmpty" class="api-response-metrics">
                  <span :class="['api-response-pill', `is-${statusTone(responseStatus)}`]">状态 {{ responseStatus ?? '-' }}</span>
                  <span>耗时 {{ responseDuration ?? '-' }}<template v-if="responseDuration !== null"> ms</template></span>
                  <span>大小 {{ responseSize }}</span>
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
                  <pre v-if="activeEditor.responseTab === 'body'" class="api-response-pre">{{ responseBody }}</pre>
                  <pre v-else-if="activeEditor.responseTab === 'header'" class="api-response-pre">{{ responseHeaders }}</pre>
                  <pre v-else-if="activeEditor.responseTab === 'console'" class="api-response-pre">{{ responseConsole }}</pre>
                  <pre v-else-if="activeEditor.responseTab === 'actualRequest'" class="api-response-pre">{{ actualRequest }}</pre>
                  <el-table v-else-if="assertionRows.length" :data="assertionRows" size="small">
                    <el-table-column prop="name" label="断言名称" min-width="140" />
                    <el-table-column prop="condition" label="条件" width="100" />
                    <el-table-column prop="expectedValue" label="期望值" min-width="120" />
                    <el-table-column prop="actualValue" label="实际值" min-width="120" />
                    <el-table-column label="结果" width="90">
                      <template #default="{ row }">{{ row.success ? '通过' : '失败' }}</template>
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

    <el-dialog v-model="batchAddVisible" title="批量添加" width="560px" append-to-body>
      <div class="api-batch-dialog">
        <p>每行一条，支持 <code>key=value</code>、<code>key: value</code> 或 tab 分隔。</p>
        <el-input
          v-model="batchAddText"
          type="textarea"
          :rows="10"
          resize="none"
          placeholder="token=abc&#10;Content-Type: application/json"
        />
      </div>
      <template #footer>
        <div class="api-dialog-footer">
          <el-button @click="batchAddVisible = false">取消</el-button>
          <el-button type="primary" @click="applyBatchAdd">确认添加</el-button>
        </div>
      </template>
    </el-dialog>

    <ApiCaseCreateEditDialog
      v-model="caseDialogVisible"
      :mode="caseDialogMode"
      :definition="currentDefinitionSummary()"
      :case-item="editingCaseItem"
      :case-detail="editingCaseDetail"
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
}

.api-directory-tree :deep(.el-tree-node__content:hover) .api-directory-node__action,
.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content) .api-directory-node__action {
  opacity: 1;
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
  gap: 10px;
  padding: 12px 16px 10px;
  border-bottom: 1px solid var(--app-border);
}

.api-url-compose {
  display: grid;
  min-width: 0;
  flex: 1;
  grid-template-columns: 104px minmax(0, 1fr) 68px;
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
  min-width: 820px;
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

.api-cases-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.api-case-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.api-case-actions button.is-danger {
  color: var(--app-danger);
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
  grid-template-columns: 56px minmax(160px, 1fr) 160px 64px;
  gap: 8px;
  align-items: center;
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

.api-response-header {
  display: flex;
  height: 40px;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border);
}

.api-response-header strong {
  font-size: var(--app-font-size-sm);
}

.api-response-metrics {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
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
