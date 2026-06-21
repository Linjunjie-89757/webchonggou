<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Fold,
  MoreFilled,
} from '@element-plus/icons-vue'
import {
  Bell,
  Clock,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  Layers,
  Link,
  MoreHorizontal,
  Play,
  Plus,
  Save,
  Search,
  Settings2,
  X,
  Zap,
} from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import type {
  ApiAutomationEnvironmentItem,
  ApiDefinitionCaseItem,
  ApiScenarioItem,
  ApiAutomationVariableSetItem,
} from '@/entities/api-automation'
import { apiAutomationApi } from '@/entities/api-automation'
import {
  apiExecutionSuiteApi,
  type ApiExecutionSuiteArrangeItem,
  type ApiExecutionSuiteDetail,
  type ApiExecutionSuiteItem,
  type ApiExecutionSuiteModuleItem,
  type ApiExecutionSuiteRunHistoryDetail,
  type ApiExecutionSuiteRunHistoryItem,
} from '@/entities/api-execution-suite'
import type { WorkspaceItem } from '@/entities/workspace'

type ExecutionSuiteCaseType = 'api' | 'scene'
type ExecutionSubTabKey = 'arrange' | 'schedule' | 'branch' | 'result'

interface ExecutionSuiteNode {
  id: string
  key: string
  label: string
  name: string
  count: number
  suiteCount: number
  type: 'workspace' | 'module' | 'suite'
  workspaceCode?: string
  moduleId?: number | null
  suiteId?: number
  sourceModule?: ApiExecutionSuiteModuleItem
  sourceSuite?: ApiExecutionSuiteItem
  children?: ExecutionSuiteNode[]
}

interface ExecutionSuiteCase {
  id: string
  arrangeId: number
  type: ExecutionSuiteCaseType
  name: string
  method: string
  path: string
  description: string
  enabled: boolean
}

const props = defineProps<{
  workspaceCode: string
  workspaceReady?: boolean
  workspaces?: WorkspaceItem[]
  environments?: ApiAutomationEnvironmentItem[]
  variableSets?: ApiAutomationVariableSetItem[]
}>()

const executionSubTabs: Array<{ key: ExecutionSubTabKey; label: string; icon: typeof Layers }> = [
  { key: 'arrange', label: '编排', icon: Layers },
  { key: 'schedule', label: '定时', icon: Clock },
  { key: 'branch', label: '分支', icon: Zap },
  { key: 'result', label: '运行结果', icon: FileText },
]

const suiteKeyword = ref('')
const activeSuiteId = ref('')
const suiteModules = ref<ApiExecutionSuiteModuleItem[]>([])
const suites = ref<ApiExecutionSuiteItem[]>([])
const openedSuiteTabs = ref<ApiExecutionSuiteItem[]>([])
const activeSuiteDetail = ref<ApiExecutionSuiteDetail | null>(null)
const suiteArrangeItems = ref<ApiExecutionSuiteArrangeItem[]>([])
const suiteTreeLoading = ref(false)
const suiteDetailLoading = ref(false)
const arrangePickerVisible = ref(false)
const arrangePickerType = ref<ExecutionSuiteCaseType>('api')
const arrangeCandidateLoading = ref(false)
const caseCandidates = ref<ApiDefinitionCaseItem[]>([])
const scenarioCandidates = ref<ApiScenarioItem[]>([])
const selectedArrangeCandidateIds = ref<number[]>([])
const arrangeCandidateKeyword = ref('')
const arrangeCandidatePageNo = ref(1)
const arrangeCandidatePageSize = ref(10)
const arrangeCandidateTotal = ref(0)
const activeExecutionSubTab = ref<ExecutionSubTabKey>('arrange')
const suiteRunHistories = ref<ApiExecutionSuiteRunHistoryItem[]>([])
const suiteRunHistoryDetail = ref<ApiExecutionSuiteRunHistoryDetail | null>(null)
const suiteRunHistoryLoading = ref(false)
const expandedSuiteTreeKeys = ref<string[]>([])
const executionVisualEnvironment = ref<number | string | null>(null)
const executionVisualRunMode = ref('parallel')
const executionVisualRunOn = ref('local')
const executionVisualNotify = ref(true)
const executionScheduleEnabled = ref(false)
const executionCronExpression = ref('')
const executionBranchName = ref('')
const executionTriggerSource = ref('')
const executionBranchNote = ref('')
const suiteSaving = ref(false)
const suiteRunning = ref(false)

const visibleEnvironmentOptions = computed(() => props.environments || [])

const executionSuiteTree = computed<ExecutionSuiteNode[]>(() => {
  const workspaceNodes = resolveVisibleWorkspaces()

  return workspaceNodes.map((workspace): ExecutionSuiteNode => {
    const workspaceCode = getWorkspaceCode(workspace)
    const key = `workspace:${workspaceCode}`
    const moduleChildren = suiteModules.value
      .filter(module => module.workspaceCode === workspaceCode)
      .map(module => toSuiteModuleNode(module, workspaceCode))
    const rootSuites = suites.value
      .filter(suite => suite.workspaceCode === workspaceCode && suite.moduleId == null)
      .map(suite => toSuiteNode(suite))
    const children = [...moduleChildren, ...rootSuites]

    return {
      id: key,
      key,
      label: getWorkspaceName(workspace),
      name: getWorkspaceName(workspace),
      count: children.length,
      suiteCount: countSuiteNodes(children),
      type: 'workspace',
      workspaceCode,
      children,
    }
  })
})

const activeSuiteName = computed(() => {
  if (activeSuiteDetail.value) return activeSuiteDetail.value.name
  const activeNode = findSuiteNode(executionSuiteTree.value, activeSuiteId.value)
  if (activeNode?.type === 'suite') return activeNode.label
  return '未选择套件'
})

const activeSuiteKey = computed(() => activeSuiteDetail.value ? `suite:${activeSuiteDetail.value.id}` : activeSuiteId.value)

const activeSuiteDescription = computed(() => (
  activeSuiteDetail.value?.description || '选择套件后可维护编排、定时、分支和运行结果。'
))

const activeSuiteWorkspaceName = computed(() => (
  activeSuiteDetail.value?.workspaceName || activeSuiteDetail.value?.workspaceCode || '--'
))

const activeSuiteModuleLabel = computed(() => {
  if (!activeSuiteDetail.value) return '--'
  if (activeSuiteDetail.value.moduleName) return activeSuiteDetail.value.moduleName
  return activeSuiteDetail.value.moduleId == null ? '根目录' : '未命名模块'
})

const activeSuiteUpdatedAt = computed(() => formatDateTime(activeSuiteDetail.value?.updatedAt))

const visibleExecutionSuiteCases = computed<ExecutionSuiteCase[]>(() => (
  suiteArrangeItems.value.map(item => ({
    id: String(item.id),
    arrangeId: item.id,
    type: item.itemType === 'SCENARIO' ? 'scene' : 'api',
    name: item.itemName,
    method: '',
    path: '',
    description: item.description || '',
    enabled: item.enabled,
  }))
))

const arrangePickerTitle = computed(() => (
  arrangePickerType.value === 'api' ? '添加接口用例' : '添加场景'
))

const arrangePickerTypeLabel = computed(() => (
  arrangePickerType.value === 'api' ? '接口用例' : '场景'
))

const addedArrangeItemIds = computed(() => new Set(
  suiteArrangeItems.value
    .filter(item => item.itemType === (arrangePickerType.value === 'api' ? 'API_CASE' : 'SCENARIO'))
    .map(item => item.itemId),
))

const selectedArrangeAvailableCount = computed(() => (
  selectedArrangeCandidateIds.value.filter(id => !addedArrangeItemIds.value.has(id)).length
))

const visibleArrangeCandidates = computed(() => (
  arrangePickerType.value === 'api' ? caseCandidates.value : scenarioCandidates.value
))

const filteredSuiteTree = computed(() => {
  const keyword = suiteKeyword.value.trim().toLowerCase()
  if (!keyword) return executionSuiteTree.value
  return filterSuiteNodes(executionSuiteTree.value, keyword)
})

const suiteTotalCount = computed(() => suites.value.length)
const hasVisibleSuites = computed(() => filteredSuiteTree.value.length > 0)

onMounted(() => {
  void loadExecutionSuiteDirectory()
})

watch(
  () => [props.workspaceCode, props.workspaceReady, props.workspaces?.length || 0],
  () => {
    void loadExecutionSuiteDirectory()
  },
)

function collapseAllSuiteTreeChildren() {
  expandedSuiteTreeKeys.value = []
}

async function loadExecutionSuiteDirectory() {
  if (props.workspaceReady === false) return
  suiteTreeLoading.value = true
  try {
    const workspaceCode = props.workspaceCode || 'ALL'
    const [moduleItems, suitePage] = await Promise.all([
      apiExecutionSuiteApi.getSuiteModules(workspaceCode),
      apiExecutionSuiteApi.getSuites(workspaceCode, { pageNo: 1, pageSize: 500 }),
    ])
    suiteModules.value = moduleItems
    suites.value = suitePage.items
    expandedSuiteTreeKeys.value = executionSuiteTree.value.map(node => node.key)
    if (activeSuiteId.value && !findSuiteNode(executionSuiteTree.value, activeSuiteId.value)) {
      activeSuiteId.value = ''
      activeSuiteDetail.value = null
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteTreeLoading.value = false
  }
}

async function handleCreateSuite() {
  const workspaceCode = resolveActionWorkspaceCode()
  if (!workspaceCode) return
  const moduleNode = findSuiteNode(executionSuiteTree.value, activeSuiteId.value)
  const moduleId = moduleNode?.type === 'module' ? moduleNode.moduleId ?? null : null
  const name = await promptExecutionText('新建套件', '请输入套件名称', '套件名称')
  if (!name) return
  try {
    const detail = await apiExecutionSuiteApi.createSuite(workspaceCode, {
      workspaceCode,
      moduleId,
      name,
      priority: 'P1',
      status: 'ACTIVE',
      runMode: 'SERIAL',
      runOn: 'LOCAL',
      notifyEnabled: true,
    })
    ElMessage.success('套件已创建')
    await loadExecutionSuiteDirectory()
    openSuiteTab(detail)
    await loadSuiteDetail(detail.workspaceCode, detail.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function handleCreateSuiteModule(node: ExecutionSuiteNode) {
  const workspaceCode = node.workspaceCode || resolveActionWorkspaceCode()
  if (!workspaceCode) return
  const parentId = node.type === 'module' ? node.moduleId ?? null : null
  const name = await promptExecutionText('新建模块', '请输入模块名称', '模块名称')
  if (!name) return
  try {
    await apiExecutionSuiteApi.createSuiteModule(workspaceCode, {
      workspaceCode,
      parentId,
      name,
    })
    ElMessage.success('模块已创建')
    await loadExecutionSuiteDirectory()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function handleSuiteModuleCommand(command: string | number | object, node: ExecutionSuiteNode) {
  if (command === 'rename') {
    await renameSuiteModule(node)
    return
  }
  if (command === 'delete') {
    await deleteSuiteModule(node)
  }
}

async function handleSuiteMoreCommand(command: string | number | object) {
  if (command === 'delete') {
    await deleteActiveSuite()
  }
}

function handleSuiteTreeSelect(node: ExecutionSuiteNode) {
  if (node.type === 'suite') {
    activeSuiteId.value = node.id
    if (node.sourceSuite) {
      openSuiteTab(node.sourceSuite)
      void loadSuiteDetail(node.sourceSuite.workspaceCode, node.sourceSuite.id)
    }
    return
  }
  activeSuiteId.value = node.key
  activeSuiteDetail.value = null
}

function getWorkspaceCode(workspace: WorkspaceItem) {
  return workspace.workspaceCode || workspace.code || ''
}

function getWorkspaceName(workspace: WorkspaceItem) {
  const code = getWorkspaceCode(workspace)
  return workspace.workspaceName || workspace.name || code || '未命名空间'
}

function resolveVisibleWorkspaces(): WorkspaceItem[] {
  const workspaces = (props.workspaces || [])
    .filter(workspace => {
      const code = getWorkspaceCode(workspace)
      return code && code !== 'ALL' && !workspace.allScope
    })

  if (props.workspaceCode === 'ALL') return workspaces

  const selectedWorkspace = workspaces.find(workspace => getWorkspaceCode(workspace) === props.workspaceCode)
  if (selectedWorkspace) return [selectedWorkspace]

  if (!props.workspaceCode) return []

  return [{
    workspaceCode: props.workspaceCode,
    workspaceName: props.workspaceCode,
  }]
}

function toSuiteModuleNode(module: ApiExecutionSuiteModuleItem, workspaceCode: string): ExecutionSuiteNode {
  const childModules = (module.children || []).map(child => toSuiteModuleNode(child, workspaceCode))
  const childSuites = suites.value
    .filter(suite => suite.workspaceCode === workspaceCode && suite.moduleId === module.id)
    .map(suite => toSuiteNode(suite))
  const children = [...childModules, ...childSuites]

  return {
    id: `module:${module.id}`,
    key: `module:${module.id}`,
    label: module.name,
    name: module.name,
    count: children.length,
    suiteCount: countSuiteNodes(children),
    type: 'module',
    workspaceCode,
    moduleId: module.id,
    sourceModule: module,
    children,
  }
}

function toSuiteNode(suite: ApiExecutionSuiteItem): ExecutionSuiteNode {
  return {
    id: `suite:${suite.id}`,
    key: `suite:${suite.id}`,
    label: suite.name,
    name: suite.name,
    count: 0,
    suiteCount: 0,
    type: 'suite',
    workspaceCode: suite.workspaceCode,
    moduleId: suite.moduleId,
    suiteId: suite.id,
    sourceSuite: suite,
    children: [],
  }
}

function countSuiteNodes(nodes: ExecutionSuiteNode[]): number {
  return nodes.reduce((total, node) => (
    total + (node.type === 'suite' ? 1 : countSuiteNodes(node.children || []))
  ), 0)
}

function findSuiteNode(nodes: ExecutionSuiteNode[], id: string): ExecutionSuiteNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const child = findSuiteNode(node.children || [], id)
    if (child) return child
  }
  return null
}

function filterSuiteNodes(nodes: ExecutionSuiteNode[], keyword: string): ExecutionSuiteNode[] {
  return nodes
    .map(node => ({
      ...node,
      children: filterSuiteNodes(node.children || [], keyword),
    }))
    .filter(node => node.label.toLowerCase().includes(keyword) || Boolean(node.children?.length))
}

function requestMethodClass(method: string) {
  return `is-${method.toLowerCase()}`
}

function openSuiteTab(suite: ApiExecutionSuiteItem) {
  const index = openedSuiteTabs.value.findIndex(item => item.id === suite.id)
  if (index >= 0) {
    openedSuiteTabs.value[index] = suite
  } else {
    openedSuiteTabs.value.push(suite)
  }
  activeSuiteId.value = `suite:${suite.id}`
}

function switchSuiteTab(suite: ApiExecutionSuiteItem) {
  openSuiteTab(suite)
  void loadSuiteDetail(suite.workspaceCode, suite.id)
}

function closeSuiteTab(suite: ApiExecutionSuiteItem) {
  const index = openedSuiteTabs.value.findIndex(item => item.id === suite.id)
  if (index < 0) return
  const wasActive = activeSuiteId.value === `suite:${suite.id}`
  openedSuiteTabs.value.splice(index, 1)
  if (!wasActive) return
  const nextSuite = openedSuiteTabs.value[index] || openedSuiteTabs.value[index - 1]
  if (nextSuite) {
    switchSuiteTab(nextSuite)
    return
  }
  activeSuiteId.value = ''
  activeSuiteDetail.value = null
}

async function loadSuiteDetail(workspaceCode: string, suiteId: number) {
  suiteDetailLoading.value = true
  try {
    activeSuiteDetail.value = await apiExecutionSuiteApi.getSuiteDetail(workspaceCode, suiteId)
    syncSuiteConfigForm()
    await loadSuiteArrangeItems()
    if (activeExecutionSubTab.value === 'result') {
      await loadSuiteRunHistories()
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteDetailLoading.value = false
  }
}

function switchExecutionSubTab(tab: ExecutionSubTabKey) {
  activeExecutionSubTab.value = tab
  if (tab === 'result') {
    void loadSuiteRunHistories()
  }
}

function syncSuiteConfigForm() {
  if (!activeSuiteDetail.value) return
  executionVisualEnvironment.value = activeSuiteDetail.value.environmentId
  executionVisualRunMode.value = String(activeSuiteDetail.value.runMode || 'SERIAL').toLowerCase()
  executionVisualRunOn.value = String(activeSuiteDetail.value.runOn || 'LOCAL').toLowerCase()
  executionVisualNotify.value = activeSuiteDetail.value.notifyEnabled !== false
  executionScheduleEnabled.value = Boolean(activeSuiteDetail.value.scheduleEnabled)
  executionCronExpression.value = activeSuiteDetail.value.cronExpression || ''
  executionBranchName.value = activeSuiteDetail.value.branchName || ''
  executionTriggerSource.value = activeSuiteDetail.value.triggerSource || ''
  executionBranchNote.value = activeSuiteDetail.value.branchNote || ''
}

async function loadSuiteArrangeItems() {
  if (!activeSuiteDetail.value) {
    suiteArrangeItems.value = []
    return
  }
  suiteArrangeItems.value = await apiExecutionSuiteApi.getSuiteItems(
    activeSuiteDetail.value.workspaceCode,
    activeSuiteDetail.value.id,
  )
}

async function openArrangePicker(type: ExecutionSuiteCaseType) {
  if (!activeSuiteDetail.value) {
    ElMessage.warning('请先选择执行套件')
    return
  }
  arrangePickerType.value = type
  arrangePickerVisible.value = true
  selectedArrangeCandidateIds.value = []
  arrangeCandidateKeyword.value = ''
  arrangeCandidatePageNo.value = 1
  await loadArrangeCandidates()
}

async function loadArrangeCandidates() {
  if (!activeSuiteDetail.value) return
  arrangeCandidateLoading.value = true
  try {
    if (arrangePickerType.value === 'api') {
      const page = await apiAutomationApi.getCases(activeSuiteDetail.value.workspaceCode, {
        keyword: arrangeCandidateKeyword.value.trim() || undefined,
        pageNo: arrangeCandidatePageNo.value,
        pageSize: arrangeCandidatePageSize.value,
      })
      caseCandidates.value = page.items
      scenarioCandidates.value = []
      arrangeCandidateTotal.value = page.total
    } else {
      const page = await apiAutomationApi.getScenarios(activeSuiteDetail.value.workspaceCode, {
        keyword: arrangeCandidateKeyword.value.trim() || undefined,
        pageNo: arrangeCandidatePageNo.value,
        pageSize: arrangeCandidatePageSize.value,
      })
      scenarioCandidates.value = page.items
      caseCandidates.value = []
      arrangeCandidateTotal.value = page.total
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    arrangeCandidateLoading.value = false
  }
}

async function handleArrangeCandidateSearch() {
  arrangeCandidatePageNo.value = 1
  selectedArrangeCandidateIds.value = []
  await loadArrangeCandidates()
}

async function handleArrangeCandidatePageChange(pageNo: number) {
  arrangeCandidatePageNo.value = pageNo
  selectedArrangeCandidateIds.value = []
  await loadArrangeCandidates()
}

function handleArrangeCaseSelection(rows: ApiDefinitionCaseItem[]) {
  selectedArrangeCandidateIds.value = rows.map(item => item.id)
}

function handleArrangeScenarioSelection(rows: ApiScenarioItem[]) {
  selectedArrangeCandidateIds.value = rows.map(item => item.id)
}

async function addSelectedArrangeItems() {
  if (!activeSuiteDetail.value || !selectedArrangeAvailableCount.value) return
  const ids = selectedArrangeCandidateIds.value.filter(id => !addedArrangeItemIds.value.has(id))
  try {
    for (const id of ids) {
      await apiExecutionSuiteApi.addSuiteItem(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, {
        itemType: arrangePickerType.value === 'api' ? 'API_CASE' : 'SCENARIO',
        itemId: id,
        enabled: true,
      })
    }
    arrangePickerVisible.value = false
    ElMessage.success(`已添加 ${ids.length} 个${arrangePickerTypeLabel.value}`)
    await loadSuiteArrangeItems()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function deleteArrangeItem(row: ExecutionSuiteCase) {
  if (!activeSuiteDetail.value) return
  try {
    await ElMessageBox.confirm('确认从套件中移除该内容吗？', '移除内容', {
      confirmButtonText: '移除',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'execution-soft-message-box',
    })
  } catch {
    return
  }
  try {
    await apiExecutionSuiteApi.deleteSuiteItem(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, row.arrangeId)
    ElMessage.success('内容已移除')
    await loadSuiteArrangeItems()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function deleteActiveSuite() {
  if (!activeSuiteDetail.value) {
    ElMessage.warning('请先选择执行套件')
    return
  }
  const detail = activeSuiteDetail.value
  try {
    await ElMessageBox.confirm(`确认删除执行套件「${detail.name}」吗？`, '删除套件', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'execution-soft-message-box',
    })
  } catch {
    return
  }
  try {
    await apiExecutionSuiteApi.deleteSuite(detail.workspaceCode, detail.id)
    ElMessage.success('套件已删除')
    const index = openedSuiteTabs.value.findIndex(item => item.id === detail.id)
    if (index >= 0) {
      openedSuiteTabs.value.splice(index, 1)
    }
    const nextSuite = openedSuiteTabs.value[index] || openedSuiteTabs.value[index - 1]
    activeSuiteDetail.value = null
    activeSuiteId.value = ''
    await loadExecutionSuiteDirectory()
    if (nextSuite) {
      switchSuiteTab(nextSuite)
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function moveArrangeItem(row: ExecutionSuiteCase, direction: -1 | 1) {
  if (!activeSuiteDetail.value) return
  const index = suiteArrangeItems.value.findIndex(item => item.id === row.arrangeId)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= suiteArrangeItems.value.length) return
  const nextItems = [...suiteArrangeItems.value]
  const [moved] = nextItems.splice(index, 1)
  nextItems.splice(targetIndex, 0, moved)
  try {
    suiteArrangeItems.value = await apiExecutionSuiteApi.reorderSuiteItems(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, {
      items: nextItems.map((item, itemIndex) => ({
        id: item.id,
        sortOrder: itemIndex + 1,
        enabled: item.enabled,
      })),
    })
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function loadSuiteRunHistories() {
  if (!activeSuiteDetail.value) {
    suiteRunHistories.value = []
    suiteRunHistoryDetail.value = null
    return
  }
  suiteRunHistoryLoading.value = true
  try {
    const page = await apiExecutionSuiteApi.getSuiteRunHistory(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, {
      pageNo: 1,
      pageSize: 10,
    })
    suiteRunHistories.value = page.items
    if (suiteRunHistoryDetail.value && !page.items.some(item => item.id === suiteRunHistoryDetail.value?.id)) {
      suiteRunHistoryDetail.value = null
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteRunHistoryLoading.value = false
  }
}

async function selectSuiteRunHistory(row: ApiExecutionSuiteRunHistoryItem) {
  suiteRunHistoryLoading.value = true
  try {
    suiteRunHistoryDetail.value = await apiExecutionSuiteApi.getSuiteRunHistoryDetail(row.workspaceCode, row.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteRunHistoryLoading.value = false
  }
}

function formatRunResult(result: string | null) {
  if (result === 'PASSED' || result === 'SUCCESS') return '通过'
  if (result === 'FAILED') return '失败'
  if (result === 'SKIPPED') return '跳过'
  return result || '未知'
}

function formatDateTime(value?: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function runResultClass(result: string | null) {
  if (result === 'PASSED' || result === 'SUCCESS') return 'is-success'
  if (result === 'FAILED') return 'is-danger'
  if (result === 'SKIPPED') return 'is-warning'
  return ''
}

function resolveActionWorkspaceCode() {
  if (!props.workspaceCode || props.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再操作执行套件')
    return ''
  }
  return props.workspaceCode
}

async function promptExecutionText(title: string, message: string, placeholder: string, value = '') {
  try {
    const result = await ElMessageBox.prompt(message, title, {
      inputValue: value,
      inputPlaceholder: placeholder,
      inputValidator: (input: string) => Boolean(input.trim()) || `${placeholder}不能为空`,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      customClass: 'execution-soft-message-box',
    })
    return result.value.trim()
  } catch {
    return ''
  }
}

async function renameSuiteModule(node: ExecutionSuiteNode) {
  if (!node.moduleId || !node.workspaceCode) return
  const name = await promptExecutionText('重命名模块', '请输入模块名称', '模块名称', node.name)
  if (!name || name === node.name) return
  try {
    await apiExecutionSuiteApi.updateSuiteModule(node.workspaceCode, node.moduleId, { name })
    ElMessage.success('模块已更新')
    await loadExecutionSuiteDirectory()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function deleteSuiteModule(node: ExecutionSuiteNode) {
  if (!node.moduleId || !node.workspaceCode) return
  try {
    await ElMessageBox.confirm('只能删除空模块，确认删除吗？', '删除模块', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'execution-soft-message-box',
    })
  } catch {
    return
  }
  try {
    await apiExecutionSuiteApi.deleteSuiteModule(node.workspaceCode, node.moduleId)
    if (activeSuiteId.value === node.key) activeSuiteId.value = ''
    ElMessage.success('模块已删除')
    await loadExecutionSuiteDirectory()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function getRequestErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return '请求失败，请稍后重试'
}

async function handleRunSuite() {
  if (props.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再运行套件')
    return
  }
  if (!activeSuiteDetail.value) {
    ElMessage.warning('请先选择执行套件')
    return
  }
  suiteRunning.value = true
  try {
    await apiExecutionSuiteApi.runSuite(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, {
      workspaceCode: activeSuiteDetail.value.workspaceCode,
      environmentId: typeof executionVisualEnvironment.value === 'number' ? executionVisualEnvironment.value : null,
      variableSetId: activeSuiteDetail.value.variableSetId,
    })
    ElMessage.success('套件已开始运行')
    await loadSuiteDetail(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id)
    if (activeExecutionSubTab.value === 'result') {
      await loadSuiteRunHistories()
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteRunning.value = false
  }
}

async function handleSaveSuite() {
  if (props.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再保存套件配置')
    return
  }
  if (!activeSuiteDetail.value) {
    ElMessage.warning('请先选择执行套件')
    return
  }
  suiteSaving.value = true
  try {
    activeSuiteDetail.value = await apiExecutionSuiteApi.updateSuite(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, {
      workspaceCode: activeSuiteDetail.value.workspaceCode,
      moduleId: activeSuiteDetail.value.moduleId,
      name: activeSuiteDetail.value.name,
      priority: activeSuiteDetail.value.priority,
      status: activeSuiteDetail.value.status,
      description: activeSuiteDetail.value.description,
      environmentId: typeof executionVisualEnvironment.value === 'number' ? executionVisualEnvironment.value : null,
      variableSetId: activeSuiteDetail.value.variableSetId,
      runMode: executionVisualRunMode.value.toUpperCase(),
      runOn: executionVisualRunOn.value.toUpperCase(),
      notifyEnabled: executionVisualNotify.value,
      continueOnFailure: activeSuiteDetail.value.continueOnFailure,
      globalTimeoutMs: activeSuiteDetail.value.globalTimeoutMs,
      stepFailureRetryCount: activeSuiteDetail.value.stepFailureRetryCount,
      defaultStepWaitMs: activeSuiteDetail.value.defaultStepWaitMs,
      scheduleEnabled: executionScheduleEnabled.value,
      cronExpression: executionCronExpression.value.trim() || null,
      branchName: executionBranchName.value.trim() || null,
      triggerSource: executionTriggerSource.value.trim() || null,
      branchNote: executionBranchNote.value.trim() || null,
    })
    syncSuiteConfigForm()
    ElMessage.success('套件配置已保存')
    await loadExecutionSuiteDirectory()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteSaving.value = false
  }
}

function showPending(message: string) {
  ElMessage.info(message)
}
</script>

<template>
  <div class="execution-workbench">
    <aside class="execution-suite-pane">
      <div class="execution-suite-tools">
        <el-button type="primary" class="execution-primary-button" @click="handleCreateSuite">
          <Plus class="execution-primary-button-icon" />
          新建套件
        </el-button>
        <el-input v-model="suiteKeyword" class="execution-search-box" placeholder="搜索模块或套件名称" clearable>
          <template #prefix>
            <Search class="execution-search-icon" />
          </template>
        </el-input>
      </div>

      <div class="execution-suite-tree">
        <div class="execution-suite-title-row">
          <div class="execution-suite-title-main">
            <span>测试套件</span>
            <small>{{ suiteTotalCount }}</small>
          </div>
          <div class="execution-suite-title-actions">
            <button
              type="button"
              class="execution-directory-collapse-button"
              title="收起全部子模块"
              @click.stop="collapseAllSuiteTreeChildren"
            >
              <el-icon class="tree-collapse-icon"><Fold /></el-icon>
            </button>
          </div>
        </div>
        <el-tree
          v-if="hasVisibleSuites"
          v-loading="suiteTreeLoading"
          :data="filteredSuiteTree"
          node-key="key"
          :default-expanded-keys="expandedSuiteTreeKeys"
          highlight-current
          :expand-on-click-node="false"
          :current-node-key="activeSuiteId || undefined"
          class="ms-like-directory-tree execution-suite-list"
          @current-change="handleSuiteTreeSelect"
        >
          <template #default="{ data }">
            <div :class="['execution-suite-node', { 'is-leaf': data.type === 'suite' }]">
              <div class="execution-suite-node-main">
                <span
                  v-if="data.type === 'workspace' || data.type === 'module'"
                  class="execution-suite-folder-wrap is-open"
                  aria-hidden="true"
                >
                  <FolderOpen class="execution-suite-folder" />
                </span>
                <span v-else class="execution-suite-folder-wrap" aria-hidden="true">
                  <Folder class="execution-suite-folder" />
                </span>
                <span class="execution-suite-node-label">{{ data.name }}</span>
                <span v-if="data.type !== 'suite'" class="execution-suite-count">{{ data.suiteCount }}</span>
              </div>
              <div class="execution-suite-actions" @click.stop>
                <el-button
                  v-if="data.type === 'workspace' || data.type === 'module'"
                  text
                  class="tree-icon-button"
                  title="新建子模块"
                  @click.stop="handleCreateSuiteModule(data)"
                >
                  <el-icon><Plus /></el-icon>
                </el-button>
                <el-dropdown
                  v-if="data.type === 'module'"
                  trigger="click"
                  popper-class="definition-tree-action-menu"
                  @command="(command: string | number | object) => handleSuiteModuleCommand(command, data)"
                >
                  <el-button
                    text
                    class="tree-icon-button definition-tree-more-button"
                    title="更多操作"
                    aria-label="更多操作"
                    @click.stop
                  >
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="rename" class="definition-tree-action-item">重命名</el-dropdown-item>
                      <el-dropdown-item command="delete" class="definition-tree-action-item definition-tree-action-danger">删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </template>
        </el-tree>
        <div v-else class="execution-suite-empty">
          暂无匹配套件
        </div>
      </div>
    </aside>

    <main class="execution-main-pane">
      <div class="execution-suite-tab-strip">
        <button
          v-for="suite in openedSuiteTabs"
          :key="suite.id"
          type="button"
          :class="['execution-suite-tab', { active: activeSuiteKey === `suite:${suite.id}` }]"
          @click="switchSuiteTab(suite)"
        >
          <span class="execution-suite-tab-label">{{ suite.name }}</span>
          <X @click.stop="closeSuiteTab(suite)" />
        </button>
        <button type="button" class="execution-tab-icon" @click="handleCreateSuite">
          <Plus />
        </button>
        <el-dropdown
          trigger="click"
          popper-class="execution-suite-more-menu"
          @command="handleSuiteMoreCommand"
        >
          <button type="button" class="execution-tab-icon">
            <MoreHorizontal />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                command="delete"
                :disabled="!activeSuiteDetail"
                class="execution-suite-more-danger"
              >
                删除当前套件
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div v-if="activeSuiteDetail" v-loading="suiteDetailLoading" class="execution-content-row">
        <section class="execution-suite-content">
          <div class="execution-sub-tab-row">
            <button
              v-for="tab in executionSubTabs"
              :key="tab.key"
              type="button"
              :class="['execution-sub-tab', { active: tab.key === activeExecutionSubTab }]"
              @click="switchExecutionSubTab(tab.key)"
            >
              <component :is="tab.icon" />
              {{ tab.label }}
            </button>
          </div>

          <div class="execution-suite-header">
            <div class="execution-suite-name-row">
              <span class="execution-priority-badge">{{ activeSuiteDetail.priority }}</span>
              <strong>{{ activeSuiteName }}</strong>
            </div>
            <p>{{ activeSuiteDescription }}</p>
            <div class="execution-suite-meta">
              <Clock />
              <span>{{ activeSuiteWorkspaceName }}</span>
              <span>更新于 {{ activeSuiteUpdatedAt }}</span>
              <span>·</span>
              <span>{{ activeSuiteModuleLabel }}</span>
            </div>
          </div>

          <div v-if="activeExecutionSubTab === 'arrange'" class="execution-case-list">
            <div class="execution-case-toolbar">
              <span>共 {{ visibleExecutionSuiteCases.length }} 个内容</span>
              <div>
                <button type="button" @click="openArrangePicker('api')">
                  <Plus />
                  添加接口用例
                </button>
                <button type="button" @click="openArrangePicker('scene')">
                  <Plus />
                  添加场景
                </button>
              </div>
            </div>
            <div v-for="item in visibleExecutionSuiteCases" :key="item.id" class="execution-case-row">
              <GripVertical />
              <span :class="['execution-case-type', item.type === 'scene' ? 'is-scene' : 'is-api']">
                <component :is="item.type === 'scene' ? Zap : Link" />
                {{ item.type === 'scene' ? '场景' : '接口' }}
              </span>
              <strong>{{ item.name }}</strong>
              <template v-if="item.type === 'api' && (item.method || item.path)">
                <span :class="['scenario-step-method', requestMethodClass(item.method)]">{{ item.method }}</span>
                <code>{{ item.path }}</code>
              </template>
              <span v-else class="execution-case-desc">{{ item.description }}</span>
              <div class="execution-case-actions">
                <button type="button" @click="moveArrangeItem(item, -1)">上移</button>
                <button type="button" @click="moveArrangeItem(item, 1)">下移</button>
                <button type="button" class="is-danger" @click="deleteArrangeItem(item)">删除</button>
              </div>
            </div>
          </div>
          <div v-else-if="activeExecutionSubTab === 'result'" v-loading="suiteRunHistoryLoading" class="execution-result-panel">
            <div class="execution-result-list">
              <button
                v-for="history in suiteRunHistories"
                :key="history.id"
                type="button"
                :class="['execution-result-row', { active: suiteRunHistoryDetail?.id === history.id }]"
                @click="selectSuiteRunHistory(history)"
              >
                <span :class="['execution-result-badge', runResultClass(history.result)]">
                  {{ formatRunResult(history.result) }}
                </span>
                <strong>{{ history.suiteName }}</strong>
                <small>{{ formatDateTime(history.createdAt) }}</small>
                <span>{{ history.successCount }}/{{ history.totalCount }}</span>
                <span>{{ history.durationMs }}ms</span>
              </button>
              <div v-if="!suiteRunHistories.length" class="execution-result-empty">
                <strong>暂无运行记录</strong>
                <span>运行套件后可查看步骤明细、耗时和失败原因</span>
              </div>
            </div>
            <div class="execution-result-detail">
              <template v-if="suiteRunHistoryDetail">
                <div class="execution-result-detail-head">
                  <span :class="['execution-result-badge', runResultClass(suiteRunHistoryDetail.result)]">
                    {{ formatRunResult(suiteRunHistoryDetail.result) }}
                  </span>
                  <strong>{{ suiteRunHistoryDetail.suiteName }}</strong>
                  <small>{{ suiteRunHistoryDetail.failureSummary || '无失败摘要' }}</small>
                </div>
                <div
                  v-for="step in suiteRunHistoryDetail.stepResults"
                  :key="`${step.stepOrder}-${step.stepName}`"
                  class="execution-result-step"
                >
                  <span :class="['execution-result-badge', step.success ? 'is-success' : 'is-danger']">
                    {{ step.success ? '通过' : '失败' }}
                  </span>
                  <strong>{{ step.stepName }}</strong>
                  <small>{{ step.durationMs }}ms</small>
                  <p v-if="step.errorMessage">{{ step.errorMessage }}</p>
                </div>
              </template>
              <div v-else class="execution-result-empty">
                <strong>未选择运行记录</strong>
                <span>点击左侧记录查看步骤明细</span>
              </div>
            </div>
          </div>
          <div v-else-if="activeExecutionSubTab === 'schedule'" class="execution-sub-config-panel">
            <label class="execution-config-switch is-form-row">
              <div>
                <Clock />
                <span>启用定时</span>
              </div>
              <el-switch v-model="executionScheduleEnabled" />
            </label>
            <label>
              <span>Cron 表达式</span>
              <el-input v-model="executionCronExpression" placeholder="例如 0 0 9 * * ?" />
            </label>
            <p>当前仅保存定时配置，真实调度执行由后续调度服务接入。</p>
          </div>
          <div v-else class="execution-sub-config-panel">
            <label>
              <span>分支名称</span>
              <el-input v-model="executionBranchName" placeholder="main / release / feature" />
            </label>
            <label>
              <span>触发来源</span>
              <el-input v-model="executionTriggerSource" placeholder="手动 / CI / Webhook" />
            </label>
            <label>
              <span>备注</span>
              <el-input v-model="executionBranchNote" type="textarea" :rows="4" placeholder="记录分支用途、触发条件或外部流水线说明" />
            </label>
            <p>当前仅保存分支和触发来源信息，真实 CI 分支触发由后续执行服务接入。</p>
          </div>
        </section>

        <aside class="execution-config-panel">
          <div class="execution-config-card">
            <div class="execution-config-head">
              <el-select v-model="executionVisualEnvironment" placeholder="开户-UAT" class="execution-config-select">
                <el-option
                  v-for="environment in visibleEnvironmentOptions"
                  :key="environment.id"
                  :label="environment.name"
                  :value="environment.id"
                />
                <el-option v-if="!visibleEnvironmentOptions.length" label="开户-UAT" value="uat" />
              </el-select>
              <el-button class="execution-config-icon" @click="showPending('执行环境配置后续接入')">
                <Settings2 />
              </el-button>
              <div class="execution-run-buttons">
                <el-button
                  type="primary"
                  class="execution-run-button"
                  :loading="suiteRunning"
                  :disabled="!props.workspaceReady || !activeSuiteDetail"
                  @click="handleRunSuite"
                >
                  <Play />
                  运行
                </el-button>
                <el-button
                  class="execution-save-button"
                  :loading="suiteSaving"
                  :disabled="!activeSuiteDetail"
                  @click="handleSaveSuite"
                >
                  <Save />
                  保存
                </el-button>
              </div>
            </div>
            <div class="execution-config-body">
              <label>
                <span>运行模式</span>
                <el-select v-model="executionVisualRunMode">
                  <el-option label="串行运行" value="serial" />
                  <el-option label="并行运行" value="parallel" />
                </el-select>
              </label>
              <label>
                <span>运行于</span>
                <el-select v-model="executionVisualRunOn">
                  <el-option label="本地执行机" value="local" />
                  <el-option label="远程执行机" value="remote" />
                </el-select>
              </label>
              <div class="execution-config-switch">
                <div>
                  <Bell />
                  <span>通知</span>
                </div>
                <el-switch v-model="executionVisualNotify" />
              </div>
              <div class="execution-config-stats">
                <div><span>上次运行</span><strong>{{ activeSuiteDetail.lastRunResult || '未运行' }}</strong></div>
                <div><span>运行时长</span><strong>--</strong></div>
                <div><span>用例数</span><strong>{{ visibleExecutionSuiteCases.length }} 个</strong></div>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <div v-else class="execution-suite-empty-state">
        <FileText />
        <strong>请选择或新建执行套件</strong>
        <span>左侧目录用于管理套件模块和套件，选择套件后维护编排、定时、分支和运行结果。</span>
      </div>
    </main>

    <el-drawer
      v-model="arrangePickerVisible"
      :title="arrangePickerTitle"
      size="1200px"
      destroy-on-close
      append-to-body
      class="api-soft-drawer scenario-import-drawer execution-arrange-picker"
      @closed="selectedArrangeCandidateIds = []"
    >
      <div class="scenario-import-shell" v-loading="arrangeCandidateLoading">
        <el-tabs :model-value="arrangePickerType" class="scenario-import-tabs execution-arrange-tabs">
          <el-tab-pane :label="arrangePickerTypeLabel" :name="arrangePickerType" />
        </el-tabs>
        <div class="scenario-import-content">
          <aside class="scenario-import-tree-pane">
            <div class="scenario-import-tree-controls">
              <el-select :model-value="activeSuiteDetail?.workspaceCode || props.workspaceCode" disabled placeholder="空间">
                <el-option :label="activeSuiteWorkspaceName" :value="activeSuiteDetail?.workspaceCode || props.workspaceCode" />
              </el-select>
              <el-select v-if="arrangePickerType === 'api'" model-value="HTTP" class="scenario-import-protocol" disabled>
                <el-option label="HTTP" value="HTTP" />
              </el-select>
            </div>
            <el-input
              v-model="arrangeCandidateKeyword"
              :placeholder="`输入${arrangePickerTypeLabel}名称搜索`"
              clearable
              @keyup.enter="handleArrangeCandidateSearch"
              @clear="handleArrangeCandidateSearch"
            />
            <el-tree
              :data="[{
                key: 'execution-arrange-all',
                label: arrangePickerType === 'api' ? '全部用例' : '全部场景',
                count: arrangeCandidateTotal,
                children: [{
                  key: 'execution-arrange-workspace',
                  label: activeSuiteWorkspaceName,
                  count: arrangeCandidateTotal,
                  children: [],
                }],
              }]"
              node-key="key"
              highlight-current
              :expand-on-click-node="false"
              current-node-key="execution-arrange-all"
              class="scenario-import-tree"
              default-expand-all
            >
              <template #default="{ data }">
                <div class="scenario-import-tree-node">
                  <span class="scenario-import-tree-label">{{ data.label }}</span>
                  <span class="scenario-import-tree-count">{{ data.count }}</span>
                </div>
              </template>
            </el-tree>
          </aside>
          <section class="scenario-import-table-pane">
            <div class="scenario-import-table-toolbar">
              <div class="scenario-import-table-title">
                {{ arrangePickerType === 'api' ? '全部用例' : '全部场景' }}
                <span>({{ arrangeCandidateTotal }})</span>
              </div>
            </div>
            <el-table
              v-if="arrangePickerType === 'api'"
              :data="caseCandidates"
              row-key="id"
              height="520"
              size="small"
              @selection-change="handleArrangeCaseSelection"
            >
              <el-table-column type="selection" width="44" :selectable="(row: ApiDefinitionCaseItem) => !addedArrangeItemIds.has(row.id)" />
              <el-table-column label="ID" width="110">
                <template #default="{ row }">{{ 100000 + row.id }}</template>
              </el-table-column>
              <el-table-column prop="name" label="用例名称" min-width="180" show-overflow-tooltip />
              <el-table-column label="请求类型" width="110">
                <template #default="{ row }">
                  <span :class="['scenario-import-method-tag', requestMethodClass(row.method)]">{{ row.method }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="path" label="路径" min-width="220" show-overflow-tooltip />
              <el-table-column prop="definitionName" label="所属接口" min-width="160" show-overflow-tooltip />
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <span v-if="addedArrangeItemIds.has(row.id)" class="execution-import-added">已在套件中</span>
                  <span v-else>{{ row.lastRunResult || '未运行' }}</span>
                </template>
              </el-table-column>
            </el-table>
            <el-table
              v-else
              :data="scenarioCandidates"
              row-key="id"
              height="520"
              size="small"
              @selection-change="handleArrangeScenarioSelection"
            >
              <el-table-column type="selection" width="44" :selectable="(row: ApiScenarioItem) => !addedArrangeItemIds.has(row.id)" />
              <el-table-column label="ID" width="110">
                <template #default="{ row }">{{ 100000 + row.id }}</template>
              </el-table-column>
              <el-table-column prop="name" label="场景名称" min-width="220" show-overflow-tooltip />
              <el-table-column prop="moduleName" label="所属模块" min-width="150" show-overflow-tooltip />
              <el-table-column prop="stepCount" label="步骤数" width="100" />
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <span v-if="addedArrangeItemIds.has(row.id)" class="execution-import-added">已在套件中</span>
                  <span v-else>{{ row.status || '进行中' }}</span>
                </template>
              </el-table-column>
            </el-table>
            <div v-if="!arrangeCandidateLoading && !visibleArrangeCandidates.length" class="execution-import-empty">
              暂无可添加{{ arrangePickerTypeLabel }}
            </div>
          </section>
        </div>
      </div>
      <template #footer>
        <div class="scenario-import-footer">
          <div class="scenario-import-summary">
            <span>共选择 <strong>{{ selectedArrangeAvailableCount }}</strong></span>
            <span>{{ arrangePickerTypeLabel }} <strong>{{ selectedArrangeAvailableCount }}</strong></span>
            <span>当前页 <strong>{{ visibleArrangeCandidates.length }}</strong></span>
            <span>共 <strong>{{ arrangeCandidateTotal }}</strong></span>
          </div>
          <el-pagination
            v-if="arrangeCandidateTotal > arrangeCandidatePageSize"
            background
            layout="prev, pager, next"
            :current-page="arrangeCandidatePageNo"
            :page-size="arrangeCandidatePageSize"
            :total="arrangeCandidateTotal"
            @current-change="handleArrangeCandidatePageChange"
          />
          <div class="scenario-import-actions">
            <el-button @click="arrangePickerVisible = false">取消</el-button>
            <el-button type="primary" :disabled="!selectedArrangeAvailableCount" @click="addSelectedArrangeItems">
              添加
            </el-button>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.execution-workbench {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 256px minmax(0, 1fr);
  overflow: hidden;
  background: #ffffff;
}

.execution-suite-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
}

.execution-suite-tools {
  display: grid;
  gap: 12px;
  padding: 16px 16px 12px;
}

.execution-case-toolbar button,
.execution-run-button,
.execution-save-button,
.execution-config-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.execution-primary-button {
  width: 100%;
  height: 36px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.execution-primary-button-icon,
.execution-search-icon,
.execution-tab-icon svg,
.execution-suite-tab svg,
.execution-sub-tab svg,
.execution-case-row svg,
.execution-config-panel svg {
  width: 16px;
  height: 16px;
}

.execution-search-box :deep(.el-input__wrapper) {
  min-height: 36px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.execution-search-icon {
  color: #9ca3af;
}

.execution-suite-tree {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding: 0 12px 12px;
}

.execution-suite-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  margin: 0 -4px 8px;
  padding: 0 8px;
  border-bottom: 1px solid #e5e7eb;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.execution-suite-title-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.execution-suite-title-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.execution-suite-title-main small,
.execution-suite-count {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.execution-suite-title-main small,
.execution-suite-count {
  background: transparent;
  padding: 0;
}

.execution-suite-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.execution-suite-list :deep(.el-tree-node__content) {
  height: 32px;
  border-radius: 8px;
  color: #374151;
  font-size: 14px;
}

.execution-suite-list :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #eff6ff;
  color: #2563eb;
}

.execution-suite-list :deep(.el-tree-node__content:hover) {
  background: #f3f4f6;
}

.execution-suite-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
  color: #374151;
  font-size: 14px;
}

.execution-suite-node-main {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.execution-suite-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.execution-suite-node:hover .execution-suite-actions,
.execution-suite-node:focus-within .execution-suite-actions {
  opacity: 1;
}

.execution-directory-collapse-button,
.tree-icon-button {
  display: inline-flex;
  width: 24px;
  height: 24px;
  min-width: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}

.tree-icon-button.el-button {
  margin-left: 0;
  padding: 0;
}

.execution-directory-collapse-button:hover,
.tree-icon-button:hover {
  background: #f3f4f6;
  color: #2563eb;
}

.tree-icon-button :deep(.el-icon),
.execution-directory-collapse-button :deep(.el-icon) {
  font-size: 14px;
}

.execution-suite-node-label {
  min-width: 0;
  overflow: hidden;
  color: #374151;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-suite-count {
  flex: 0 0 auto;
}

.execution-suite-folder-wrap {
  display: inline-flex;
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  align-items: center;
  justify-content: center;
  color: #60a5fa;
}

.execution-suite-folder-wrap.is-open,
.execution-suite-node.active .execution-suite-folder-wrap {
  color: #3b82f6;
}

.execution-suite-folder {
  width: 16px;
  height: 16px;
  color: currentColor;
}

.execution-suite-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  padding: 12px;
  color: #9ca3af;
  font-size: 13px;
  line-height: 20px;
}

:global(.execution-suite-more-danger) {
  color: #ef4444;
}

:global(.execution-suite-more-danger:not(.is-disabled):hover) {
  background: #fef2f2;
  color: #dc2626;
}

.execution-main-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.execution-suite-tab-strip {
  display: flex;
  align-items: center;
  height: 40px;
  min-height: 40px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.execution-suite-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 40px;
  max-width: 180px;
  gap: 8px;
  padding: 0 16px;
  border: 0;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
  color: #111827;
  cursor: pointer;
  font-size: 14px;
}

.execution-suite-tab.active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: #3b82f6;
}

.execution-suite-tab:not(.active) {
  background: #f9fafb;
  color: #6b7280;
}

.execution-suite-tab svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  border-radius: 999px;
  color: #667085;
  opacity: 0.42;
  transition: opacity 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.execution-suite-tab-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-suite-tab:hover svg {
  background: rgba(15, 23, 42, 0.08);
  color: #344054;
  opacity: 1;
}

.execution-tab-icon {
  width: 32px;
  height: 39px;
  border: 0;
  background: #ffffff;
  color: #9ca3af;
  cursor: pointer;
}

.execution-tab-icon:hover {
  background: #f3f4f6;
  color: #4b5563;
}

.execution-content-row {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1fr) 288px;
}

.execution-suite-content {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #e5e7eb;
}

.execution-sub-tab-row {
  display: flex;
  align-items: center;
  min-height: 40px;
  gap: 18px;
  padding: 0 16px;
  border-bottom: 1px solid #e5e7eb;
}

.execution-sub-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 40px;
  gap: 6px;
  border: 0;
  background: transparent;
  color: #4b5563;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

.execution-sub-tab.active {
  color: #2563eb;
  font-weight: 500;
}

.execution-sub-tab.active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: #2563eb;
}

.execution-suite-header {
  display: grid;
  gap: 8px;
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.execution-suite-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.execution-suite-name-row strong {
  color: #111827;
  font-size: 18px;
  font-weight: 600;
}

.execution-priority-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 10px;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  background: #ffedd5;
  color: #c2410c;
  font-size: 12px;
  font-weight: 700;
}

.execution-suite-header p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.execution-suite-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 12px;
}

.execution-suite-meta svg {
  width: 13px;
  height: 13px;
}

.execution-case-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.execution-case-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 0 16px;
  border-bottom: 1px solid #f3f4f6;
  background: #f9fafb;
  color: #6b7280;
  font-size: 13px;
  line-height: 18px;
}

.execution-case-toolbar > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.execution-case-toolbar button {
  height: 28px;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
}

.execution-case-toolbar button svg {
  width: 16px;
  height: 16px;
}

.execution-case-toolbar button:hover {
  background: #f3f4f6;
}

.execution-case-row {
  display: flex;
  align-items: center;
  min-height: 46px;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid #f3f4f6;
}

.execution-case-row:hover {
  background: rgba(239, 246, 255, 0.42);
}

.execution-case-row > svg {
  flex: 0 0 auto;
  color: #d1d5db;
}

.execution-case-row strong {
  width: 160px;
  flex: 0 0 auto;
  overflow: hidden;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-case-type {
  display: inline-flex;
  align-items: center;
  height: 22px;
  flex: 0 0 auto;
  gap: 4px;
  padding: 0 8px;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.execution-case-type.is-scene {
  border-color: #e9d5ff;
  background: #faf5ff;
  color: #9333ea;
}

.execution-case-type svg {
  width: 12px;
  height: 12px;
}

.execution-case-row code,
.execution-case-desc {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: #9ca3af;
  font-family: Consolas, 'SFMono-Regular', Menlo, monospace;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-case-desc {
  font-family: inherit;
}

.execution-case-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.execution-case-row:hover .execution-case-actions {
  opacity: 1;
}

.execution-case-actions button {
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 12px;
}

.execution-case-actions button:hover {
  background: #f3f4f6;
  color: #2563eb;
}

.execution-case-actions button.is-danger:hover {
  background: #fef2f2;
  color: #ef4444;
}

.scenario-step-method {
  flex: 0 0 auto;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.scenario-step-method.is-post {
  color: #f97316;
}

.scenario-step-method.is-put,
.scenario-step-method.is-patch {
  color: #8b5cf6;
}

.scenario-step-method.is-delete {
  color: #ef4444;
}

.execution-config-panel {
  padding: 10px 12px;
  background: #ffffff;
}

.execution-config-card {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #edf0f5;
  border-radius: 8px;
  background: #ffffff;
}

.execution-config-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid #edf0f5;
}

.execution-config-select {
  min-width: 0;
}

.execution-config-select :deep(.el-select__wrapper),
.execution-config-body :deep(.el-select__wrapper) {
  min-height: 36px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.execution-config-icon {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 8px;
  color: #9ca3af;
}

.execution-run-buttons {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.execution-run-button,
.execution-save-button {
  height: 36px;
  gap: 6px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  margin-left: 0 !important;
}

.execution-config-body {
  display: grid;
  align-content: start;
  gap: 12px;
  overflow: auto;
  padding: 10px;
}

.execution-config-body label {
  display: grid;
  gap: 6px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.execution-config-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.execution-config-switch > div {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #374151;
  font-size: 14px;
}

.execution-config-switch svg {
  color: #9ca3af;
}

.execution-config-stats {
  display: grid;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #edf0f5;
}

.execution-config-stats div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #9ca3af;
  font-size: 12px;
}

.execution-config-stats strong {
  min-width: 0;
  overflow: hidden;
  color: #374151;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-suite-empty-state {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: #9ca3af;
  text-align: center;
}

.execution-suite-empty-state svg {
  width: 28px;
  height: 28px;
  color: #bfdbfe;
}

.execution-suite-empty-state strong {
  color: #374151;
  font-size: 14px;
  font-weight: 600;
}

.execution-suite-empty-state span {
  max-width: 360px;
  color: #9ca3af;
  font-size: 13px;
  line-height: 20px;
}

.execution-suite-empty-state.is-inline {
  min-height: 240px;
  border-top: 1px solid #f3f4f6;
}

.execution-result-panel {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  grid-template-columns: minmax(260px, 36%) minmax(0, 1fr);
  overflow: hidden;
}

.execution-result-list,
.execution-result-detail {
  min-height: 0;
  overflow: auto;
}

.execution-result-list {
  border-right: 1px solid #e5e7eb;
}

.execution-result-row {
  display: grid;
  width: 100%;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 6px 10px;
  padding: 10px 14px;
  border: 0;
  border-bottom: 1px solid #f3f4f6;
  background: #ffffff;
  color: #6b7280;
  cursor: pointer;
  text-align: left;
}

.execution-result-row:hover,
.execution-result-row.active {
  background: #eff6ff;
}

.execution-result-row strong,
.execution-result-detail-head strong,
.execution-result-step strong {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-result-row small,
.execution-result-detail-head small,
.execution-result-step small {
  color: #9ca3af;
  font-size: 12px;
}

.execution-result-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.execution-result-badge.is-success {
  background: #dcfce7;
  color: #15803d;
}

.execution-result-badge.is-danger {
  background: #fee2e2;
  color: #dc2626;
}

.execution-result-badge.is-warning {
  background: #ffedd5;
  color: #c2410c;
}

.execution-result-detail {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 12px;
}

.execution-result-detail-head,
.execution-result-step {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.execution-result-step {
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
}

.execution-result-step p {
  grid-column: 1 / -1;
  margin: 0;
  color: #dc2626;
  font-size: 12px;
  line-height: 18px;
}

.execution-result-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 160px;
  color: #9ca3af;
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

.execution-result-empty strong {
  color: #374151;
  font-size: 13px;
  font-weight: 600;
}

.execution-result-empty span {
  max-width: 220px;
}

.execution-sub-config-panel {
  display: grid;
  align-content: start;
  gap: 14px;
  max-width: 560px;
  padding: 20px 24px;
}

.execution-sub-config-panel label {
  display: grid;
  gap: 8px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.execution-sub-config-panel :deep(.el-input__wrapper),
.execution-sub-config-panel :deep(.el-textarea__inner) {
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.execution-sub-config-panel :deep(.el-input__wrapper) {
  min-height: 36px;
}

.execution-config-switch.is-form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
}

.execution-sub-config-panel p {
  margin: 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 18px;
}

.scenario-import-shell {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  background: #ffffff;
}

:global(.scenario-import-drawer .el-drawer__header) {
  min-height: 56px;
  margin-bottom: 0;
  padding: 0 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

:global(.scenario-import-drawer .el-drawer__body) {
  padding: 0;
  overflow: hidden;
}

:global(.scenario-import-drawer .el-drawer__footer) {
  padding: 14px 16px;
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
}

.scenario-import-tabs {
  flex: 0 0 auto;
}

.scenario-import-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
}

.execution-arrange-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}

.scenario-import-content {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 300px minmax(0, 1fr);
}

.scenario-import-tree-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
}

.scenario-import-tree-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 88px;
  gap: 8px;
}

.scenario-import-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.scenario-import-tree :deep(.el-tree) {
  background: transparent;
}

.scenario-import-tree :deep(.el-tree-node__content) {
  height: 34px;
  border-radius: 8px;
  color: #374151;
}

.scenario-import-tree :deep(.el-tree-node__content:hover) {
  background: #f3f4f6;
}

.scenario-import-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #eff6ff;
  color: #2563eb;
}

.scenario-import-tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  gap: 8px;
}

.scenario-import-tree-label {
  min-width: 0;
  overflow: hidden;
  color: inherit;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-import-tree-count {
  flex: 0 0 auto;
  color: #9ca3af;
  font-size: 12px;
}

.scenario-import-table-pane {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 16px;
  background: #ffffff;
}

.scenario-import-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  margin-bottom: 10px;
}

.scenario-import-table-title {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.scenario-import-table-title span {
  margin-left: 4px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 400;
}

.scenario-import-method-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 22px;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
}

.scenario-import-method-tag.is-post {
  background: #fff7ed;
  color: #ea580c;
}

.scenario-import-method-tag.is-put {
  background: #faf5ff;
  color: #9333ea;
}

.scenario-import-method-tag.is-delete {
  background: #fef2f2;
  color: #dc2626;
}

.scenario-import-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
}

.scenario-import-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #6b7280;
  font-size: 13px;
}

.scenario-import-summary strong {
  color: #2563eb;
}

.scenario-import-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.execution-import-added {
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
}

.execution-import-empty {
  position: absolute;
  right: 16px;
  bottom: 16px;
  left: 16px;
  display: flex;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
  color: #9ca3af;
  font-size: 13px;
  pointer-events: none;
}

</style>
