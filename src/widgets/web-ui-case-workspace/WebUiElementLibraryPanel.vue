<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { CollectionTag, Cpu, Delete, Document, Edit, Folder, Grid, Plus, RefreshRight, Search, VideoPlay, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'
import {
  formatLocatorType,
  formatWebUiDateTime,
  webUiAutomationApi,
  WEB_UI_CASE_STATUS_OPTIONS,
  WEB_UI_LOCATOR_OPTIONS,
  type SaveWebUiElementGroupPayload,
  type SaveWebUiElementModulePayload,
  type SaveWebUiElementPagePayload,
  type SaveWebUiElementPayload,
  type ValidateWebUiLocatorResponse,
  type WebUiElementGroupItem,
  type WebUiElementItem,
  type WebUiElementCollectFilterSummary,
  type WebUiElementCollectTaskResponse,
  type WebUiElementModuleItem,
  type WebUiElementPageItem,
  type WebUiElementValidateResultItem,
  type WebUiElementQualityIssue,
  type WebUiElementReferenceItem,
  type WebUiEnvironmentItem,
  type WebUiLocatorType,
} from '@/entities/web-ui-automation'
import {
  captureLocalRunnerPage,
  checkLocalRunnerHealth,
  mapRunnerCandidateToCollectCandidate,
  openLocalRunnerPage,
  saveLocalRunnerAuth,
  type LocalRunnerHealthView,
} from '@/entities/web-ui-automation/lib/localRunnerClient'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import WebUiElementAiCollectDrawer from './WebUiElementAiCollectDrawer.vue'
import WebUiElementDetailDrawer from './WebUiElementDetailDrawer.vue'
import WebUiElementImpactDrawer from './WebUiElementImpactDrawer.vue'
import WebUiElementQualityDrawer from './WebUiElementQualityDrawer.vue'
import WebUiElementReferenceDrawer from './WebUiElementReferenceDrawer.vue'
import WebUiElementValidateDrawer from './WebUiElementValidateDrawer.vue'

type DirectoryNodeType = 'ALL' | 'WORKSPACE' | 'MODULE' | 'PAGE' | 'GROUP'

interface ElementDirectoryNode {
  id: string
  type: DirectoryNodeType
  rawId: number | null
  workspaceCode: string | null
  label: string
  elementCount: number
  children: ElementDirectoryNode[]
}

type TreeSelection = {
  id: string
  type: DirectoryNodeType
  rawId: number | null
  workspaceCode: string | null
  label: string
}

type AiCollectMode = 'ONLINE' | 'OFFLINE'
type AiCollectScope = 'ALL' | 'FORM' | 'BUTTON' | 'TABLE' | 'DIALOG'
type AiCollectGroupStrategy = 'AI' | 'CUSTOM'
type ElementImportRow = {
  moduleName?: string
  pageName?: string
  pagePath?: string
  groupName?: string
  elementName?: string
  locatorType?: WebUiLocatorType | string
  locatorValue?: string
  description?: string
  status?: 'ENABLED' | 'DISABLED' | string
}
type LocalQualityIssueLevel = WebUiElementQualityIssue['level']
type LocalQualityIssueKind = 'DUPLICATE_NAME' | 'DUPLICATE_LOCATOR' | 'DISABLED_USED' | 'EMPTY_PAGE' | 'EMPTY_GROUP'
type QualityIssueFilter = 'ALL' | 'DUPLICATE' | 'DISABLED_USED' | 'EMPTY' | 'BACKEND'
type LocalQualityIssue = {
  id: string
  level: LocalQualityIssueLevel
  kind: LocalQualityIssueKind
  title: string
  description: string
  elementId?: number | null
  elementName?: string
  workspaceCode?: string | null
  pageId?: number | null
  groupId?: number | null
  pageName?: string
  groupName?: string | null
  locatorType?: WebUiLocatorType | null
  locatorValue?: string | null
  usageCount?: number
}
type ElementImpactReference = WebUiElementReferenceItem & {
  elementId: number
  elementName: string
  elementLocatorType: WebUiLocatorType
  elementLocatorValue: string
}
type ElementImpactSummary = {
  elementCount: number
  referenceCount: number
  caseCount: number
  templateCount: number
  elementNames: string[]
}

interface AiElementCandidate {
  id: string
  selected: boolean
  groupName: string
  elementName: string
  locatorType: WebUiLocatorType
  locatorValue: string
  confidence: number
  reason: string
  tagName: string | null
  elementType: string | null
  businessMeaning: string | null
  candidateSource: string
  recommendedToSave: boolean
  notRecommendedReason: string | null
  maintenanceSuggestion: string | null
  stabilityNote: string | null
  validationStatus: string
  matchCount: number | null
  validationMessage: string | null
  screenshotBase64: string | null
  saveBlockedReason: string | null
}

const props = defineProps<{
  workspaceCode: string
  workspaceReady?: boolean
  environments?: WebUiEnvironmentItem[]
}>()

const directoryKeyword = ref('')
const keyword = ref('')
const status = ref<'ENABLED' | 'DISABLED' | ''>('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const elements = ref<WebUiElementItem[]>([])
const modules = ref<WebUiElementModuleItem[]>([])
const pages = ref<WebUiElementPageItem[]>([])
const groups = ref<WebUiElementGroupItem[]>([])
const selectedTree = ref<TreeSelection>({
  id: 'all',
  type: 'ALL',
  rawId: null,
  workspaceCode: null,
  label: '全部元素',
})
const expandedTreeKeys = ref<string[]>([])
const loading = ref(false)
const loadingTree = ref(false)
const saving = ref(false)
const savingModule = ref(false)
const savingPage = ref(false)
const savingGroup = ref(false)
const deletingId = ref<number | null>(null)
const validatingId = ref<number | null>(null)
const dialogVisible = ref(false)
const moduleDialogVisible = ref(false)
const pageDialogVisible = ref(false)
const groupDialogVisible = ref(false)
const referenceDrawerVisible = ref(false)
const impactDrawerVisible = ref(false)
const loadingReferences = ref(false)
const syncingReferences = ref(false)
const loadingImpactReferences = ref(false)
const syncingImpactReferences = ref(false)
const aiCollectDrawerVisible = ref(false)
const aiCollectMode = ref<AiCollectMode>('ONLINE')
const aiCollecting = ref(false)
const localRunnerChecking = ref(false)
const localRunnerOpening = ref(false)
const localRunnerCapturing = ref(false)
const collectTaskRefreshing = ref(false)
const localRunnerHealth = ref<LocalRunnerHealthView | null>(null)
const aiSaving = ref(false)
const aiProviderLoading = ref(false)
const aiProviders = ref<AiProviderConnectionItem[]>([])
const batchOperating = ref(false)
const batchMoveDialogVisible = ref(false)
const batchValidateDrawerVisible = ref(false)
const batchValidateFilter = ref<'ALL' | 'FAILED'>('ALL')
const qualityDrawerVisible = ref(false)
const importDialogVisible = ref(false)
const qualityChecking = ref(false)
const importingElements = ref(false)
const editingId = ref<number | null>(null)
const moduleDialogWorkspaceCode = ref<string | null>(null)
const pageDialogWorkspaceCode = ref<string | null>(null)
const groupDialogWorkspaceCode = ref<string | null>(null)
const elementDialogWorkspaceCode = ref<string | null>(null)
const validateDialogVisible = ref(false)
const detailDrawerVisible = ref(false)
const validateTarget = ref<WebUiElementItem | null>(null)
const detailTarget = ref<WebUiElementItem | null>(null)
const validateEnvironmentId = ref<number | null>(null)
const validateBaseUrl = ref('')
const validateResult = ref<ValidateWebUiLocatorResponse | null>(null)
const referenceTarget = ref<WebUiElementItem | null>(null)
const elementReferences = ref<WebUiElementReferenceItem[]>([])
const impactTargetElements = ref<WebUiElementItem[]>([])
const impactReferences = ref<ElementImpactReference[]>([])
const editingElementSnapshot = ref<WebUiElementItem | null>(null)
const aiCandidates = ref<AiElementCandidate[]>([])
const aiCollectFilterSummary = ref<WebUiElementCollectFilterSummary | null>(null)
const currentCollectTask = ref<WebUiElementCollectTaskResponse | null>(null)
const selectedElements = ref<WebUiElementItem[]>([])
const qualityIssues = ref<WebUiElementQualityIssue[]>([])
const localQualityIssues = ref<LocalQualityIssue[]>([])
const qualityIssueFilter = ref<QualityIssueFilter>('ALL')
const batchValidateResults = ref<WebUiElementValidateResultItem[]>([])
const importJsonText = ref('')
const batchValidateSummary = reactive({
  totalCount: 0,
  passedCount: 0,
  failedCount: 0,
})
const lastBatchValidateOptions = ref<{
  baseUrl: string
  browserType: 'CHROMIUM' | 'FIREFOX' | 'WEBKIT'
  headless: boolean
  timeoutMs: number
} | null>(null)

const form = reactive<SaveWebUiElementPayload>({
  pageId: null,
  groupId: null,
  pageName: '',
  groupName: '',
  elementName: '',
  locatorType: 'CSS',
  locatorValue: '',
  description: '',
  status: 'ENABLED',
})

const moduleForm = reactive<SaveWebUiElementModulePayload>({
  moduleName: '',
  description: '',
  sortOrder: 0,
  status: 'ENABLED',
})

const pageForm = reactive<SaveWebUiElementPagePayload>({
  moduleId: null,
  moduleName: '',
  pageName: '',
  pagePath: '',
  description: '',
  sortOrder: 0,
  status: 'ENABLED',
})

const groupForm = reactive<SaveWebUiElementGroupPayload>({
  pageId: 0,
  groupName: '',
  description: '',
  sortOrder: 0,
  status: 'ENABLED',
})

const aiCollectForm = reactive({
  providerConnectionId: null as number | null,
  environmentId: null as number | null,
  pageUrl: '',
  moduleId: null as number | null,
  pageId: null as number | null,
  pageName: '',
  groupStrategy: 'AI' as AiCollectGroupStrategy,
  groupId: null as number | null,
  groupName: '',
  scope: 'ALL' as AiCollectScope,
  htmlText: '',
  screenshotNote: '',
})
const aiCandidateFilter = ref<'ALL' | 'RECOMMENDED' | 'FAILED' | 'LOW_CONFIDENCE'>('ALL')

const batchMoveForm = reactive({
  pageId: null as number | null,
  groupId: null as number | null,
})

const selectedModuleId = computed(() => selectedTree.value.type === 'MODULE' ? selectedTree.value.rawId : null)
const selectedPageId = computed(() => selectedTree.value.type === 'PAGE' ? selectedTree.value.rawId : null)
const selectedGroupId = computed(() => selectedTree.value.type === 'GROUP' ? selectedTree.value.rawId : null)
const selectedWorkspaceCode = computed(() => selectedTree.value.workspaceCode || null)
const currentQueryWorkspaceCode = computed(() => selectedWorkspaceCode.value || props.workspaceCode || 'ALL')
const directoryTotal = computed(() => modules.value.reduce((sum, item) => sum + Number(item.elementCount || 0), 0))
const enabledEnvironments = computed(() => (props.environments || []).filter(item => item.status !== 0))
const availableAiProviders = computed(() => aiProviders.value.filter(item => item.status !== 0 && Boolean(item.modelName)))
const selectedAiProvider = computed(() =>
  availableAiProviders.value.find(item => item.id === aiCollectForm.providerConnectionId) || null,
)
const elementPageOptions = computed(() => {
  const workspaceCode = elementDialogWorkspaceCode.value
  return workspaceCode ? pages.value.filter(item => item.workspaceCode === workspaceCode) : pages.value
})
const groupPageOptions = computed(() => {
  const workspaceCode = groupDialogWorkspaceCode.value
  return workspaceCode ? pages.value.filter(item => item.workspaceCode === workspaceCode) : pages.value
})
const pageModuleOptions = computed(() => {
  const workspaceCode = pageDialogWorkspaceCode.value
  return workspaceCode ? modules.value.filter(item => item.workspaceCode === workspaceCode) : modules.value
})
const availableGroups = computed(() => {
  const workspaceCode = elementDialogWorkspaceCode.value
  return groups.value.filter(item => (
    (!workspaceCode || item.workspaceCode === workspaceCode)
    && (!form.pageId || item.pageId === form.pageId)
  ))
})
const validateImageSrc = computed(() => {
  if (!validateResult.value?.screenshotBase64) {
    return ''
  }
  return `data:image/png;base64,${validateResult.value.screenshotBase64}`
})
const aiCollectPageOptions = computed(() => {
  if (!aiCollectForm.moduleId) {
    return []
  }
  return pages.value.filter(item => item.moduleId === aiCollectForm.moduleId)
})
const aiCollectGroupOptions = computed(() => {
  if (!aiCollectForm.pageId) {
    return []
  }
  return groups.value.filter(item => item.pageId === aiCollectForm.pageId)
})
const aiSelectedCandidates = computed(() => aiCandidates.value.filter(item => item.selected))
const aiCandidateSummary = computed(() => {
  const total = aiCandidates.value.length
  const recommended = aiCandidates.value.filter(item => item.recommendedToSave).length
  const passed = aiCandidates.value.filter(item => item.validationStatus === 'PASSED').length
  const abnormal = aiCandidates.value.filter(item => item.validationStatus === 'FAILED' || item.validationStatus === 'MULTIPLE').length
  const lowConfidence = aiCandidates.value.filter(item => item.confidence < 70).length
  const aiSupplement = aiCandidates.value.filter(item => item.candidateSource === 'AI_SUPPLEMENT').length
  const blocked = aiCandidates.value.filter(item => Boolean(item.saveBlockedReason)).length
  return {
    total,
    recommended,
    passed,
    abnormal,
    lowConfidence,
    aiSupplement,
    blocked,
  }
})
const visibleAiCandidates = computed(() => {
  if (aiCandidateFilter.value === 'RECOMMENDED') {
    return aiCandidates.value.filter(item => item.recommendedToSave)
  }
  if (aiCandidateFilter.value === 'FAILED') {
    return aiCandidates.value.filter(item => item.validationStatus === 'FAILED' || item.validationStatus === 'MULTIPLE')
  }
  if (aiCandidateFilter.value === 'LOW_CONFIDENCE') {
    return aiCandidates.value.filter(item => item.confidence < 70)
  }
  return aiCandidates.value
})
const batchMoveGroupOptions = computed(() => {
  if (!batchMoveForm.pageId) {
    return []
  }
  return groups.value.filter(item => item.pageId === batchMoveForm.pageId)
})
const highQualityIssues = computed(() => qualityIssues.value.filter(item => item.level === 'HIGH'))
const mediumQualityIssues = computed(() => qualityIssues.value.filter(item => item.level === 'MEDIUM'))
const lowQualityIssues = computed(() => qualityIssues.value.filter(item => item.level === 'LOW'))
const highLocalQualityIssues = computed(() => localQualityIssues.value.filter(item => item.level === 'HIGH'))
const mediumLocalQualityIssues = computed(() => localQualityIssues.value.filter(item => item.level === 'MEDIUM'))
const lowLocalQualityIssues = computed(() => localQualityIssues.value.filter(item => item.level === 'LOW'))
const totalHighQualityIssueCount = computed(() => highQualityIssues.value.length + highLocalQualityIssues.value.length)
const totalMediumQualityIssueCount = computed(() => mediumQualityIssues.value.length + mediumLocalQualityIssues.value.length)
const totalLowQualityIssueCount = computed(() => lowQualityIssues.value.length + lowLocalQualityIssues.value.length)
const hasAnyQualityIssue = computed(() => qualityIssues.value.length > 0 || localQualityIssues.value.length > 0)
const visibleLocalQualityIssues = computed(() => {
  if (qualityIssueFilter.value === 'ALL') return localQualityIssues.value
  if (qualityIssueFilter.value === 'BACKEND') return []
  if (qualityIssueFilter.value === 'DUPLICATE') {
    return localQualityIssues.value.filter(item => item.kind === 'DUPLICATE_NAME' || item.kind === 'DUPLICATE_LOCATOR')
  }
  if (qualityIssueFilter.value === 'DISABLED_USED') {
    return localQualityIssues.value.filter(item => item.kind === 'DISABLED_USED')
  }
  if (qualityIssueFilter.value === 'EMPTY') {
    return localQualityIssues.value.filter(item => item.kind === 'EMPTY_PAGE' || item.kind === 'EMPTY_GROUP')
  }
  return localQualityIssues.value
})
const visibleBackendQualityIssues = computed(() => (qualityIssueFilter.value === 'ALL' || qualityIssueFilter.value === 'BACKEND'
  ? qualityIssues.value
  : []))
const failedBatchValidateResults = computed(() => batchValidateResults.value.filter(item => !item.matched))
const visibleBatchValidateResults = computed(() => (
  batchValidateFilter.value === 'FAILED'
    ? failedBatchValidateResults.value
    : batchValidateResults.value
))
const detailModuleName = computed(() => {
  const target = detailTarget.value
  if (!target) return '-'
  const page = pages.value.find(item => item.id === target.pageId)
  const moduleItem = page ? modules.value.find(item => item.id === page.moduleId) : null
  return moduleItem?.moduleName || '-'
})
const detailValidateTagType = computed(() => {
  const result = detailTarget.value?.lastValidateResult
  if (result === 'PASSED') return 'success'
  if (result === 'FAILED') return 'danger'
  return 'info'
})
const detailValidateLabel = computed(() => {
  const target = detailTarget.value
  if (!target?.lastValidateResult) return '未验证'
  if (target.lastValidateResult === 'PASSED') {
    return `通过${target.lastMatchCount === null || target.lastMatchCount === undefined ? '' : ` ${target.lastMatchCount}`}`
  }
  if (target.lastValidateResult === 'FAILED') return '失败'
  return target.lastValidateResult
})
const impactReferenceStats = computed(() => {
  const caseCount = impactReferences.value.filter(item => item.sourceType !== 'TEMPLATE').length
  const templateCount = impactReferences.value.filter(item => item.sourceType === 'TEMPLATE').length
  const unsyncedCount = impactReferences.value.filter(item => !isImpactReferenceLocatorSynced(item)).length
  return {
    caseCount,
    templateCount,
    unsyncedCount,
    totalCount: impactReferences.value.length,
  }
})
const unsyncedImpactElementIds = computed(() => Array.from(new Set(
  impactReferences.value
    .filter(item => !isImpactReferenceLocatorSynced(item))
    .map(item => item.elementId),
)))

const treeData = computed<ElementDirectoryNode[]>(() => {
  const keywordText = directoryKeyword.value.trim().toLowerCase()
  const workspaceMap = new Map<string, {
    code: string
    name: string
    modules: WebUiElementModuleItem[]
  }>()

  modules.value.forEach((moduleItem) => {
    const code = moduleItem.workspaceCode || 'ALL'
    const workspace = workspaceMap.get(code) || {
      code,
      name: moduleItem.workspaceName || code,
      modules: [],
    }
    workspace.modules.push(moduleItem)
    workspaceMap.set(code, workspace)
  })

  pages.value.forEach((page) => {
    const code = page.workspaceCode || 'ALL'
    if (!workspaceMap.has(code)) {
      workspaceMap.set(code, {
        code,
        name: page.workspaceName || code,
        modules: [],
      })
    }
  })

  if (props.workspaceCode && props.workspaceCode !== 'ALL' && !workspaceMap.has(props.workspaceCode)) {
    workspaceMap.set(props.workspaceCode, {
      code: props.workspaceCode,
      name: props.workspaceCode,
      modules: [],
    })
  }

  return Array.from(workspaceMap.values())
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))
    .map((workspace) => {
      const moduleNodes = workspace.modules
        .slice()
        .sort((left, right) => (left.sortOrder - right.sortOrder) || left.moduleName.localeCompare(right.moduleName, 'zh-Hans-CN'))
        .map<ElementDirectoryNode>((moduleItem) => {
          const pageNodes = pages.value
            .filter(page => page.moduleId === moduleItem.id)
            .sort((left, right) => (left.sortOrder - right.sortOrder) || left.pageName.localeCompare(right.pageName, 'zh-Hans-CN'))
            .map<ElementDirectoryNode>((page) => {
              const groupNodes = groups.value
                .filter(group => group.pageId === page.id)
                .sort((left, right) => (left.sortOrder - right.sortOrder) || left.groupName.localeCompare(right.groupName, 'zh-Hans-CN'))
                .map<ElementDirectoryNode>(group => ({
                  id: `group-${group.id}`,
                  type: 'GROUP',
                  rawId: group.id,
                  workspaceCode: group.workspaceCode,
                  label: group.groupName,
                  elementCount: group.elementCount,
                  children: [],
                }))

              return {
                id: `page-${page.id}`,
                type: 'PAGE',
                rawId: page.id,
                workspaceCode: page.workspaceCode,
                label: page.pageName,
                elementCount: page.elementCount,
                children: groupNodes,
              }
            })

          return {
            id: `module-${moduleItem.id}`,
            type: 'MODULE',
            rawId: moduleItem.id,
            workspaceCode: moduleItem.workspaceCode,
            label: moduleItem.moduleName,
            elementCount: moduleItem.elementCount,
            children: pageNodes,
          }
        })

      return {
        id: `workspace-${workspace.code}`,
        type: 'WORKSPACE',
        rawId: null,
        workspaceCode: workspace.code,
        label: workspace.name,
        elementCount: workspace.modules.reduce((sum, item) => sum + Number(item.elementCount || 0), 0),
        children: moduleNodes,
      } satisfies ElementDirectoryNode
    })
    .map(node => filterDirectoryNode(node, keywordText))
    .filter((node): node is ElementDirectoryNode => Boolean(node))
})

function filterDirectoryNode(node: ElementDirectoryNode, keywordText: string): ElementDirectoryNode | null {
  if (!keywordText) {
    return node
  }

  const children = node.children
    .map(child => filterDirectoryNode(child, keywordText))
    .filter((child): child is ElementDirectoryNode => Boolean(child))
  const matched = node.label.toLowerCase().includes(keywordText)
  if (!matched && !children.length) {
    return null
  }

  return {
    ...node,
    children: matched ? node.children : children,
  }
}

function isWorkspaceReady() {
  return props.workspaceReady !== false
}

function findDirectoryNode(nodes: ElementDirectoryNode[], id: string): ElementDirectoryNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }
    const child = findDirectoryNode(node.children, id)
    if (child) {
      return child
    }
  }
  return null
}

function getWorkspaceCodeForCreate() {
  if (selectedWorkspaceCode.value && selectedWorkspaceCode.value !== 'ALL') {
    return selectedWorkspaceCode.value
  }
  if (props.workspaceCode && props.workspaceCode !== 'ALL') {
    return props.workspaceCode
  }
  return null
}

function getSelectedModule() {
  if (selectedTree.value.type === 'MODULE') {
    return modules.value.find(item => item.id === selectedTree.value.rawId) || null
  }
  if (selectedTree.value.type === 'PAGE') {
    const page = pages.value.find(item => item.id === selectedTree.value.rawId)
    return page ? modules.value.find(item => item.id === page.moduleId) || null : null
  }
  if (selectedTree.value.type === 'GROUP') {
    const group = groups.value.find(item => item.id === selectedTree.value.rawId)
    const page = group ? pages.value.find(item => item.id === group.pageId) : null
    return page ? modules.value.find(item => item.id === page.moduleId) || null : null
  }
  return null
}

function getSelectedPageForGroup() {
  if (selectedTree.value.type === 'PAGE') {
    return pages.value.find(item => item.id === selectedTree.value.rawId) || null
  }
  if (selectedTree.value.type === 'GROUP') {
    const group = groups.value.find(item => item.id === selectedTree.value.rawId)
    return group ? pages.value.find(item => item.id === group.pageId) || null : null
  }
  return null
}

function getSelectedGroup() {
  if (selectedTree.value.type !== 'GROUP') {
    return null
  }
  return groups.value.find(item => item.id === selectedTree.value.rawId) || null
}

async function loadTreeAssets() {
  if (!isWorkspaceReady()) {
    return
  }

  loadingTree.value = true
  try {
    const [moduleResult, pageResult, groupResult] = await Promise.all([
      webUiAutomationApi.getElementModules(props.workspaceCode),
      webUiAutomationApi.getElementPages(props.workspaceCode),
      webUiAutomationApi.getElementGroups(props.workspaceCode),
    ])
    modules.value = moduleResult.items
    pages.value = pageResult.items
    groups.value = groupResult.items
    expandedTreeKeys.value = Array.from(new Set(moduleResult.items.map(item => `workspace-${item.workspaceCode}`)))

    if (selectedTree.value.type !== 'ALL') {
      const current = findDirectoryNode(treeData.value, selectedTree.value.id)
      selectedTree.value = current
        ? {
            id: current.id,
            type: current.type,
            rawId: current.rawId,
            workspaceCode: current.workspaceCode,
            label: current.label,
          }
        : {
            id: 'all',
            type: 'ALL',
            rawId: null,
            workspaceCode: null,
            label: '全部元素',
          }
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingTree.value = false
  }
}

async function loadElements() {
  if (!isWorkspaceReady()) {
    return
  }

  loading.value = true
  try {
    const page = await webUiAutomationApi.getElements(currentQueryWorkspaceCode.value, {
      keyword: keyword.value,
      moduleId: selectedModuleId.value,
      pageId: selectedPageId.value,
      groupId: selectedGroupId.value,
      status: status.value,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    })
    elements.value = page.items
    total.value = page.total
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function reloadAll() {
  await loadTreeAssets()
  await loadElements()
}

function handleTreeNodeClick(node: ElementDirectoryNode) {
  selectedTree.value = {
    id: node.id,
    type: node.type,
    rawId: node.rawId,
    workspaceCode: node.workspaceCode,
    label: node.label,
  }
  pageNo.value = 1
  void loadElements()
}

function searchElements() {
  pageNo.value = 1
  void loadElements()
}

function resetFilters() {
  keyword.value = ''
  status.value = ''
  selectedTree.value = {
    id: 'all',
    type: 'ALL',
    rawId: null,
    workspaceCode: null,
    label: '全部元素',
  }
  searchElements()
}

function resetForm() {
  editingId.value = null
  editingElementSnapshot.value = null
  const page = selectedTree.value.type === 'PAGE'
    ? pages.value.find(item => item.id === selectedTree.value.rawId)
    : selectedTree.value.type === 'GROUP'
      ? pages.value.find(item => item.id === groups.value.find(group => group.id === selectedTree.value.rawId)?.pageId)
      : null
  const group = selectedTree.value.type === 'GROUP' ? groups.value.find(item => item.id === selectedTree.value.rawId) : null

  elementDialogWorkspaceCode.value = page?.workspaceCode || group?.workspaceCode || getWorkspaceCodeForCreate()
  form.pageId = page?.id ?? null
  form.groupId = group?.id ?? null
  form.pageName = page?.pageName || ''
  form.groupName = group?.groupName || ''
  form.elementName = ''
  form.locatorType = 'CSS'
  form.locatorValue = ''
  form.description = ''
  form.status = 'ENABLED'
}

function openCreateDialog() {
  resetForm()
  dialogVisible.value = true
}

async function loadAiProviders() {
  aiProviderLoading.value = true
  try {
    const items = await aiProviderApi.getProviderConnections(props.workspaceCode || 'ALL')
    aiProviders.value = Array.isArray(items) ? items : []
  } catch (error) {
    aiProviders.value = []
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    aiProviderLoading.value = false
  }
}

function openEditDialog(item: WebUiElementItem) {
  editingId.value = item.id
  editingElementSnapshot.value = item
  elementDialogWorkspaceCode.value = item.workspaceCode
  form.pageId = item.pageId
  form.groupId = item.groupId
  form.pageName = item.pageName
  form.groupName = item.groupName || ''
  form.elementName = item.elementName
  form.locatorType = item.locatorType
  form.locatorValue = item.locatorValue
  form.description = item.description || ''
  form.status = item.status
  dialogVisible.value = true
}

function openDetailDrawer(item: WebUiElementItem) {
  detailTarget.value = item
  detailDrawerVisible.value = true
}

function openAiCollectDrawer() {
  const moduleItem = getSelectedModule()
  const page = selectedTree.value.type === 'PAGE'
    ? pages.value.find(item => item.id === selectedTree.value.rawId) || null
    : selectedTree.value.type === 'GROUP'
      ? pages.value.find(item => item.id === groups.value.find(group => group.id === selectedTree.value.rawId)?.pageId) || null
    : null
  aiCollectMode.value = 'ONLINE'
  aiCollectForm.providerConnectionId = null
  aiCollectForm.environmentId = enabledEnvironments.value[0]?.id ?? null
  aiCollectForm.pageUrl = ''
  aiCollectForm.moduleId = moduleItem?.id ?? modules.value[0]?.id ?? null
  aiCollectForm.pageId = page?.id ?? null
  aiCollectForm.pageName = page?.pageName || ''
  aiCollectForm.groupStrategy = 'AI'
  aiCollectForm.groupId = null
  aiCollectForm.groupName = ''
  aiCollectForm.scope = 'ALL'
  aiCollectForm.htmlText = ''
  aiCollectForm.screenshotNote = ''
  aiCandidates.value = []
  aiCollectFilterSummary.value = null
  currentCollectTask.value = null
  aiCollectDrawerVisible.value = true
  void loadAiProviders()
}

function handleAiPageChange(pageId: number | null) {
  const page = pages.value.find(item => item.id === pageId)
  aiCollectForm.pageName = page?.pageName || ''
  aiCollectForm.groupId = null
  aiCollectForm.groupName = ''
  aiCandidates.value = []
}

function handleAiModuleChange() {
  aiCollectForm.pageId = null
  aiCollectForm.pageName = ''
  aiCollectForm.groupId = null
  aiCollectForm.groupName = ''
  aiCandidates.value = []
}

function handleAiGroupChange(groupId: number | null) {
  const group = groups.value.find(item => item.id === groupId)
  aiCollectForm.groupName = group?.groupName || ''
}

function openImportDialog() {
  const selectedModule = getSelectedModule()
  const selectedPage = getSelectedPageForGroup()
  const selectedGroup = getSelectedGroup()
  importJsonText.value = JSON.stringify([
    {
      moduleName: selectedModule?.moduleName || '订单模块',
      pageName: selectedPage?.pageName || '订单列表页',
      pagePath: selectedPage?.pagePath || '/orders',
      groupName: selectedGroup?.groupName || '查询区',
      elementName: '订单号输入框',
      locatorType: 'CSS',
      locatorValue: 'input[name="orderNo"]',
      description: '批量导入示例',
      status: 'ENABLED',
    },
  ], null, 2)
  importDialogVisible.value = true
}

function normalizeImportRows() {
  let raw: unknown
  try {
    raw = JSON.parse(importJsonText.value)
  } catch {
    ElMessage.warning('请输入合法的 JSON 数组')
    return null
  }

  if (!Array.isArray(raw)) {
    ElMessage.warning('导入内容必须是 JSON 数组')
    return null
  }

  const selectedModule = getSelectedModule()
  const selectedPage = getSelectedPageForGroup()
  const selectedGroup = getSelectedGroup()
  const rows = raw.map((item, index) => {
    const row = item as ElementImportRow
    const locatorType = String(row.locatorType || 'CSS').trim().toUpperCase()
    const normalized: ElementImportRow = {
      moduleName: String(row.moduleName || selectedModule?.moduleName || '').trim(),
      pageName: String(row.pageName || selectedPage?.pageName || '').trim(),
      pagePath: String(row.pagePath || selectedPage?.pagePath || '').trim(),
      groupName: String(row.groupName || selectedGroup?.groupName || '').trim(),
      elementName: String(row.elementName || '').trim(),
      locatorType,
      locatorValue: String(row.locatorValue || '').trim(),
      description: String(row.description || '').trim(),
      status: row.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
    }

    if (!normalized.moduleName) {
      throw new Error(`第 ${index + 1} 行缺少模块名称`)
    }
    if (!normalized.pageName) {
      throw new Error(`第 ${index + 1} 行缺少页面对象名称`)
    }
    if (!normalized.elementName) {
      throw new Error(`第 ${index + 1} 行缺少元素名称`)
    }
    if (!WEB_UI_LOCATOR_OPTIONS.some(option => option.value === locatorType)) {
      throw new Error(`第 ${index + 1} 行定位方式不支持：${locatorType}`)
    }
    if (!normalized.locatorValue) {
      throw new Error(`第 ${index + 1} 行缺少定位值`)
    }

    return normalized
  })

  return rows
}

async function resolveImportModule(workspaceCode: string, moduleName: string) {
  const existing = modules.value.find(item => item.workspaceCode === workspaceCode && item.moduleName === moduleName)
  if (existing) {
    return existing
  }

  const created = await webUiAutomationApi.createElementModule(workspaceCode, {
    workspaceCode,
    moduleName,
    description: '批量导入创建',
    sortOrder: modules.value.filter(item => item.workspaceCode === workspaceCode).length + 1,
    status: 'ENABLED',
  })
  modules.value.push(created)
  return created
}

async function resolveImportPage(workspaceCode: string, moduleItem: WebUiElementModuleItem, row: ElementImportRow) {
  const existing = pages.value.find(item => (
    item.workspaceCode === workspaceCode
    && item.moduleId === moduleItem.id
    && item.pageName === row.pageName
  ))
  if (existing) {
    return existing
  }

  const created = await webUiAutomationApi.createElementPage(workspaceCode, {
    workspaceCode,
    moduleId: moduleItem.id,
    moduleName: moduleItem.moduleName,
    pageName: row.pageName || '',
    pagePath: row.pagePath || null,
    description: '批量导入创建',
    sortOrder: pages.value.filter(item => item.moduleId === moduleItem.id).length + 1,
    status: 'ENABLED',
  })
  pages.value.push(created)
  return created
}

async function resolveImportGroup(workspaceCode: string, page: WebUiElementPageItem, row: ElementImportRow) {
  if (!row.groupName) {
    return null
  }

  const existing = groups.value.find(item => (
    item.workspaceCode === workspaceCode
    && item.pageId === page.id
    && item.groupName === row.groupName
  ))
  if (existing) {
    return existing
  }

  const created = await webUiAutomationApi.createElementGroup(workspaceCode, {
    workspaceCode,
    pageId: page.id,
    groupName: row.groupName,
    description: '批量导入创建',
    sortOrder: groups.value.filter(item => item.pageId === page.id).length + 1,
    status: 'ENABLED',
  })
  groups.value.push(created)
  return created
}

async function importElementsFromJson() {
  const workspaceCode = getWorkspaceCodeForCreate()
  if (!workspaceCode) {
    ElMessage.warning('请先切换到具体工作空间或选择具体空间节点')
    return
  }

  let rows: ElementImportRow[] | null = null
  try {
    rows = normalizeImportRows()
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '导入内容校验失败')
    return
  }
  if (rows === null) {
    return
  }
  if (!rows.length) {
    ElMessage.warning('请至少提供 1 条元素数据')
    return
  }

  importingElements.value = true
  try {
    for (const row of rows) {
      const moduleItem = await resolveImportModule(workspaceCode, row.moduleName || '')
      const page = await resolveImportPage(workspaceCode, moduleItem, row)
      const group = await resolveImportGroup(workspaceCode, page, row)
      await webUiAutomationApi.createElement(workspaceCode, {
        workspaceCode,
        pageId: page.id,
        groupId: group?.id ?? null,
        pageName: page.pageName,
        groupName: group?.groupName || row.groupName || null,
        elementName: row.elementName || '',
        locatorType: row.locatorType as WebUiLocatorType,
        locatorValue: row.locatorValue || '',
        description: row.description || null,
        status: row.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      })
    }
    ElMessage.success(`已导入 ${rows.length} 个元素`)
    importDialogVisible.value = false
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    importingElements.value = false
  }
}

async function exportCurrentElements() {
  try {
    const page = await webUiAutomationApi.getElements(currentQueryWorkspaceCode.value, {
      keyword: keyword.value,
      moduleId: selectedModuleId.value,
      pageId: selectedPageId.value,
      groupId: selectedGroupId.value,
      status: status.value,
      pageNo: 1,
      pageSize: Math.max(total.value || elements.value.length || 1, 500),
    })
    const exportRows = page.items.map(item => ({
      moduleName: pages.value.find(pageItem => pageItem.id === item.pageId)?.moduleName || '',
      pageName: item.pageName,
      pagePath: pages.value.find(pageItem => pageItem.id === item.pageId)?.pagePath || '',
      groupName: item.groupName || '',
      elementName: item.elementName,
      locatorType: item.locatorType,
      locatorValue: item.locatorValue,
      description: item.description || '',
      status: item.status,
    }))
    const blob = new Blob([JSON.stringify(exportRows, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `web-ui-elements-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${exportRows.length} 条元素 JSON`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function getAiCustomGroupName() {
  if (aiCollectForm.groupStrategy !== 'CUSTOM') {
    return ''
  }
  const group = groups.value.find(item => item.id === aiCollectForm.groupId)
  return (aiCollectForm.groupName || group?.groupName || '').trim()
}

type CollectCandidateShape = ReturnType<typeof mapRunnerCandidateToCollectCandidate>

function mapCollectCandidatesToAiCandidates(
  candidates: CollectCandidateShape[],
  customGroupName: string,
) {
  return candidates.map((item, index) => ({
    id: `${item.locatorType}-${index}-${item.locatorValue}`,
    selected: item.recommendedToSave
      && (item.validationStatus === 'PASSED' || item.validationStatus === 'UNVERIFIED')
      && !item.saveBlockedReason,
    groupName: aiCollectForm.groupStrategy === 'CUSTOM' ? customGroupName : item.groupName,
    elementName: item.elementName,
    locatorType: item.locatorType,
    locatorValue: item.locatorValue,
    confidence: item.confidence,
    reason: item.reason,
    tagName: item.tagName,
    elementType: item.elementType,
    businessMeaning: item.businessMeaning,
    candidateSource: item.candidateSource || 'RULE',
    recommendedToSave: item.recommendedToSave,
    notRecommendedReason: item.notRecommendedReason,
    maintenanceSuggestion: item.maintenanceSuggestion,
    stabilityNote: item.stabilityNote,
    validationStatus: item.validationStatus,
    matchCount: item.matchCount,
    validationMessage: item.validationMessage,
    screenshotBase64: item.screenshotBase64,
    saveBlockedReason: item.saveBlockedReason || null,
    text: item.text,
    placeholder: item.placeholder,
  }))
}

function setAiCandidateFilter(nextFilter: typeof aiCandidateFilter.value) {
  aiCandidateFilter.value = nextFilter
}

function formatAiValidationStatus(status?: string | null) {
  if (status === 'AI_UNVERIFIED') return 'AI 建议未验证'
  if (status === 'PASSED') return '已验证'
  if (status === 'FAILED') return '未找到'
  if (status === 'MULTIPLE') return '多匹配'
  if (status === 'SKIPPED') return '未验证'
  return status || '未验证'
}

function isAiCandidateSaveable(candidate: AiElementCandidate) {
  return candidate.recommendedToSave
    && (candidate.validationStatus === 'PASSED' || candidate.validationStatus === 'UNVERIFIED')
    && !candidate.saveBlockedReason
}

function previewAiCandidateScreenshot(candidate: AiElementCandidate) {
  if (!candidate.screenshotBase64) {
    ElMessage.warning('该候选元素没有验证截图')
    return
  }
  window.open(`data:image/png;base64,${candidate.screenshotBase64}`, '_blank', 'noopener,noreferrer')
}

function applyCollectTaskDetail(taskDetail: WebUiElementCollectTaskResponse, customGroupName: string) {
  const candidates = mapCollectCandidatesToAiCandidates(taskDetail.candidates, customGroupName)
  aiCandidates.value = candidates
  aiCollectFilterSummary.value = taskDetail.filterSummary
  currentCollectTask.value = taskDetail
  return candidates
}

function selectRecommendedPassedAiCandidates() {
  let selectedCount = 0
  for (const candidate of aiCandidates.value) {
    const shouldSelect = isAiCandidateSaveable(candidate)
    candidate.selected = shouldSelect
    if (shouldSelect) {
      selectedCount += 1
    }
  }
  ElMessage.success(`已选择 ${selectedCount} 个推荐可保存的候选元素`)
}

function unselectRiskyAiCandidates() {
  let unselectedCount = 0
  for (const candidate of aiCandidates.value) {
    const risky = candidate.confidence < 70
      || candidate.validationStatus === 'FAILED'
      || candidate.validationStatus === 'MULTIPLE'
      || Boolean(candidate.saveBlockedReason)
    if (risky && candidate.selected) {
      candidate.selected = false
      unselectedCount += 1
    }
  }
  ElMessage.success(`已取消 ${unselectedCount} 个低稳定性或验证异常候选`)
}

async function batchUpdateAiCandidateGroup() {
  if (!aiSelectedCandidates.value.length) {
    ElMessage.warning('请先选择候选元素')
    return
  }
  try {
    const { value } = await ElMessageBox.prompt('请输入要批量设置的分组名称', '批量设置分组', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '分组名称不能为空',
    })
    const groupName = String(value || '').trim()
    if (!groupName) {
      return
    }
    for (const candidate of aiSelectedCandidates.value) {
      candidate.groupName = groupName
    }
    ElMessage.success(`已将 ${aiSelectedCandidates.value.length} 个候选元素设置为「${groupName}」`)
  } catch {
    // user cancelled
  }
}

function buildAiCandidateDescription(candidate: AiElementCandidate) {
  const parts = [
    '来源：智能采集',
    `稳定性：${candidate.confidence}%`,
    candidate.reason ? `规则依据：${candidate.reason}` : '',
    candidate.businessMeaning ? `业务含义：${candidate.businessMeaning}` : '',
    candidate.maintenanceSuggestion ? `维护建议：${candidate.maintenanceSuggestion}` : '',
    candidate.stabilityNote ? `稳定性说明：${candidate.stabilityNote}` : '',
    candidate.validationStatus ? `验证结果：${formatAiValidationStatus(candidate.validationStatus)}${candidate.matchCount === null ? '' : `，匹配 ${candidate.matchCount} 个`}` : '',
    candidate.validationMessage ? `验证信息：${candidate.validationMessage}` : '',
  ]
  return parts.filter(Boolean).join('；')
}

function isDuplicateAiCandidate(existingElements: WebUiElementItem[], pageId: number, groupName: string, candidate: AiElementCandidate) {
  const elementName = candidate.elementName.trim()
  const locatorValue = candidate.locatorValue.trim()
  return existingElements.some(item => (
    item.pageId === pageId
    && (
      ((item.groupName || '') === groupName && item.elementName === elementName)
      || (item.locatorType === candidate.locatorType && item.locatorValue === locatorValue)
    )
  ))
}

async function loadAiDuplicateBaseline(workspaceCode: string, pageId: number) {
  const localMatches = elements.value.filter(item => item.pageId === pageId)
  try {
    const response = await webUiAutomationApi.getElements(workspaceCode, {
      pageId,
      pageNo: 1,
      pageSize: 1000,
    })
    return response.items
  } catch {
    return localMatches
  }
}

async function focusElementScope(page: WebUiElementPageItem, group: WebUiElementGroupItem | null) {
  await loadTreeAssets()
  const moduleItem = modules.value.find(item => item.id === page.moduleId) || null
  const targetId = group ? `group-${group.id}` : `page-${page.id}`
  selectedTree.value = {
    id: targetId,
    type: group ? 'GROUP' : 'PAGE',
    rawId: group?.id ?? page.id,
    workspaceCode: page.workspaceCode,
    label: group?.groupName || page.pageName,
  }
  expandedTreeKeys.value = Array.from(new Set([
    ...expandedTreeKeys.value,
    `workspace-${page.workspaceCode}`,
    moduleItem ? `module-${moduleItem.id}` : '',
    `page-${page.id}`,
  ].filter(Boolean)))
  pageNo.value = 1
  await loadElements()
}

function estimateAiSaveSummary(existingElements: WebUiElementItem[], pageId: number) {
  let duplicateCount = 0
  let abnormalCount = 0
  const seenNameKeys = new Set<string>()
  const seenLocatorKeys = new Set<string>()
  for (const item of existingElements.filter(item => item.pageId === pageId)) {
    seenNameKeys.add(`${item.groupName || ''}::${item.elementName}`)
    seenLocatorKeys.add(`${item.locatorType}::${item.locatorValue}`)
  }
  for (const candidate of aiSelectedCandidates.value) {
    const groupName = candidate.groupName.trim()
    const elementName = candidate.elementName.trim()
    const locatorValue = candidate.locatorValue.trim()
    const nameKey = `${groupName}::${elementName}`
    const locatorKey = `${candidate.locatorType}::${locatorValue}`
    if (candidate.validationStatus === 'FAILED' || candidate.validationStatus === 'MULTIPLE' || candidate.confidence < 70) {
      abnormalCount += 1
    }
    if (seenNameKeys.has(nameKey) || seenLocatorKeys.has(locatorKey)) {
      duplicateCount += 1
    } else {
      seenNameKeys.add(nameKey)
      seenLocatorKeys.add(locatorKey)
    }
  }
  return {
    selectedCount: aiSelectedCandidates.value.length,
    createCount: Math.max(aiSelectedCandidates.value.length - duplicateCount, 0),
    duplicateCount,
    abnormalCount,
  }
}

async function confirmAiSaveSummary(summary: ReturnType<typeof estimateAiSaveSummary>) {
  await ElMessageBox.confirm(
    `本次选择 ${summary.selectedCount} 个候选元素，预计新增 ${summary.createCount} 个，跳过重复 ${summary.duplicateCount} 个，包含异常候选 ${summary.abnormalCount} 个。是否继续保存？`,
    '确认批量保存',
    {
      confirmButtonText: '继续保存',
      cancelButtonText: '取消',
      type: summary.abnormalCount || summary.duplicateCount ? 'warning' : 'info',
    },
  )
}

async function generateAiCandidates() {
  if (!selectedAiProvider.value?.modelName) {
    ElMessage.warning('请选择 AI 采集模型')
    return
  }
  if (!aiCollectForm.moduleId) {
    ElMessage.warning('请选择所属模块')
    return
  }
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择有效的所属模块')
    return
  }
  if (!aiCollectForm.pageName.trim() && !aiCollectForm.pageId) {
    ElMessage.warning('请选择或填写页面对象名称')
    return
  }
  if (aiCollectMode.value === 'ONLINE') {
    ElMessage.warning('在线采集请使用本地 Runner 的“采集当前页”；离线导入才使用生成候选元素。')
    return
  }
  if (aiCollectMode.value === 'OFFLINE' && !aiCollectForm.htmlText.trim()) {
    ElMessage.warning('请粘贴 HTML / DOM 内容')
    return
  }
  const customGroupName = getAiCustomGroupName()
  if (aiCollectForm.groupStrategy === 'CUSTOM' && !customGroupName) {
    ElMessage.warning('请选择或填写自选分组')
    return
  }

  aiCollecting.value = true
  try {
    const environment = enabledEnvironments.value.find(item => item.id === aiCollectForm.environmentId)
    const result = await webUiAutomationApi.collectElements(moduleItem.workspaceCode, {
      providerConnectionId: selectedAiProvider.value.id,
      modelName: selectedAiProvider.value.modelName,
      pageUrl: null,
      environmentId: null,
      moduleId: aiCollectForm.moduleId,
      pageId: aiCollectForm.pageId,
      pageName: aiCollectForm.pageName.trim(),
      groupStrategy: aiCollectForm.groupStrategy,
      groupId: aiCollectForm.groupId,
      groupName: customGroupName || aiCollectForm.groupName.trim() || null,
      scope: aiCollectForm.scope,
      htmlText: aiCollectForm.htmlText.trim(),
      screenshotNote: aiCollectForm.screenshotNote.trim() || null,
      browserType: environment?.browserType || 'CHROMIUM',
      headless: environment?.headless ?? true,
      timeoutMs: environment?.defaultTimeoutMs || 10000,
    })
    const candidates = mapCollectCandidatesToAiCandidates(result.candidates, customGroupName)
    aiCandidates.value = candidates
    aiCollectFilterSummary.value = null
    currentCollectTask.value = null
    aiCandidateFilter.value = 'ALL'
    if (!candidates.length) {
      ElMessage.warning(result.message || '未识别到候选元素，请缩小范围或补充 HTML 结构后重试')
      return
    }
    if (result.aiEnhanced) {
      ElMessage.success(result.message || `已智能生成 ${candidates.length} 个候选元素，请确认后批量保存`)
    } else if (result.fallbackReason) {
      ElMessage.warning(`已生成 ${candidates.length} 个规则候选元素，AI 增强未启用：${result.fallbackReason}`)
    } else {
      ElMessage.success(`已生成 ${candidates.length} 个候选元素，请确认后批量保存`)
    }
  } catch (error) {
    aiCandidates.value = []
    aiCollectFilterSummary.value = null
    currentCollectTask.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    aiCollecting.value = false
  }
}

async function checkLocalRunner() {
  localRunnerChecking.value = true
  try {
    localRunnerHealth.value = await checkLocalRunnerHealth()
    if (!localRunnerHealth.value.playwrightAvailable || !localRunnerHealth.value.chromiumInstalled) {
      ElMessage.warning('本地执行器已连接，但 Playwright 或 Chromium 不可用')
      return
    }
    ElMessage.success('本地执行器已连接')
  } catch (error) {
    localRunnerHealth.value = null
    ElMessage.error(`本地执行器未连接：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerChecking.value = false
  }
}

async function openLocalRunnerCollectPage() {
  if (!aiCollectForm.pageUrl.trim()) {
    ElMessage.warning('请填写页面 URL')
    return
  }

  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择所属模块')
    return
  }

  localRunnerOpening.value = true
  try {
    const result = await openLocalRunnerPage({
      url: aiCollectForm.pageUrl.trim(),
      workspaceId: moduleItem.workspaceCode,
      environmentId: aiCollectForm.environmentId,
    })
    localRunnerHealth.value = await checkLocalRunnerHealth()
    if (result.page?.isProbablyLoginPage) {
      ElMessage.warning('页面可能需要登录，请在本地浏览器完成登录后点击继续采集')
      return
    }
    ElMessage.success('已在本地浏览器打开页面，可继续采集')
  } catch (error) {
    ElMessage.error(`打开本地页面失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerOpening.value = false
  }
}

async function captureLocalRunnerCandidates() {
  if (!selectedAiProvider.value?.modelName) {
    ElMessage.warning('请选择 AI 采集模型')
    return
  }
  if (!aiCollectForm.moduleId) {
    ElMessage.warning('请选择所属模块')
    return
  }
  if (!aiCollectForm.pageName.trim() && !aiCollectForm.pageId) {
    ElMessage.warning('请选择或填写页面对象名称')
    return
  }

  const customGroupName = getAiCustomGroupName()
  if (aiCollectForm.groupStrategy === 'CUSTOM' && !customGroupName) {
    ElMessage.warning('请选择或填写自选分组')
    return
  }

  localRunnerCapturing.value = true
  try {
    const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
    if (!moduleItem) {
      ElMessage.warning('请选择有效的所属模块')
      return
    }
    const result = await captureLocalRunnerPage(300)
    await saveLocalRunnerAuth({
      workspaceId: moduleItem.workspaceCode,
      environmentId: aiCollectForm.environmentId,
    })
    const groupName = customGroupName || aiCollectForm.groupName.trim() || '页面元素'
    const collectCandidates = result.candidates.map(candidate => mapRunnerCandidateToCollectCandidate({
      candidate,
      groupName,
      screenshotBase64: result.screenshotBase64 || null,
    }))
    const task = await webUiAutomationApi.createLocalRunnerCollectTask(moduleItem.workspaceCode, {
      runnerId: 'local-runner',
      sessionId: result.session?.sessionId || null,
      actualUrl: result.page?.url || localRunnerHealth.value?.currentUrl || null,
      pageTitle: result.page?.title || null,
      moduleId: aiCollectForm.moduleId,
      pageId: aiCollectForm.pageId,
      pageName: aiCollectForm.pageName.trim() || null,
      scope: aiCollectForm.scope,
      providerConnectionId: selectedAiProvider.value.id,
      modelName: selectedAiProvider.value.modelName,
      rawCount: result.rawCount,
      screenshotBase64: result.screenshotBase64 || null,
      candidates: collectCandidates,
    })
    const taskDetail = await webUiAutomationApi.getLocalRunnerCollectTask(moduleItem.workspaceCode, task.taskId)
    const candidates = applyCollectTaskDetail(taskDetail, customGroupName)
    aiCandidateFilter.value = 'ALL'
    localRunnerHealth.value = await checkLocalRunnerHealth()

    if (!candidates.length) {
      ElMessage.warning('本地执行器未采集到候选元素，请确认已进入目标业务页面')
      return
    }

    ElMessage.success(task.message || `本地 Runner 已创建采集任务 #${task.taskId}，生成 ${candidates.length} 个静态候选`)
  } catch (error) {
    aiCandidates.value = []
    aiCollectFilterSummary.value = null
    currentCollectTask.value = null
    ElMessage.error(`本地采集失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerCapturing.value = false
  }
}

async function refreshCurrentCollectTask() {
  if (!currentCollectTask.value) {
    ElMessage.warning('暂无可刷新的采集任务')
    return
  }
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择有效的所属模块')
    return
  }

  collectTaskRefreshing.value = true
  try {
    const customGroupName = getAiCustomGroupName()
    const taskDetail = await webUiAutomationApi.getLocalRunnerCollectTask(moduleItem.workspaceCode, currentCollectTask.value.taskId)
    applyCollectTaskDetail(taskDetail, customGroupName)
    ElMessage.success('采集任务详情已刷新')
  } catch (error) {
    ElMessage.error(`刷新采集任务失败：${getRequestErrorMessage(error)}`)
  } finally {
    collectTaskRefreshing.value = false
  }
}

async function saveAiCandidates() {
  if (!aiSelectedCandidates.value.length) {
    ElMessage.warning('请至少选择一个候选元素')
    return
  }
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择所属模块')
    return
  }
  const invalidCandidate = aiSelectedCandidates.value.find(item => (
    !item.groupName.trim()
    || !item.elementName.trim()
    || !item.locatorValue.trim()
  ))
  if (invalidCandidate) {
    ElMessage.warning('请补全已选候选元素的分组、名称和定位器')
    return
  }

  const blockedCandidate = aiSelectedCandidates.value.find(item => !isAiCandidateSaveable(item))
  if (blockedCandidate) {
    ElMessage.warning(blockedCandidate.saveBlockedReason || '仅推荐且未被阻止的候选元素可以入库')
    return
  }

  aiSaving.value = true
  try {
    let page = aiCollectForm.pageId ? pages.value.find(item => item.id === aiCollectForm.pageId) || null : null
    if (!page) {
      const createdPage = await webUiAutomationApi.createElementPage(moduleItem.workspaceCode, {
        workspaceCode: moduleItem.workspaceCode,
        moduleId: moduleItem.id,
        moduleName: moduleItem.moduleName,
        pageName: aiCollectForm.pageName.trim(),
        pagePath: aiCollectForm.pageUrl.trim() || null,
        description: '智能采集创建',
        sortOrder: pages.value.filter(item => item.moduleId === moduleItem.id).length + 1,
        status: 'ENABLED',
      })
      page = createdPage
    }

    const groupMap = new Map<string, WebUiElementGroupItem>()
    for (const group of groups.value.filter(item => item.pageId === page.id)) {
      groupMap.set(group.groupName, group)
    }

    const existingElements = await loadAiDuplicateBaseline(page.workspaceCode, page.id)
    const saveSummary = estimateAiSaveSummary(existingElements, page.id)
    await confirmAiSaveSummary(saveSummary)
    let savedCount = 0
    let skippedCount = 0
    let firstSavedGroup: WebUiElementGroupItem | null = null
    for (const candidate of aiSelectedCandidates.value) {
      const groupName = candidate.groupName.trim()
      let group = groupMap.get(groupName)
      if (!group) {
        group = await webUiAutomationApi.createElementGroup(page.workspaceCode, {
          workspaceCode: page.workspaceCode,
          pageId: page.id,
          groupName,
          description: '智能采集创建',
          sortOrder: groupMap.size + 1,
          status: 'ENABLED',
        })
        groupMap.set(groupName, group)
        groups.value.push(group)
      }

      if (isDuplicateAiCandidate(existingElements, page.id, group.groupName, candidate)) {
        skippedCount += 1
        continue
      }

      const createdElement = await webUiAutomationApi.createElement(page.workspaceCode, {
        workspaceCode: page.workspaceCode,
        pageId: page.id,
        groupId: group.id,
        pageName: page.pageName,
        groupName: group.groupName,
        elementName: candidate.elementName.trim(),
        locatorType: candidate.locatorType,
        locatorValue: candidate.locatorValue.trim(),
        description: buildAiCandidateDescription(candidate),
        status: 'ENABLED',
      })
      existingElements.push(createdElement)
      firstSavedGroup = firstSavedGroup || group
      savedCount += 1
    }

    if (!savedCount && skippedCount) {
      ElMessage.warning(`已跳过 ${skippedCount} 个重复候选元素，未新增元素`)
    } else if (skippedCount) {
      ElMessage.warning(`已保存 ${savedCount} 个元素，跳过 ${skippedCount} 个重复候选元素`)
    } else {
      ElMessage.success(`已保存 ${savedCount} 个元素`)
    }
    aiCollectDrawerVisible.value = false
    await focusElementScope(page, firstSavedGroup)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    aiSaving.value = false
  }
}

function handleElementPageChange(pageId: number | null) {
  const page = pages.value.find(item => item.id === pageId)
  form.pageName = page?.pageName || ''
  form.groupId = null
  form.groupName = ''
  if (page?.workspaceCode) {
    elementDialogWorkspaceCode.value = page.workspaceCode
  }
}

function handleElementGroupChange(groupId: number | null) {
  const group = groups.value.find(item => item.id === groupId)
  form.groupName = group?.groupName || ''
}

function buildPayload(): SaveWebUiElementPayload | null {
  const workspaceCode = elementDialogWorkspaceCode.value || getWorkspaceCodeForCreate()
  if (!workspaceCode) {
    ElMessage.warning('请先选择具体工作空间或页面对象')
    return null
  }
  if (!form.pageId && !form.pageName.trim()) {
    ElMessage.warning('请先选择或填写页面对象')
    return null
  }
  if (!form.elementName.trim()) {
    ElMessage.warning('请填写元素名称')
    return null
  }
  if (!form.locatorType) {
    ElMessage.warning('请选择定位方式')
    return null
  }
  if (!form.locatorValue.trim()) {
    ElMessage.warning('请填写定位值')
    return null
  }

  return {
    workspaceCode,
    pageId: form.pageId ?? null,
    groupId: form.groupId ?? null,
    pageName: form.pageName.trim(),
    groupName: form.groupName?.trim() || null,
    elementName: form.elementName.trim(),
    locatorType: form.locatorType as WebUiLocatorType,
    locatorValue: form.locatorValue.trim(),
    description: form.description?.trim() || null,
    status: form.status || 'ENABLED',
  }
}

async function saveElement() {
  const payload = buildPayload()
  if (!payload) {
    return
  }

  if (editingId.value && editingElementSnapshot.value?.usageCount) {
    const locatorChanged = (
      editingElementSnapshot.value.locatorType !== payload.locatorType
      || editingElementSnapshot.value.locatorValue !== payload.locatorValue
    )
    if (locatorChanged) {
      const confirmed = await confirmElementImpact([editingElementSnapshot.value], '修改元素定位器')
      if (!confirmed) {
        return
      }
    }
  }

  saving.value = true
  try {
    const workspaceCode = payload.workspaceCode || props.workspaceCode
    if (editingId.value) {
      await webUiAutomationApi.updateElement(workspaceCode, editingId.value, payload)
      ElMessage.success('元素已更新')
    } else {
      await webUiAutomationApi.createElement(workspaceCode, payload)
      ElMessage.success('元素已创建')
    }
    dialogVisible.value = false
    editingElementSnapshot.value = null
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

function handleElementSelectionChange(selection: WebUiElementItem[]) {
  selectedElements.value = selection
}

async function batchUpdateSelectedElementStatus(nextStatus: 'ENABLED' | 'DISABLED') {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择元素')
    return
  }
  if (nextStatus === 'DISABLED') {
    const confirmed = await confirmElementImpact(selectedElements.value, '停用元素')
    if (!confirmed) {
      return
    }
  }

  batchOperating.value = true
  try {
    const result = await webUiAutomationApi.batchUpdateElementStatus(currentQueryWorkspaceCode.value, {
      elementIds: selectedElements.value.map(item => item.id),
      status: nextStatus,
    })
    ElMessage.success(`已处理 ${result.updatedCount} 个元素`)
    selectedElements.value = []
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchOperating.value = false
  }
}

function batchEnableElements() {
  void batchUpdateSelectedElementStatus('ENABLED')
}

function batchDisableElements() {
  void batchUpdateSelectedElementStatus('DISABLED')
}

function openBatchMoveDialog() {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择元素')
    return
  }
  const first = selectedElements.value[0]
  batchMoveForm.pageId = first.pageId
  batchMoveForm.groupId = first.groupId
  batchMoveDialogVisible.value = true
}

function handleBatchMovePageChange() {
  batchMoveForm.groupId = null
}

async function submitBatchMove() {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择元素')
    return
  }
  const page = pages.value.find(item => item.id === batchMoveForm.pageId)
  if (!page) {
    ElMessage.warning('请选择目标页面对象')
    return
  }
  const group = batchMoveForm.groupId ? groups.value.find(item => item.id === batchMoveForm.groupId) || null : null

  batchOperating.value = true
  try {
    const result = await webUiAutomationApi.batchMoveElements(currentQueryWorkspaceCode.value, {
      elementIds: selectedElements.value.map(item => item.id),
      pageId: page.id,
      groupId: group?.id ?? null,
    })
    ElMessage.success(`已移动 ${result.updatedCount} 个元素`)
    batchMoveDialogVisible.value = false
    selectedElements.value = []
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchOperating.value = false
  }
}

async function batchValidateElements() {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择元素')
    return
  }
  const environment = enabledEnvironments.value.find(item => item.baseUrl)
  if (!environment) {
    ElMessage.warning('请先配置可用的 Web UI 环境后再批量验证')
    return
  }

  batchOperating.value = true
  try {
    const options = {
      baseUrl: environment.baseUrl,
      browserType: environment.browserType || 'CHROMIUM',
      headless: environment.headless ?? true,
      timeoutMs: environment.defaultTimeoutMs || 10000,
    }
    const result = await webUiAutomationApi.batchValidateElements(currentQueryWorkspaceCode.value, {
      elementIds: selectedElements.value.map(item => item.id),
      ...options,
    })
    lastBatchValidateOptions.value = options
    batchValidateSummary.totalCount = result.totalCount
    batchValidateSummary.passedCount = result.passedCount
    batchValidateSummary.failedCount = result.failedCount
    batchValidateResults.value = result.results
    batchValidateFilter.value = result.failedCount ? 'FAILED' : 'ALL'
    batchValidateDrawerVisible.value = true
    ElMessage[result.failedCount ? 'warning' : 'success'](
      `批量验证完成，通过 ${result.passedCount} 个，失败 ${result.failedCount} 个`,
    )
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchOperating.value = false
  }
}

function focusBatchValidateElement(item: WebUiElementValidateResultItem) {
  keyword.value = item.elementName
  pageNo.value = 1
  batchValidateDrawerVisible.value = false
  void loadElements()
}

function getBatchValidateImageSrc(item: WebUiElementValidateResultItem) {
  return item.screenshotBase64 ? `data:image/png;base64,${item.screenshotBase64}` : ''
}

function previewBatchValidateScreenshot(item: WebUiElementValidateResultItem) {
  const imageSrc = getBatchValidateImageSrc(item)
  if (!imageSrc) {
    ElMessage.warning('该验证结果没有截图')
    return
  }
  window.open(imageSrc, '_blank', 'noopener,noreferrer')
}

function previewValidateScreenshot() {
  if (!validateImageSrc.value) {
    ElMessage.warning('本次验证没有截图')
    return
  }
  window.open(validateImageSrc.value, '_blank', 'noopener,noreferrer')
}

function formatValidateFailureHint(message?: string | null) {
  const text = (message || '').toLowerCase()
  if (!message) {
    return '未返回具体失败原因，可先确认页面地址是否正确、元素是否在当前页面渲染。'
  }
  if (text.includes('timeout') || text.includes('timed out') || text.includes('超时')) {
    return '可能是页面加载或元素出现超时，建议检查网络、登录态、等待时间和页面跳转。'
  }
  if (text.includes('invalid') || text.includes('syntax') || text.includes('selector')) {
    return '可能是定位器语法不正确，建议先检查 CSS/XPath/文本定位写法。'
  }
  if (text.includes('navigation') || text.includes('net::') || text.includes('failed to load')) {
    return '可能是验证地址无法打开，建议确认环境 baseUrl、路径和登录态。'
  }
  return '建议优先确认页面地址、登录态、元素是否在当前页面，以及定位器是否足够稳定。'
}

function getValidateFailureHint(result?: ValidateWebUiLocatorResponse | WebUiElementValidateResultItem | null) {
  if (!result || result.matched) {
    return ''
  }
  return formatValidateFailureHint(result.errorMessage)
}

function setBatchValidateFilter(filter: 'ALL' | 'FAILED') {
  batchValidateFilter.value = filter
}

async function retryFailedBatchValidateElements() {
  if (!failedBatchValidateResults.value.length) {
    ElMessage.warning('暂无失败元素可重试')
    return
  }
  if (!lastBatchValidateOptions.value) {
    ElMessage.warning('缺少上次批量验证参数，请重新选择元素后批量验证')
    return
  }

  batchOperating.value = true
  try {
    const result = await webUiAutomationApi.batchValidateElements(currentQueryWorkspaceCode.value, {
      elementIds: failedBatchValidateResults.value.map(item => item.elementId),
      ...lastBatchValidateOptions.value,
    })
    batchValidateSummary.totalCount = result.totalCount
    batchValidateSummary.passedCount = result.passedCount
    batchValidateSummary.failedCount = result.failedCount
    batchValidateResults.value = result.results
    batchValidateFilter.value = result.failedCount ? 'FAILED' : 'ALL'
    ElMessage[result.failedCount ? 'warning' : 'success'](
      `失败项重试完成，通过 ${result.passedCount} 个，失败 ${result.failedCount} 个`,
    )
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchOperating.value = false
  }
}

async function batchDeleteElements() {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择元素')
    return
  }

  const impactConfirmed = await confirmElementImpact(selectedElements.value, '删除元素')
  if (!impactConfirmed) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除选中的 ${selectedElements.value.length} 个元素吗？`, '批量删除元素', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  batchOperating.value = true
  try {
    const result = await webUiAutomationApi.batchDeleteElements(currentQueryWorkspaceCode.value, {
      elementIds: selectedElements.value.map(item => item.id),
    })
    if (result.blockedCount > 0) {
      ElMessage.warning(`有 ${result.blockedCount} 个元素仍被引用，已阻止删除`)
      return
    }
    ElMessage.success(`已删除 ${result.deletedCount} 个元素`)
    selectedElements.value = []
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchOperating.value = false
  }
}

async function runQualityCheck() {
  qualityChecking.value = true
  try {
    const result = await webUiAutomationApi.checkElementQuality(currentQueryWorkspaceCode.value, {
      keyword: keyword.value,
      moduleId: selectedModuleId.value,
      pageId: selectedPageId.value,
      groupId: selectedGroupId.value,
      status: status.value,
      pageNo: 1,
      pageSize: 500,
    })
    qualityIssues.value = result.issues
    const elementPage = await webUiAutomationApi.getElements(currentQueryWorkspaceCode.value, {
      keyword: keyword.value,
      moduleId: selectedModuleId.value,
      pageId: selectedPageId.value,
      groupId: selectedGroupId.value,
      status: status.value,
      pageNo: 1,
      pageSize: 500,
    })
    localQualityIssues.value = buildLocalQualityIssues(elementPage.items)
    qualityIssueFilter.value = 'ALL'
    qualityDrawerVisible.value = true
    if (!hasAnyQualityIssue.value) {
      ElMessage.success('当前筛选范围内暂未发现元素质量问题')
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    qualityChecking.value = false
  }
}

function groupByQualityKey(items: WebUiElementItem[], getKey: (item: WebUiElementItem) => string) {
  const map = new Map<string, WebUiElementItem[]>()
  items.forEach((item) => {
    const key = getKey(item)
    if (!key) return
    const list = map.get(key) || []
    list.push(item)
    map.set(key, list)
  })
  return Array.from(map.values()).filter(list => list.length > 1)
}

function isPageInCurrentQualityScope(page: WebUiElementPageItem) {
  if (selectedModuleId.value && page.moduleId !== selectedModuleId.value) return false
  if (selectedPageId.value && page.id !== selectedPageId.value) return false
  if (selectedWorkspaceCode.value && page.workspaceCode !== selectedWorkspaceCode.value) return false
  if (props.workspaceCode && props.workspaceCode !== 'ALL' && page.workspaceCode !== props.workspaceCode) return false
  return true
}

function isGroupInCurrentQualityScope(group: WebUiElementGroupItem) {
  if (selectedGroupId.value && group.id !== selectedGroupId.value) return false
  if (selectedPageId.value && group.pageId !== selectedPageId.value) return false
  if (selectedWorkspaceCode.value && group.workspaceCode !== selectedWorkspaceCode.value) return false
  if (props.workspaceCode && props.workspaceCode !== 'ALL' && group.workspaceCode !== props.workspaceCode) return false
  if (selectedModuleId.value) {
    const page = pages.value.find(item => item.id === group.pageId)
    return page?.moduleId === selectedModuleId.value
  }
  return true
}

function buildLocalQualityIssues(scopeElements: WebUiElementItem[]): LocalQualityIssue[] {
  const issues: LocalQualityIssue[] = []
  const pushDuplicateIssue = (
    idPrefix: string,
    kind: LocalQualityIssueKind,
    title: string,
    descriptionPrefix: string,
    list: WebUiElementItem[],
  ) => {
    const first = list[0]
    if (!first) return
    issues.push({
      id: `${idPrefix}-${list.map(item => item.id).join('-')}`,
      level: 'HIGH',
      kind,
      title,
      description: `${descriptionPrefix}：${list.map(item => item.elementName).join('、')}`,
      elementId: first.id,
      elementName: first.elementName,
      workspaceCode: first.workspaceCode,
      pageId: first.pageId,
      groupId: first.groupId,
      pageName: first.pageName,
      groupName: first.groupName,
      locatorType: first.locatorType,
      locatorValue: first.locatorValue,
      usageCount: first.usageCount,
    })
  }

  groupByQualityKey(scopeElements, item => `${item.pageId || item.pageName}|${item.groupId || item.groupName || ''}|${item.elementName.trim()}`)
    .forEach(list => pushDuplicateIssue('duplicate-name', 'DUPLICATE_NAME', '元素名称重复', '同页面同分组下存在重复元素名', list))

  groupByQualityKey(scopeElements, item => `${item.pageId || item.pageName}|${item.groupId || item.groupName || ''}|${item.locatorType}|${item.locatorValue.trim()}`)
    .forEach(list => pushDuplicateIssue('duplicate-locator', 'DUPLICATE_LOCATOR', '定位器重复', '同页面同分组下存在重复定位器', list))

  scopeElements
    .filter(item => item.status === 'DISABLED' && item.usageCount > 0)
    .forEach((item) => {
      issues.push({
        id: `disabled-used-${item.id}`,
        level: 'HIGH',
        kind: 'DISABLED_USED',
        title: '被引用元素已禁用',
        description: `该元素仍被 ${item.usageCount} 个用例或模板步骤引用，禁用后可能影响执行。`,
        elementId: item.id,
        elementName: item.elementName,
        workspaceCode: item.workspaceCode,
        pageId: item.pageId,
        groupId: item.groupId,
        pageName: item.pageName,
        groupName: item.groupName,
        locatorType: item.locatorType,
        locatorValue: item.locatorValue,
        usageCount: item.usageCount,
      })
    })

  pages.value
    .filter(isPageInCurrentQualityScope)
    .filter(item => Number(item.elementCount || 0) === 0 && Number(item.groupCount || 0) === 0)
    .forEach((item) => {
      issues.push({
        id: `empty-page-${item.id}`,
        level: 'LOW',
        kind: 'EMPTY_PAGE',
        title: '空页面对象',
        description: '该页面对象下暂无分组和元素，可补充元素或清理无效页面。',
        workspaceCode: item.workspaceCode,
        pageId: item.id,
        pageName: item.pageName,
        groupName: null,
      })
    })

  groups.value
    .filter(isGroupInCurrentQualityScope)
    .filter(item => Number(item.elementCount || 0) === 0)
    .forEach((item) => {
      const page = pages.value.find(pageItem => pageItem.id === item.pageId)
      issues.push({
        id: `empty-group-${item.id}`,
        level: 'LOW',
        kind: 'EMPTY_GROUP',
        title: '空分组',
        description: '该分组下暂无元素，可补充元素或清理无效分组。',
        workspaceCode: item.workspaceCode,
        pageId: item.pageId,
        groupId: item.id,
        pageName: page?.pageName || '-',
        groupName: item.groupName,
      })
    })

  return issues
}
function setQualityIssueFilter(nextFilter: QualityIssueFilter) {
  qualityIssueFilter.value = nextFilter
}

function focusLocalQualityIssue(issue: LocalQualityIssue) {
  keyword.value = issue.elementName || issue.pageName || issue.groupName || ''
  pageNo.value = 1
  qualityDrawerVisible.value = false
  void loadElements()
}

async function editLocalQualityElement(issue: LocalQualityIssue) {
  if (!issue.elementId) {
    ElMessage.warning('该问题没有可编辑的元素')
    return
  }

  const target = elements.value.find(item => item.id === issue.elementId)
  if (target) {
    qualityDrawerVisible.value = false
    openEditDialog(target)
    return
  }

  try {
    const detail = await webUiAutomationApi.getElementDetail(issue.workspaceCode || currentQueryWorkspaceCode.value, issue.elementId)
    qualityDrawerVisible.value = false
    openEditDialog(detail)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function cleanEmptyLocalQualityIssue(issue: LocalQualityIssue) {
  if (issue.kind !== 'EMPTY_PAGE' && issue.kind !== 'EMPTY_GROUP') {
    return
  }

  const targetName = issue.kind === 'EMPTY_PAGE' ? issue.pageName : issue.groupName
  const targetType = issue.kind === 'EMPTY_PAGE' ? '页面对象' : '分组'
  const targetId = issue.kind === 'EMPTY_PAGE' ? issue.pageId : issue.groupId
  if (!targetId) {
    ElMessage.warning(`缺少${targetType} ID，无法清理`)
    return
  }

  try {
    await ElMessageBox.confirm(`确认清理空${targetType}“${targetName || '-'}”吗？`, `清理空${targetType}`, {
      type: 'warning',
      confirmButtonText: '清理',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  qualityChecking.value = true
  try {
    const workspaceCode = issue.workspaceCode || currentQueryWorkspaceCode.value
    if (issue.kind === 'EMPTY_PAGE') {
      await webUiAutomationApi.deleteElementPage(workspaceCode, targetId)
    } else {
      await webUiAutomationApi.deleteElementGroup(workspaceCode, targetId)
    }
    ElMessage.success(`空${targetType}已清理`)
    await reloadAll()
    await runQualityCheck()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    qualityChecking.value = false
  }
}

function focusQualityElement(issue: WebUiElementQualityIssue) {
  keyword.value = issue.elementName
  pageNo.value = 1
  qualityDrawerVisible.value = false
  void loadElements()
}

async function editQualityElement(issue: WebUiElementQualityIssue) {
  const target = elements.value.find(item => item.id === issue.elementId)
  if (target) {
    qualityDrawerVisible.value = false
    openEditDialog(target)
    return
  }

  try {
    const detail = await webUiAutomationApi.getElementDetail(currentQueryWorkspaceCode.value, issue.elementId)
    qualityDrawerVisible.value = false
    openEditDialog(detail)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function openQualityIssueReferences(issue: WebUiElementQualityIssue) {
  void openReferenceDrawer({
    id: issue.elementId,
    workspaceCode: currentQueryWorkspaceCode.value,
    workspaceName: null,
    pageId: issue.pageId,
    groupId: issue.groupId,
    pageName: issue.pageName,
    groupName: issue.groupName,
    elementName: issue.elementName,
    locatorType: issue.locatorType,
    locatorValue: issue.locatorValue,
    description: null,
    status: 'ENABLED',
    lastValidateResult: issue.lastValidateResult,
    lastValidateAt: issue.lastValidateAt,
    lastValidateMessage: null,
    lastMatchCount: null,
    createdAt: null,
    updatedAt: null,
    usageCount: issue.usageCount,
  })
}

async function deleteElement(item: WebUiElementItem) {
  const impactConfirmed = await confirmElementImpact([item], '删除元素')
  if (!impactConfirmed) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除元素“${item.elementName}”吗？`, '删除元素', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  deletingId.value = item.id
  try {
    await webUiAutomationApi.deleteElement(item.workspaceCode || props.workspaceCode, item.id)
    ElMessage.success('元素已删除')
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    deletingId.value = null
  }
}

async function openReferenceDrawer(item: WebUiElementItem) {
  referenceTarget.value = item
  elementReferences.value = []
  referenceDrawerVisible.value = true
  loadingReferences.value = true
  try {
    elementReferences.value = await webUiAutomationApi.getElementReferences(item.workspaceCode || props.workspaceCode, item.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingReferences.value = false
  }
}

function isImpactReferenceLocatorSynced(item: ElementImpactReference) {
  return item.locatorType === item.elementLocatorType && item.locatorValue === item.elementLocatorValue
}

async function loadElementImpactSummary(targets: WebUiElementItem[]): Promise<ElementImpactSummary> {
  const result = await Promise.all(targets.map(async (element) => {
    const references = await webUiAutomationApi.getElementReferences(element.workspaceCode || props.workspaceCode, element.id)
    return {
      element,
      references,
    }
  }))

  const references = result.flatMap(item => item.references)
  return {
    elementCount: targets.length,
    referenceCount: references.length,
    caseCount: references.filter(item => item.sourceType !== 'TEMPLATE').length,
    templateCount: references.filter(item => item.sourceType === 'TEMPLATE').length,
    elementNames: result
      .filter(item => item.references.length > 0)
      .map(item => item.element.elementName),
  }
}

async function confirmElementImpact(targets: WebUiElementItem[], actionName: string) {
  if (!targets.length) {
    return false
  }

  const summary = await loadElementImpactSummary(targets)
  if (!summary.referenceCount) {
    return true
  }

  const names = summary.elementNames.slice(0, 5).join('、')
  const suffix = summary.elementNames.length > 5 ? ` 等 ${summary.elementNames.length} 个元素` : ''
  try {
    await ElMessageBox.confirm(
      `本次${actionName}会影响 ${summary.referenceCount} 个引用步骤，其中用例 ${summary.caseCount} 个、模板 ${summary.templateCount} 个。涉及元素：${names}${suffix}。是否继续？`,
      '元素引用影响提示',
      {
        type: 'warning',
        confirmButtonText: '继续',
        cancelButtonText: '取消',
      },
    )
    return true
  } catch {
    return false
  }
}

async function openImpactDrawer(targets = selectedElements.value) {
  if (!targets.length) {
    ElMessage.warning('请先选择元素')
    return
  }

  impactTargetElements.value = targets
  impactReferences.value = []
  impactDrawerVisible.value = true
  loadingImpactReferences.value = true
  try {
    const result = await Promise.all(targets.map(async (element) => {
      const references = await webUiAutomationApi.getElementReferences(element.workspaceCode || props.workspaceCode, element.id)
      return references.map(reference => ({
        ...reference,
        elementId: element.id,
        elementName: element.elementName,
        elementLocatorType: element.locatorType,
        elementLocatorValue: element.locatorValue,
      }))
    }))
    impactReferences.value = result.flat()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingImpactReferences.value = false
  }
}

async function syncUnsyncedImpactReferences() {
  if (!unsyncedImpactElementIds.value.length) {
    ElMessage.warning('暂无不同步引用需要处理')
    return
  }

  syncingImpactReferences.value = true
  try {
    let totalCount = 0
    for (const elementId of unsyncedImpactElementIds.value) {
      const element = impactTargetElements.value.find(item => item.id === elementId)
      if (!element) continue
      const result = await webUiAutomationApi.syncElementReferenceLocators(
        element.workspaceCode || props.workspaceCode,
        element.id,
      )
      totalCount += result.totalCount
    }
    ElMessage.success(`已同步 ${totalCount} 个引用步骤`)
    await openImpactDrawer(impactTargetElements.value)
    await loadElements()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    syncingImpactReferences.value = false
  }
}

function buildReferenceSourceUrl(item: WebUiElementReferenceItem) {
  const path = item.sourceType === 'TEMPLATE' ? '/automation/web/templates' : '/automation/web/cases'
  const query = new URLSearchParams({
    [item.sourceType === 'TEMPLATE' ? 'templateId' : 'caseId']: String(item.sourceId),
    stepId: String(item.stepId),
  })
  return `${window.location.origin}${path}?${query.toString()}`
}

function openReferenceSource(item: WebUiElementReferenceItem) {
  window.open(buildReferenceSourceUrl(item), '_blank', 'noopener,noreferrer')
}

async function syncReferenceLocators() {
  if (!referenceTarget.value) {
    return
  }

  syncingReferences.value = true
  try {
    const result = await webUiAutomationApi.syncElementReferenceLocators(
      referenceTarget.value.workspaceCode || props.workspaceCode,
      referenceTarget.value.id,
    )
    ElMessage.success(`已同步 ${result.totalCount} 个引用步骤`)
    await openReferenceDrawer(referenceTarget.value)
    await loadElements()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    syncingReferences.value = false
  }
}

function openCreateModuleDialog(workspaceCode?: string | null) {
  const targetWorkspaceCode = workspaceCode || getWorkspaceCodeForCreate()
  if (!targetWorkspaceCode) {
    ElMessage.warning('请先选择具体工作空间后再新增模块')
    return
  }
  moduleDialogWorkspaceCode.value = targetWorkspaceCode
  moduleForm.moduleName = ''
  moduleForm.description = ''
  moduleForm.sortOrder = modules.value.filter(item => item.workspaceCode === targetWorkspaceCode).length + 1
  moduleForm.status = 'ENABLED'
  moduleDialogVisible.value = true
}

async function saveModule() {
  const workspaceCode = moduleDialogWorkspaceCode.value || getWorkspaceCodeForCreate()
  if (!workspaceCode) {
    ElMessage.warning('请先选择具体工作空间')
    return
  }
  if (!moduleForm.moduleName.trim()) {
    ElMessage.warning('请填写模块名称')
    return
  }

  savingModule.value = true
  try {
    await webUiAutomationApi.createElementModule(workspaceCode, {
      workspaceCode,
      moduleName: moduleForm.moduleName.trim(),
      description: moduleForm.description?.trim() || null,
      sortOrder: moduleForm.sortOrder ?? 0,
      status: moduleForm.status || 'ENABLED',
    })
    ElMessage.success('模块已创建')
    moduleDialogVisible.value = false
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingModule.value = false
  }
}

function openCreatePageDialog(moduleId?: number | null) {
  const moduleItem = moduleId
    ? modules.value.find(item => item.id === moduleId)
    : getSelectedModule()
  if (!moduleItem) {
    ElMessage.warning('请先选择模块后再新增页面对象')
    return
  }
  pageDialogWorkspaceCode.value = moduleItem.workspaceCode
  pageForm.moduleId = moduleItem.id
  pageForm.moduleName = moduleItem.moduleName
  pageForm.pageName = ''
  pageForm.pagePath = ''
  pageForm.description = ''
  pageForm.sortOrder = pages.value.filter(item => item.moduleId === moduleItem.id).length + 1
  pageForm.status = 'ENABLED'
  pageDialogVisible.value = true
}

async function savePage() {
  const workspaceCode = pageDialogWorkspaceCode.value || getWorkspaceCodeForCreate()
  if (!workspaceCode) {
    ElMessage.warning('请先选择具体工作空间')
    return
  }
  if (!pageForm.moduleId) {
    ElMessage.warning('请选择所属模块')
    return
  }
  if (!pageForm.pageName.trim()) {
    ElMessage.warning('请填写页面对象名称')
    return
  }

  savingPage.value = true
  try {
    const payload: SaveWebUiElementPagePayload = {
      workspaceCode,
      moduleId: pageForm.moduleId,
      moduleName: pageForm.moduleName?.trim() || null,
      pageName: pageForm.pageName.trim(),
      pagePath: pageForm.pagePath?.trim() || null,
      description: pageForm.description?.trim() || null,
      sortOrder: pageForm.sortOrder ?? 0,
      status: pageForm.status || 'ENABLED',
    }
    await webUiAutomationApi.createElementPage(workspaceCode, payload)
    ElMessage.success('页面对象已创建')
    pageDialogVisible.value = false
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingPage.value = false
  }
}

function openCreateGroupDialog(pageId?: number | null) {
  const page = pageId
    ? pages.value.find(item => item.id === pageId)
    : getSelectedPageForGroup()
  if (!page) {
    ElMessage.warning('请先选择页面对象')
    return
  }
  groupDialogWorkspaceCode.value = page.workspaceCode
  groupForm.pageId = page.id
  groupForm.groupName = ''
  groupForm.description = ''
  groupForm.sortOrder = groups.value.filter(item => item.pageId === page.id).length + 1
  groupForm.status = 'ENABLED'
  groupDialogVisible.value = true
}

async function saveGroup() {
  const page = pages.value.find(item => item.id === groupForm.pageId)
  const workspaceCode = groupDialogWorkspaceCode.value || page?.workspaceCode || getWorkspaceCodeForCreate()
  if (!workspaceCode) {
    ElMessage.warning('请先选择具体工作空间')
    return
  }
  if (!groupForm.pageId) {
    ElMessage.warning('请选择所属页面')
    return
  }
  if (!groupForm.groupName.trim()) {
    ElMessage.warning('请填写分组名称')
    return
  }
  savingGroup.value = true
  try {
    const payload: SaveWebUiElementGroupPayload = {
      workspaceCode,
      pageId: groupForm.pageId,
      groupName: groupForm.groupName.trim(),
      description: groupForm.description?.trim() || null,
      sortOrder: groupForm.sortOrder ?? 0,
      status: groupForm.status || 'ENABLED',
    }
    await webUiAutomationApi.createElementGroup(workspaceCode, payload)
    ElMessage.success('分组已创建')
    groupDialogVisible.value = false
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingGroup.value = false
  }
}

function handleNodeAdd(node: ElementDirectoryNode) {
  selectedTree.value = {
    id: node.id,
    type: node.type,
    rawId: node.rawId,
    workspaceCode: node.workspaceCode,
    label: node.label,
  }
  if (node.type === 'WORKSPACE') {
    openCreateModuleDialog(node.workspaceCode)
  } else if (node.type === 'MODULE') {
    openCreatePageDialog(node.rawId)
  } else if (node.type === 'PAGE') {
    openCreateGroupDialog(node.rawId)
  }
}

function openValidateDialog(item: WebUiElementItem) {
  validateTarget.value = item
  validateResult.value = null
  validateEnvironmentId.value = enabledEnvironments.value[0]?.id ?? null
  validateBaseUrl.value = enabledEnvironments.value[0]?.baseUrl || ''
  validateDialogVisible.value = true
}

function handleValidateEnvironmentChange(value: number | null) {
  const environment = enabledEnvironments.value.find(item => item.id === value)
  validateBaseUrl.value = environment?.baseUrl || ''
}

async function submitValidateElement() {
  if (!validateTarget.value) {
    return
  }
  if (!validateBaseUrl.value.trim()) {
    ElMessage.warning('请填写验证地址')
    return
  }

  const environment = enabledEnvironments.value.find(item => item.id === validateEnvironmentId.value)
  validatingId.value = validateTarget.value.id
  try {
    const result = await webUiAutomationApi.validateElement(validateTarget.value.workspaceCode || props.workspaceCode, validateTarget.value.id, {
      baseUrl: validateBaseUrl.value.trim(),
      browserType: environment?.browserType || 'CHROMIUM',
      headless: environment?.headless ?? true,
      timeoutMs: environment?.defaultTimeoutMs || 10000,
    })
    validateResult.value = result
    ElMessage[result.matched ? 'success' : 'warning'](
      result.matched ? `验证通过，匹配 ${result.matchCount} 个元素` : result.errorMessage || '未匹配到元素',
    )
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    validatingId.value = null
  }
}

function handlePageChange(value: number) {
  pageNo.value = value
  void loadElements()
}

function handlePageSizeChange(value: number) {
  pageSize.value = value
  pageNo.value = 1
  void loadElements()
}

function getNodeIcon(type: DirectoryNodeType) {
  if (type === 'WORKSPACE') {
    return Folder
  }
  if (type === 'MODULE') {
    return Grid
  }
  if (type === 'PAGE') {
    return Document
  }
  if (type === 'GROUP') {
    return CollectionTag
  }
  return null
}

watch(
  () => [props.workspaceCode, props.workspaceReady] as const,
  () => {
    if (!isWorkspaceReady()) {
      return
    }
    selectedTree.value = {
      id: 'all',
      type: 'ALL',
      rawId: null,
      workspaceCode: null,
      label: '全部元素',
    }
    pageNo.value = 1
    void reloadAll()
  },
  { immediate: true },
)
</script>

<template>
  <section class="web-ui-element-library">
    <aside class="web-ui-element-tree">
      <AppButton class="web-ui-element-tree__create" type="primary" :icon="Plus" @click="openCreateDialog">
        新增元素
      </AppButton>

      <el-input
        v-model="directoryKeyword"
        class="web-ui-element-tree__search"
        clearable
        placeholder="搜索模块、页面或分组名称"
        :prefix-icon="Search"
      />

      <header class="web-ui-element-tree__title">
        <strong>页面对象</strong>
        <small>{{ directoryTotal }}</small>
      </header>

      <el-tree
        v-loading="loadingTree"
        :data="treeData"
        node-key="id"
        :default-expanded-keys="expandedTreeKeys"
        :current-node-key="selectedTree.id"
        highlight-current
        :expand-on-click-node="false"
        class="web-ui-element-tree__directory"
        @node-click="handleTreeNodeClick"
      >
        <template #default="{ data }">
          <span class="web-ui-element-tree__node">
            <span class="web-ui-element-tree__node-main">
              <el-icon v-if="getNodeIcon(data.type)" class="web-ui-element-tree__folder">
                <component :is="getNodeIcon(data.type)" />
              </el-icon>
              <span>{{ data.label }}</span>
              <small>{{ data.elementCount }}</small>
            </span>
            <el-button
              v-if="data.type === 'WORKSPACE' || data.type === 'MODULE' || data.type === 'PAGE'"
              link
              class="web-ui-element-tree__node-add"
              :icon="Plus"
              @click.stop="handleNodeAdd(data)"
            />
          </span>
        </template>
      </el-tree>
    </aside>

    <main class="web-ui-element-content">
      <header class="web-ui-element-library__header">
        <div class="web-ui-filter-toolbar">
          <div class="web-ui-filter-toolbar__query">
            <el-input
              v-model="keyword"
              class="web-ui-filter-toolbar__search"
              clearable
              placeholder="搜索元素名称 / 定位值 / 备注"
              :prefix-icon="Search"
              @keyup.enter="searchElements"
            />
            <el-select v-model="status" class="web-ui-filter-toolbar__select" clearable placeholder="状态">
              <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <AppButton :icon="Search" @click="searchElements">查询</AppButton>
            <AppButton :icon="RefreshRight" @click="resetFilters">重置</AppButton>
          </div>
          <div class="web-ui-filter-toolbar__actions">
            <AppButton @click="openImportDialog">导入</AppButton>
            <AppButton @click="exportCurrentElements">导出</AppButton>
            <AppButton :icon="CollectionTag" :loading="qualityChecking" @click="runQualityCheck">质量检查</AppButton>
            <AppButton class="web-ui-filter-toolbar__ai" :icon="Cpu" @click="openAiCollectDrawer">AI 采集</AppButton>
          </div>
        </div>
      </header>

      <div class="web-ui-element-library__scope">
        当前范围：{{ selectedTree.label }}
      </div>

      <AppLoadingState v-if="loading && !elements.length" text="正在加载元素库..." />
      <AppEmptyState
        v-else-if="!loading && !elements.length"
        title="暂无 Web UI 元素"
        description="先按空间、模块、页面和分组整理元素，再在用例步骤中复用。"
      />
      <template v-else>
        <div v-if="selectedElements.length" class="web-ui-element-batch-toolbar">
          <span>已选 {{ selectedElements.length }} 个元素</span>
          <AppButton size="small" :loading="batchOperating" @click="batchEnableElements">批量启用</AppButton>
          <AppButton size="small" :loading="batchOperating" @click="batchDisableElements">批量停用</AppButton>
          <AppButton size="small" :loading="batchOperating" @click="openBatchMoveDialog">移动分组</AppButton>
          <AppButton size="small" :loading="batchOperating" @click="batchValidateElements">批量验证</AppButton>
          <AppButton size="small" :loading="loadingImpactReferences" @click="openImpactDrawer()">影响分析</AppButton>
          <AppButton size="small" type="danger" :loading="batchOperating" @click="batchDeleteElements">批量删除</AppButton>
        </div>

        <el-table
          v-loading="loading"
          :data="elements"
          row-key="id"
          border
          empty-text="暂无 Web UI 元素"
          @selection-change="handleElementSelectionChange"
        >
          <el-table-column type="selection" width="48" />
          <el-table-column prop="pageName" label="页面对象" min-width="130" show-overflow-tooltip />
          <el-table-column prop="groupName" label="分组" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.groupName || '-' }}</template>
          </el-table-column>
          <el-table-column prop="elementName" label="元素名称" min-width="160" show-overflow-tooltip />
          <el-table-column label="定位方式" width="112">
            <template #default="{ row }">{{ formatLocatorType(row.locatorType) }}</template>
          </el-table-column>
          <el-table-column prop="locatorValue" label="定位值" min-width="220" show-overflow-tooltip />
          <el-table-column label="状态" width="88">
            <template #default="{ row }">
              <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" effect="light">
                {{ row.status === 'ENABLED' ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="验证结果" min-width="150">
            <template #default="{ row }">
              <el-tag
                v-if="row.lastValidateResult"
                :type="row.lastValidateResult === 'PASSED' ? 'success' : 'danger'"
                effect="light"
              >
                {{ row.lastValidateResult === 'PASSED' ? `通过 ${row.lastMatchCount ?? 0}` : '失败' }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="最近验证" width="160">
            <template #default="{ row }">{{ formatWebUiDateTime(row.lastValidateAt) }}</template>
          </el-table-column>
          <el-table-column label="引用" width="76">
            <template #default="{ row }">
              <el-button
                v-if="row.usageCount > 0"
                link
                type="primary"
                @click="openReferenceDrawer(row)"
              >
                {{ row.usageCount }}
              </el-button>
              <span v-else>0</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <el-button :icon="View" link type="primary" @click="openDetailDrawer(row)">详情</el-button>
              <el-button :icon="VideoPlay" link type="primary" :loading="validatingId === row.id" @click="openValidateDialog(row)">验证</el-button>
              <el-button :icon="Edit" link type="primary" @click="openEditDialog(row)">编辑</el-button>
              <el-button :icon="Delete" link type="danger" :loading="deletingId === row.id" @click="deleteElement(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="web-ui-pagination">
          <el-pagination
            v-model:current-page="pageNo"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            background
            @current-change="handlePageChange"
            @size-change="handlePageSizeChange"
          />
        </div>
      </template>
    </main>

    <el-dialog v-model="batchMoveDialogVisible" title="批量移动分组" width="560px">
      <el-form label-width="96px">
        <el-form-item label="目标页面" required>
          <el-select v-model="batchMoveForm.pageId" filterable placeholder="选择页面对象" @change="handleBatchMovePageChange">
            <el-option v-for="item in pages" :key="item.id" :label="item.pageName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标分组">
          <el-select v-model="batchMoveForm.groupId" clearable filterable placeholder="可不选择分组">
            <el-option v-for="item in batchMoveGroupOptions" :key="item.id" :label="item.groupName" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="batchMoveDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="batchOperating" @click="submitBatchMove">确认移动</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="importDialogVisible"
      title="批量导入元素"
      width="760px"
      class="web-ui-element-import-dialog"
    >
      <div class="web-ui-element-import">
        <el-alert
          type="info"
          show-icon
          :closable="false"
          title="请粘贴 JSON 数组。支持 moduleName、pageName、pagePath、groupName、elementName、locatorType、locatorValue、description、status。"
        />
        <el-input
          v-model="importJsonText"
          type="textarea"
          :rows="16"
          resize="vertical"
          spellcheck="false"
          placeholder='[{"moduleName":"订单模块","pageName":"订单列表页","groupName":"查询区","elementName":"订单号输入框","locatorType":"CSS","locatorValue":"input[name=\"orderNo\"]"}]'
        />
      </div>
      <template #footer>
        <AppButton @click="importDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="importingElements" @click="importElementsFromJson">开始导入</AppButton>
      </template>
    </el-dialog>

    <WebUiElementValidateDrawer
      v-model="batchValidateDrawerVisible"
      :summary="batchValidateSummary"
      :filter="batchValidateFilter"
      :results="visibleBatchValidateResults"
      :failed-count="failedBatchValidateResults.length"
      :operating="batchOperating"
      @filter-change="setBatchValidateFilter"
      @preview-screenshot="previewBatchValidateScreenshot"
      @focus="focusBatchValidateElement"
      @retry="retryFailedBatchValidateElements"
    />

    <WebUiElementQualityDrawer
      v-model="qualityDrawerVisible"
      :filter="qualityIssueFilter"
      :high-count="totalHighQualityIssueCount"
      :medium-count="totalMediumQualityIssueCount"
      :low-count="totalLowQualityIssueCount"
      :has-any-issue="hasAnyQualityIssue"
      :local-issues="visibleLocalQualityIssues"
      :backend-issues="visibleBackendQualityIssues"
      :checking="qualityChecking"
      @filter-change="setQualityIssueFilter"
      @focus-local="focusLocalQualityIssue"
      @edit-local="editLocalQualityElement"
      @clean-local="cleanEmptyLocalQualityIssue"
      @focus-backend="focusQualityElement"
      @edit-backend="editQualityElement"
      @open-references="openQualityIssueReferences"
      @rerun="runQualityCheck"
    />

    <WebUiElementImpactDrawer
      v-model="impactDrawerVisible"
      :element-count="impactTargetElements.length"
      :stats="impactReferenceStats"
      :references="impactReferences"
      :loading="loadingImpactReferences"
      :syncing="syncingImpactReferences"
      :unsynced-count="unsyncedImpactElementIds.length"
      @open="openReferenceSource"
      @sync="syncUnsyncedImpactReferences"
    />

    <WebUiElementDetailDrawer
      v-model="detailDrawerVisible"
      :target="detailTarget"
      :module-name="detailModuleName"
      :validate-tag-type="detailValidateTagType"
      :validate-label="detailValidateLabel"
      @open-reference="openReferenceDrawer"
      @edit="openEditDialog"
    />

    <WebUiElementReferenceDrawer
      v-model="referenceDrawerVisible"
      :target="referenceTarget"
      :references="elementReferences"
      :loading="loadingReferences"
      :syncing="syncingReferences"
      @open="openReferenceSource"
      @sync="syncReferenceLocators"
    />

    <WebUiElementAiCollectDrawer
      v-model="aiCollectDrawerVisible"
      v-model:ai-collect-mode="aiCollectMode"
      :ai-collect-form="aiCollectForm"
      :ai-provider-loading="aiProviderLoading"
      :available-ai-providers="availableAiProviders"
      :enabled-environments="enabledEnvironments"
      :modules="modules"
      :page-options="aiCollectPageOptions"
      :group-options="aiCollectGroupOptions"
      :candidates="aiCandidates"
      :visible-candidates="visibleAiCandidates"
      :candidate-summary="aiCandidateSummary"
      :collect-filter-summary="aiCollectFilterSummary"
      :collect-task="currentCollectTask"
      :collect-task-refreshing="collectTaskRefreshing"
      :selected-count="aiSelectedCandidates.length"
      :candidate-filter="aiCandidateFilter"
      :collecting="aiCollecting"
      :local-runner-checking="localRunnerChecking"
      :local-runner-opening="localRunnerOpening"
      :local-runner-capturing="localRunnerCapturing"
      :local-runner-health="localRunnerHealth"
      :saving="aiSaving"
      @module-change="handleAiModuleChange"
      @page-change="handleAiPageChange"
      @group-change="handleAiGroupChange"
      @filter-change="setAiCandidateFilter"
      @generate="generateAiCandidates"
      @check-local-runner="checkLocalRunner"
      @open-local-runner-page="openLocalRunnerCollectPage"
      @capture-local-runner-page="captureLocalRunnerCandidates"
      @refresh-collect-task="refreshCurrentCollectTask"
      @select-recommended="selectRecommendedPassedAiCandidates"
      @unselect-risky="unselectRiskyAiCandidates"
      @batch-update-group="batchUpdateAiCandidateGroup"
      @preview-screenshot="previewAiCandidateScreenshot"
      @save="saveAiCandidates"
    />

    <el-dialog v-model="moduleDialogVisible" title="新增模块" width="560px">
      <el-form label-width="96px">
        <el-form-item label="模块名称" required>
          <el-input v-model="moduleForm.moduleName" maxlength="80" placeholder="例如：订单模块" show-word-limit />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="moduleForm.sortOrder" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="moduleForm.status">
            <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="moduleForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="moduleDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="savingModule" @click="saveModule">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog v-model="pageDialogVisible" title="新增页面对象" width="560px">
      <el-form label-width="96px">
        <el-form-item label="所属模块" required>
          <el-select v-model="pageForm.moduleId" filterable>
            <el-option v-for="item in pageModuleOptions" :key="item.id" :label="item.moduleName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="页面名称" required>
          <el-input v-model="pageForm.pageName" maxlength="80" show-word-limit />
        </el-form-item>
        <el-form-item label="路径规则">
          <el-input v-model="pageForm.pagePath" maxlength="500" clearable placeholder="/login 或 /orders/*" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="pageForm.sortOrder" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="pageForm.status">
            <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="pageForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="pageDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="savingPage" @click="savePage">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog v-model="groupDialogVisible" title="新增分组" width="560px">
      <el-form label-width="96px">
        <el-form-item label="所属页面" required>
          <el-select v-model="groupForm.pageId">
            <el-option v-for="item in groupPageOptions" :key="item.id" :label="item.pageName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="分组名称" required>
          <el-input v-model="groupForm.groupName" maxlength="80" show-word-limit />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="groupForm.sortOrder" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="groupForm.status">
            <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="groupForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="groupDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="savingGroup" @click="saveGroup">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑元素' : '新增元素'" width="620px">
      <el-form label-width="96px">
        <el-form-item label="页面对象" required>
          <el-select v-model="form.pageId" clearable filterable placeholder="选择页面对象" @change="handleElementPageChange">
            <el-option v-for="item in elementPageOptions" :key="item.id" :label="item.pageName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="页面分组">
          <el-select v-model="form.groupId" clearable filterable placeholder="选择分组" @change="handleElementGroupChange">
            <el-option v-for="item in availableGroups" :key="item.id" :label="item.groupName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="元素名称" required>
          <el-input v-model="form.elementName" maxlength="80" placeholder="例如：用户名输入框" show-word-limit />
        </el-form-item>
        <el-form-item label="定位方式" required>
          <el-select v-model="form.locatorType">
            <el-option v-for="item in WEB_UI_LOCATOR_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="定位值" required>
          <el-input v-model="form.locatorValue" maxlength="1000" clearable placeholder="#username 或 //input[@name='username']" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="dialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="saving" @click="saveElement">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog v-model="validateDialogVisible" title="验证元素定位器" width="720px">
      <div class="web-ui-element-validate">
        <el-alert
          v-if="validateTarget"
          type="info"
          show-icon
          :closable="false"
          :title="`${validateTarget.elementName}：${formatLocatorType(validateTarget.locatorType)} = ${validateTarget.locatorValue}`"
        />
        <el-form label-width="96px">
          <el-form-item label="运行环境">
            <el-select v-model="validateEnvironmentId" clearable placeholder="选择环境" @change="handleValidateEnvironmentChange">
              <el-option v-for="item in enabledEnvironments" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="验证地址" required>
            <el-input v-model="validateBaseUrl" placeholder="https://example.com/login" />
          </el-form-item>
        </el-form>

        <el-alert
          v-if="validateResult"
          :type="validateResult.matched ? 'success' : 'warning'"
          :title="validateResult.matched ? `匹配到 ${validateResult.matchCount} 个元素` : '未匹配到元素'"
          :description="validateResult.errorMessage || ''"
          show-icon
          :closable="false"
        />
        <el-alert
          v-if="getValidateFailureHint(validateResult)"
          type="info"
          show-icon
          :closable="false"
          :title="getValidateFailureHint(validateResult)"
        />
        <div v-if="validateImageSrc" class="web-ui-element-validate__screenshot">
          <img class="web-ui-element-validate__image" :src="validateImageSrc" alt="元素验证截图">
          <AppButton size="small" @click="previewValidateScreenshot">查看大图</AppButton>
        </div>
      </div>
      <template #footer>
        <AppButton @click="validateDialogVisible = false">关闭</AppButton>
        <AppButton type="primary" :loading="validatingId !== null" @click="submitValidateElement">开始验证</AppButton>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.web-ui-element-library {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: var(--app-space-4);
  min-width: 0;
}

.web-ui-element-tree {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.web-ui-element-tree__create {
  width: 100%;
  justify-content: center;
}

.web-ui-element-tree__title,
.web-ui-element-tree__node,
.web-ui-element-tree__node-main,
.web-ui-element-library__header,
.web-ui-filter-toolbar {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-element-tree__title {
  justify-content: flex-start;
  padding-top: var(--app-space-2);
}

.web-ui-element-tree__title strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.web-ui-element-tree__title small,
.web-ui-element-tree__node small {
  color: var(--app-text-muted);
}

.web-ui-element-tree__directory {
  min-height: 0;
}

.web-ui-element-tree__node {
  width: 100%;
  min-width: 0;
  justify-content: space-between;
}

.web-ui-element-tree__node-main {
  min-width: 0;
  flex: 1;
  gap: var(--app-space-2);
}

.web-ui-element-tree__node-main span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-element-tree__folder {
  flex-shrink: 0;
  color: #409eff;
}

.web-ui-element-tree__node-add {
  width: 24px;
  height: 24px;
  min-height: 24px;
  color: var(--app-text-muted);
}

.web-ui-element-content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.web-ui-element-library__header,
.web-ui-filter-toolbar {
  justify-content: flex-start;
  flex-wrap: wrap;
}

.web-ui-filter-toolbar {
  flex: 1;
  width: 100%;
  min-width: 0;
  justify-content: space-between;
  flex-wrap: wrap;
}

.web-ui-filter-toolbar__query,
.web-ui-filter-toolbar__actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  min-width: 0;
  flex-wrap: wrap;
}

.web-ui-filter-toolbar__query {
  flex: 1 1 520px;
}

.web-ui-filter-toolbar__actions {
  flex: 0 0 auto;
  justify-content: flex-end;
}

.web-ui-filter-toolbar__search {
  width: 320px;
  flex: 0 0 320px;
}

.web-ui-filter-toolbar__select {
  flex: 0 0 156px;
  width: 156px;
}

.web-ui-filter-toolbar__ai {
  margin-left: 0;
}

.web-ui-filter-toolbar :deep(.app-button) {
  flex: 0 0 auto;
}

@media (max-width: 900px) {
  .web-ui-filter-toolbar__search {
    flex: 1 1 240px;
    width: auto;
  }

  .web-ui-filter-toolbar__actions {
    justify-content: flex-start;
  }
}

.web-ui-element-batch-toolbar {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  justify-content: flex-start;
  flex-wrap: wrap;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-element-import {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-element-validate__screenshot {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-element-validate__screenshot :deep(.app-button) {
  justify-self: flex-start;
}

.web-ui-element-library__scope {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--app-space-4);
}

.web-ui-element-validate {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-element-validate :deep(.el-select),
.web-ui-element-library :deep(.el-select),
.web-ui-element-library :deep(.el-input-number) {
  width: 100%;
}

.web-ui-element-validate__image {
  display: block;
  width: 100%;
  max-height: 420px;
  object-fit: contain;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
}

@media (max-width: 1100px) {
  .web-ui-element-library {
    grid-template-columns: 1fr;
  }
}

</style>
