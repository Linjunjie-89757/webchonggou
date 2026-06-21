<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { CollectionTag, Cpu, Delete, Document, Edit, Folder, Grid, Plus, RefreshRight, Search, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  formatLocatorType,
  formatStepType,
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
  type WebUiElementModuleItem,
  type WebUiElementPageItem,
  type WebUiElementQualityIssue,
  type WebUiElementReferenceItem,
  type WebUiEnvironmentItem,
  type WebUiLocatorType,
  type WebUiStepType,
} from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

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

interface AiElementCandidate {
  id: string
  selected: boolean
  groupName: string
  elementName: string
  locatorType: WebUiLocatorType
  locatorValue: string
  confidence: number
  reason: string
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
const loadingReferences = ref(false)
const syncingReferences = ref(false)
const aiCollectDrawerVisible = ref(false)
const aiCollectMode = ref<AiCollectMode>('ONLINE')
const aiCollecting = ref(false)
const aiSaving = ref(false)
const batchOperating = ref(false)
const batchMoveDialogVisible = ref(false)
const qualityDrawerVisible = ref(false)
const qualityChecking = ref(false)
const editingId = ref<number | null>(null)
const moduleDialogWorkspaceCode = ref<string | null>(null)
const pageDialogWorkspaceCode = ref<string | null>(null)
const groupDialogWorkspaceCode = ref<string | null>(null)
const elementDialogWorkspaceCode = ref<string | null>(null)
const validateDialogVisible = ref(false)
const validateTarget = ref<WebUiElementItem | null>(null)
const validateEnvironmentId = ref<number | null>(null)
const validateBaseUrl = ref('')
const validateResult = ref<ValidateWebUiLocatorResponse | null>(null)
const referenceTarget = ref<WebUiElementItem | null>(null)
const elementReferences = ref<WebUiElementReferenceItem[]>([])
const editingElementSnapshot = ref<WebUiElementItem | null>(null)
const aiCandidates = ref<AiElementCandidate[]>([])
const selectedElements = ref<WebUiElementItem[]>([])
const qualityIssues = ref<WebUiElementQualityIssue[]>([])

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
const batchMoveGroupOptions = computed(() => {
  if (!batchMoveForm.pageId) {
    return []
  }
  return groups.value.filter(item => item.pageId === batchMoveForm.pageId)
})
const highQualityIssues = computed(() => qualityIssues.value.filter(item => item.level === 'HIGH'))
const mediumQualityIssues = computed(() => qualityIssues.value.filter(item => item.level === 'MEDIUM'))
const lowQualityIssues = computed(() => qualityIssues.value.filter(item => item.level === 'LOW'))

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

function openAiCollectDrawer() {
  const moduleItem = getSelectedModule()
  const page = selectedTree.value.type === 'PAGE'
    ? pages.value.find(item => item.id === selectedTree.value.rawId) || null
    : selectedTree.value.type === 'GROUP'
      ? pages.value.find(item => item.id === groups.value.find(group => group.id === selectedTree.value.rawId)?.pageId) || null
    : null
  aiCollectMode.value = 'ONLINE'
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
  aiCollectDrawerVisible.value = true
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

function getAiCustomGroupName() {
  if (aiCollectForm.groupStrategy !== 'CUSTOM') {
    return ''
  }
  const group = groups.value.find(item => item.id === aiCollectForm.groupId)
  return (aiCollectForm.groupName || group?.groupName || '').trim()
}

function generateAiCandidates() {
  if (!aiCollectForm.moduleId) {
    ElMessage.warning('请选择所属模块')
    return
  }
  if (!aiCollectForm.pageName.trim() && !aiCollectForm.pageId) {
    ElMessage.warning('请选择或填写页面对象名称')
    return
  }
  if (aiCollectMode.value === 'ONLINE' && !aiCollectForm.pageUrl.trim()) {
    ElMessage.warning('请填写页面 URL')
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
  window.setTimeout(() => {
    const scope = aiCollectForm.scope
    const candidates: AiElementCandidate[] = []
    const includeForm = scope === 'ALL' || scope === 'FORM'
    const includeButton = scope === 'ALL' || scope === 'BUTTON'
    const includeTable = scope === 'ALL' || scope === 'TABLE'
    const includeDialog = scope === 'ALL' || scope === 'DIALOG'

    if (includeForm) {
      candidates.push(
        {
          id: 'username-input',
          selected: true,
          groupName: '表单区',
          elementName: '用户名输入框',
          locatorType: 'CSS',
          locatorValue: '#username',
          confidence: 92,
          reason: '优先使用 id，定位稳定',
        },
        {
          id: 'password-input',
          selected: true,
          groupName: '表单区',
          elementName: '密码输入框',
          locatorType: 'CSS',
          locatorValue: 'input[type="password"]',
          confidence: 82,
          reason: '根据输入类型识别，建议后续补充 data-testid',
        },
      )
    }
    if (includeButton) {
      candidates.push({
        id: 'submit-button',
        selected: true,
        groupName: '操作区',
        elementName: '提交按钮',
        locatorType: 'ROLE',
        locatorValue: 'button:提交',
        confidence: 88,
        reason: '按钮文本清晰，Role 定位可读性较好',
      })
    }
    if (includeTable) {
      candidates.push({
        id: 'result-table',
        selected: true,
        groupName: '表格区',
        elementName: '结果表格',
        locatorType: 'CSS',
        locatorValue: '.el-table',
        confidence: 76,
        reason: '识别到 Element Plus 表格容器，建议确认页面唯一性',
      })
    }
    if (includeDialog) {
      candidates.push({
        id: 'confirm-dialog',
        selected: false,
        groupName: '弹窗区',
        elementName: '确认弹窗',
        locatorType: 'CSS',
        locatorValue: '.el-dialog',
        confidence: 70,
        reason: '弹窗容器可能复用，保存前建议调整为更精确定位',
      })
    }

    aiCandidates.value = aiCollectForm.groupStrategy === 'CUSTOM'
      ? candidates.map(item => ({ ...item, groupName: customGroupName }))
      : candidates
    aiCollecting.value = false
    ElMessage.success('已生成候选元素，请确认后批量保存')
  }, 300)
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
        description: 'AI 采集创建',
        sortOrder: pages.value.filter(item => item.moduleId === moduleItem.id).length + 1,
        status: 'ENABLED',
      })
      page = createdPage
    }

    const groupMap = new Map<string, WebUiElementGroupItem>()
    for (const group of groups.value.filter(item => item.pageId === page.id)) {
      groupMap.set(group.groupName, group)
    }

    for (const candidate of aiSelectedCandidates.value) {
      const groupName = candidate.groupName.trim()
      let group = groupMap.get(groupName)
      if (!group) {
        group = await webUiAutomationApi.createElementGroup(page.workspaceCode, {
          workspaceCode: page.workspaceCode,
          pageId: page.id,
          groupName,
          description: 'AI 采集创建',
          sortOrder: groupMap.size + 1,
          status: 'ENABLED',
        })
        groupMap.set(groupName, group)
      }

      await webUiAutomationApi.createElement(page.workspaceCode, {
        workspaceCode: page.workspaceCode,
        pageId: page.id,
        groupId: group.id,
        pageName: page.pageName,
        groupName: group.groupName,
        elementName: candidate.elementName.trim(),
        locatorType: candidate.locatorType,
        locatorValue: candidate.locatorValue.trim(),
        description: `AI 采集候选，稳定性 ${candidate.confidence}%。${candidate.reason}`,
        status: 'ENABLED',
      })
    }

    ElMessage.success(`已保存 ${aiSelectedCandidates.value.length} 个元素`)
    aiCollectDrawerVisible.value = false
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    aiSaving.value = false
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
      try {
        await ElMessageBox.confirm(
          `该元素已被 ${editingElementSnapshot.value.usageCount} 个用例/模板步骤引用，修改定位器可能影响执行。是否继续？`,
          '元素变更影响提示',
          {
            type: 'warning',
            confirmButtonText: '继续保存',
            cancelButtonText: '取消',
          },
        )
      } catch {
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
    const result = await webUiAutomationApi.batchValidateElements(currentQueryWorkspaceCode.value, {
      elementIds: selectedElements.value.map(item => item.id),
      baseUrl: environment.baseUrl,
      browserType: environment.browserType || 'CHROMIUM',
      headless: environment.headless ?? true,
      timeoutMs: environment.defaultTimeoutMs || 10000,
    })
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

async function batchDeleteElements() {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择元素')
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
    qualityDrawerVisible.value = true
    if (!qualityIssues.value.length) {
      ElMessage.success('当前筛选范围内暂未发现元素质量问题')
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    qualityChecking.value = false
  }
}

function formatQualityLevel(level: WebUiElementQualityIssue['level']) {
  if (level === 'HIGH') {
    return '高风险'
  }
  if (level === 'MEDIUM') {
    return '中风险'
  }
  return '低风险'
}

function getQualityTagType(level: WebUiElementQualityIssue['level']) {
  if (level === 'HIGH') {
    return 'danger'
  }
  if (level === 'MEDIUM') {
    return 'warning'
  }
  return 'info'
}

function focusQualityElement(issue: WebUiElementQualityIssue) {
  keyword.value = issue.elementName
  pageNo.value = 1
  qualityDrawerVisible.value = false
  void loadElements()
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

function formatReferenceSourceType(type: string) {
  if (type === 'TEMPLATE') {
    return '模板'
  }
  return '用例'
}

function formatReferenceStepType(type: string) {
  return formatStepType(type as WebUiStepType)
}

function isReferenceLocatorSynced(item: WebUiElementReferenceItem) {
  if (!referenceTarget.value) {
    return false
  }
  return item.locatorType === referenceTarget.value.locatorType && item.locatorValue === referenceTarget.value.locatorValue
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
          <AppButton :icon="CollectionTag" :loading="qualityChecking" @click="runQualityCheck">质量检查</AppButton>
          <AppButton class="web-ui-filter-toolbar__ai" :icon="Cpu" @click="openAiCollectDrawer">AI 采集</AppButton>
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
          <el-table-column label="操作" width="190" fixed="right">
            <template #default="{ row }">
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

    <el-drawer
      v-model="qualityDrawerVisible"
      title="元素质量检查"
      size="860px"
      class="web-ui-element-quality-drawer"
    >
      <el-scrollbar class="web-ui-element-quality-scrollbar">
        <div class="web-ui-element-quality">
          <div class="web-ui-element-quality__summary">
            <el-tag type="danger" effect="light">高风险 {{ highQualityIssues.length }}</el-tag>
            <el-tag type="warning" effect="light">中风险 {{ mediumQualityIssues.length }}</el-tag>
            <el-tag type="info" effect="light">低风险 {{ lowQualityIssues.length }}</el-tag>
          </div>

          <el-alert
            v-if="!qualityIssues.length"
            type="success"
            show-icon
            :closable="false"
            title="当前筛选范围内暂未发现元素质量问题"
          />

          <el-table
            v-else
            :data="qualityIssues"
            row-key="id"
            border
            empty-text="暂无质量问题"
          >
            <el-table-column label="风险" width="92">
              <template #default="{ row }">
                <el-tag :type="getQualityTagType(row.level)" effect="light">
                  {{ formatQualityLevel(row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="问题" min-width="120" />
            <el-table-column label="元素" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ row.elementName }}</template>
            </el-table-column>
            <el-table-column label="页面 / 分组" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ row.pageName }} / {{ row.groupName || '-' }}</template>
            </el-table-column>
            <el-table-column label="定位器" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                {{ formatLocatorType(row.locatorType) }}：{{ row.locatorValue || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="引用" width="76">
              <template #default="{ row }">{{ row.usageCount }}</template>
            </el-table-column>
            <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="focusQualityElement(row)">定位</el-button>
                <el-button
                  v-if="row.usageCount > 0"
                  link
                  type="primary"
                  @click="openQualityIssueReferences(row)"
                >
                  引用
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-scrollbar>
      <template #footer>
        <div class="web-ui-element-quality__footer">
          <AppButton @click="qualityDrawerVisible = false">关闭</AppButton>
          <AppButton type="primary" :loading="qualityChecking" @click="runQualityCheck">重新检查</AppButton>
        </div>
      </template>
    </el-drawer>

    <el-drawer
      v-model="referenceDrawerVisible"
      title="元素引用"
      size="760px"
      class="web-ui-element-reference-drawer"
    >
      <div class="web-ui-element-reference">
        <el-alert
          v-if="referenceTarget"
          type="info"
          show-icon
          :closable="false"
          :title="`${referenceTarget.elementName}：${formatLocatorType(referenceTarget.locatorType)} = ${referenceTarget.locatorValue}`"
        />

        <el-table
          v-loading="loadingReferences"
          :data="elementReferences"
          row-key="stepId"
          border
          empty-text="暂无引用"
        >
          <el-table-column label="来源" width="86">
            <template #default="{ row }">
              <el-tag :type="row.sourceType === 'TEMPLATE' ? 'warning' : 'success'" effect="light">
                {{ formatReferenceSourceType(row.sourceType) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="sourceName" label="用例/模板" min-width="160" show-overflow-tooltip />
          <el-table-column prop="moduleName" label="模块" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.moduleName || '-' }}</template>
          </el-table-column>
          <el-table-column label="步骤" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.sortOrder }}. {{ row.stepName || formatReferenceStepType(row.stepType) }}
            </template>
          </el-table-column>
          <el-table-column label="类型" width="110">
            <template #default="{ row }">{{ formatReferenceStepType(row.stepType) }}</template>
          </el-table-column>
          <el-table-column label="同步状态" width="104">
            <template #default="{ row }">
              <el-tag :type="isReferenceLocatorSynced(row) ? 'success' : 'warning'" effect="light">
                {{ isReferenceLocatorSynced(row) ? '一致' : '不一致' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="82">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'" effect="light">
                {{ row.enabled ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="元素定位器" min-width="180" show-overflow-tooltip>
            <template #default>
              {{ referenceTarget ? `${formatLocatorType(referenceTarget.locatorType)}：${referenceTarget.locatorValue}` : '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="locatorValue" label="步骤定位值" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.locatorType ? `${formatLocatorType(row.locatorType)}：${row.locatorValue || '-'}` : row.locatorValue || '-' }}
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <div class="web-ui-element-reference__footer">
          <AppButton @click="referenceDrawerVisible = false">关闭</AppButton>
          <AppButton
            type="primary"
            :loading="syncingReferences"
            :disabled="!elementReferences.length"
            @click="syncReferenceLocators"
          >
            同步到引用步骤
          </AppButton>
        </div>
      </template>
    </el-drawer>

    <el-drawer
      v-model="aiCollectDrawerVisible"
      title="AI 采集元素"
      size="860px"
      class="web-ui-ai-collect-drawer"
    >
      <el-scrollbar class="web-ui-ai-collect-scrollbar">
        <div class="web-ui-ai-collect">
          <el-alert
            type="info"
            show-icon
            :closable="false"
            title="第一版先提供采集入口和候选确认流程，在线真实采集和大模型识别后续接入。"
          />

          <el-radio-group v-model="aiCollectMode" class="web-ui-ai-collect__mode">
            <el-radio-button label="ONLINE">在线采集</el-radio-button>
            <el-radio-button label="OFFLINE">离线导入</el-radio-button>
          </el-radio-group>

          <el-form class="web-ui-ai-collect__form" label-width="104px">
            <template v-if="aiCollectMode === 'ONLINE'">
              <el-form-item label="运行环境">
                <el-select v-model="aiCollectForm.environmentId" clearable filterable placeholder="选择登录态/环境">
                  <el-option v-for="item in enabledEnvironments" :key="item.id" :label="item.name" :value="item.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="页面 URL" required>
                <el-input v-model="aiCollectForm.pageUrl" clearable placeholder="https://example.com/orders" />
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item label="HTML / DOM" required>
                <el-input
                  v-model="aiCollectForm.htmlText"
                  type="textarea"
                  :rows="6"
                  maxlength="30000"
                  show-word-limit
                  placeholder="粘贴页面 HTML、DOM 片段，或从浏览器复制出来的关键区域结构"
                />
              </el-form-item>
              <el-form-item label="截图说明">
                <el-input
                  v-model="aiCollectForm.screenshotNote"
                  type="textarea"
                  :rows="3"
                  maxlength="1000"
                  show-word-limit
                  placeholder="可补充截图里哪些区域要采集，例如：登录表单、查询按钮、结果表格"
                />
              </el-form-item>
            </template>

            <el-form-item label="所属模块" required>
              <el-select
                v-model="aiCollectForm.moduleId"
                clearable
                filterable
                placeholder="选择模块"
                @change="handleAiModuleChange"
              >
                <el-option v-for="item in modules" :key="item.id" :label="item.moduleName" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="页面对象" required>
              <div class="web-ui-ai-collect__page-target">
                <el-select
                  v-model="aiCollectForm.pageId"
                  clearable
                  filterable
                  placeholder="选择已有页面对象"
                  @change="handleAiPageChange"
                >
                  <el-option v-for="item in aiCollectPageOptions" :key="item.id" :label="item.pageName" :value="item.id" />
                </el-select>
                <el-input v-model="aiCollectForm.pageName" clearable placeholder="或填写新页面对象名称" />
              </div>
            </el-form-item>
            <el-form-item label="分组策略">
              <el-radio-group v-model="aiCollectForm.groupStrategy">
                <el-radio-button label="AI">AI 建议分组</el-radio-button>
                <el-radio-button label="CUSTOM">自选分组</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="aiCollectForm.groupStrategy === 'CUSTOM'" label="自选分组" required>
              <div class="web-ui-ai-collect__group-target">
                <el-select
                  v-model="aiCollectForm.groupId"
                  clearable
                  filterable
                  placeholder="选择已有分组"
                  :disabled="!aiCollectForm.pageId"
                  @change="handleAiGroupChange"
                >
                  <el-option v-for="item in aiCollectGroupOptions" :key="item.id" :label="item.groupName" :value="item.id" />
                </el-select>
                <el-input v-model="aiCollectForm.groupName" clearable placeholder="或填写新分组名称" />
              </div>
            </el-form-item>
            <el-form-item label="采集范围">
              <el-radio-group v-model="aiCollectForm.scope">
                <el-radio-button label="ALL">全部</el-radio-button>
                <el-radio-button label="FORM">表单</el-radio-button>
                <el-radio-button label="BUTTON">按钮</el-radio-button>
                <el-radio-button label="TABLE">表格</el-radio-button>
                <el-radio-button label="DIALOG">弹窗</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>

          <div class="web-ui-ai-collect__actions">
            <AppButton type="primary" :icon="Cpu" :loading="aiCollecting" @click="generateAiCandidates">
              生成候选元素
            </AppButton>
            <span>已选 {{ aiSelectedCandidates.length }} / {{ aiCandidates.length }}</span>
          </div>

          <el-table
            v-if="aiCandidates.length"
            :data="aiCandidates"
            row-key="id"
            border
            class="web-ui-ai-collect__table"
          >
            <el-table-column label="选择" width="72" align="center">
              <template #default="{ row }">
                <el-checkbox v-model="row.selected" />
              </template>
            </el-table-column>
            <el-table-column label="建议分组" min-width="130">
              <template #default="{ row }">
                <el-input v-model="row.groupName" maxlength="80" />
              </template>
            </el-table-column>
            <el-table-column label="元素名称" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.elementName" maxlength="80" />
              </template>
            </el-table-column>
            <el-table-column label="定位方式" width="130">
              <template #default="{ row }">
                <el-select v-model="row.locatorType">
                  <el-option v-for="item in WEB_UI_LOCATOR_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="推荐定位器" min-width="220">
              <template #default="{ row }">
                <el-input v-model="row.locatorValue" maxlength="1000" />
              </template>
            </el-table-column>
            <el-table-column label="稳定性" width="112">
              <template #default="{ row }">
                <el-progress :percentage="row.confidence" :stroke-width="8" :show-text="false" />
                <small class="web-ui-ai-collect__score">{{ row.confidence }}%</small>
              </template>
            </el-table-column>
            <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
          </el-table>

          <AppEmptyState
            v-else
            title="暂无候选元素"
            description="填写采集信息后点击“生成候选元素”，先确认候选结果，再批量保存到元素库。"
          />
        </div>
      </el-scrollbar>

      <template #footer>
        <div class="web-ui-ai-collect__footer">
          <AppButton @click="aiCollectDrawerVisible = false">关闭</AppButton>
          <AppButton
            type="primary"
            :loading="aiSaving"
            :disabled="!aiSelectedCandidates.length"
            @click="saveAiCandidates"
          >
            批量保存
          </AppButton>
        </div>
      </template>
    </el-drawer>

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
        <img v-if="validateImageSrc" class="web-ui-element-validate__image" :src="validateImageSrc" alt="元素验证截图">
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
  flex-wrap: nowrap;
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
  margin-left: auto;
}

.web-ui-filter-toolbar :deep(.app-button) {
  flex: 0 0 auto;
}

@media (max-width: 900px) {
  .web-ui-filter-toolbar {
    flex-wrap: wrap;
  }

  .web-ui-filter-toolbar__search {
    flex: 1 1 240px;
    width: auto;
  }
}

.web-ui-ai-collect {
  display: grid;
  gap: var(--app-space-4);
  min-width: 0;
  padding-right: var(--app-space-3);
}

.web-ui-element-library :deep(.web-ui-ai-collect-drawer .el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding-top: 0;
}

.web-ui-ai-collect-scrollbar {
  flex: 1;
  min-height: 0;
}

.web-ui-ai-collect__mode {
  justify-self: flex-start;
}

.web-ui-ai-collect__form {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-ai-collect__page-target,
.web-ui-ai-collect__group-target {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--app-space-3);
  width: 100%;
}

.web-ui-ai-collect__actions,
.web-ui-ai-collect__footer,
.web-ui-element-batch-toolbar,
.web-ui-element-quality__summary,
.web-ui-element-quality__footer {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-element-batch-toolbar {
  justify-content: flex-start;
  flex-wrap: wrap;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-ai-collect__actions {
  justify-content: space-between;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-ai-collect__footer,
.web-ui-element-quality__footer {
  justify-content: flex-end;
}

.web-ui-ai-collect__table {
  width: 100%;
}

.web-ui-ai-collect__score {
  display: block;
  margin-top: var(--app-space-1);
  color: var(--app-text-muted);
  text-align: center;
}

.web-ui-ai-collect :deep(.el-select),
.web-ui-ai-collect :deep(.el-input-number) {
  width: 100%;
}

.web-ui-element-reference {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-element-quality {
  display: grid;
  gap: var(--app-space-3);
  min-width: 0;
  padding-right: var(--app-space-3);
}

.web-ui-element-library :deep(.web-ui-element-quality-drawer .el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding-top: 0;
}

.web-ui-element-quality-scrollbar {
  flex: 1;
  min-height: 0;
}

.web-ui-element-quality__summary {
  flex-wrap: wrap;
}

.web-ui-element-reference__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
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

@media (max-width: 700px) {
  .web-ui-ai-collect__page-target,
  .web-ui-ai-collect__group-target {
    grid-template-columns: 1fr;
  }
}
</style>
