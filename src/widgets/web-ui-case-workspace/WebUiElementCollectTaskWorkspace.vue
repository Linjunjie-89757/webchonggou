<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  formatWebUiDateTime,
  webUiAutomationApi,
  type WebUiElementCollectFilterDetail,
  type WebUiElementCollectTaskResponse,
  type WebUiElementGroupItem,
  type WebUiElementItem,
  type WebUiElementModuleItem,
  type WebUiElementPageItem,
  type WebUiLocatorType,
} from '@/entities/web-ui-automation'
import {
  buildCollectCandidateSaveSummary,
  buildCollectCandidateValidationLocators,
  buildCollectCandidateValidationSummary,
  isCollectCandidateSaveable,
  isCollectTaskTerminalStatus,
  shouldShowCollectCandidateForFilter,
  sortCollectCandidatesForReview,
  type WebUiCollectCandidateFilter,
} from '@/entities/web-ui-automation/lib/collectTask'
import {
  validateLocalRunnerLocators,
} from '@/entities/web-ui-automation/lib/localRunnerClient'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import WebUiElementCollectCandidateTable from './WebUiElementCollectCandidateTable.vue'
import WebUiElementCollectFilterDetailsPanel from './WebUiElementCollectFilterDetailsPanel.vue'
import WebUiElementCollectTracePanel from './WebUiElementCollectTracePanel.vue'
import WebUiElementCollectTaskPanel from './WebUiElementCollectTaskPanel.vue'
import {
  mapCollectCandidatesToViews,
  type WebUiElementCollectCandidateView,
} from './elementCollectTypes'

const props = defineProps<{
  workspaceCode: string
  workspaceReady?: boolean
}>()

const route = useRoute()
const router = useRouter()

const task = ref<WebUiElementCollectTaskResponse | null>(null)
const candidates = ref<WebUiElementCollectCandidateView[]>([])
const filterDetails = ref<WebUiElementCollectFilterDetail[]>([])
const savedElements = ref<WebUiElementItem[]>([])
const modules = ref<WebUiElementModuleItem[]>([])
const pages = ref<WebUiElementPageItem[]>([])
const groups = ref<WebUiElementGroupItem[]>([])
const loading = ref(false)
const refreshing = ref(false)
const polling = ref(false)
const filterDetailsLoading = ref(false)
const savedElementsLoading = ref(false)
const localRunnerValidating = ref(false)
const localRunnerValidationProgress = ref({
  done: 0,
  total: 0,
  batchFailed: 0,
})
const saving = ref(false)
const candidateFilter = ref<WebUiCollectCandidateFilter>('ALL')
const autoValidationTaskIds = new Set<number>()
let pollingTimer: ReturnType<typeof window.setTimeout> | null = null

const taskId = computed(() => Number(route.params.taskId || 0))
const queryWorkspaceCode = computed(() => {
  const value = Array.isArray(route.query.workspaceCode) ? route.query.workspaceCode[0] : route.query.workspaceCode
  return value || props.workspaceCode || 'ALL'
})
const moduleId = computed(() => Number(route.query.moduleId || 0) || null)
const pageId = computed(() => Number(route.query.pageId || 0) || null)
const groupStrategy = computed(() => {
  const value = Array.isArray(route.query.groupStrategy) ? route.query.groupStrategy[0] : route.query.groupStrategy
  return value === 'CUSTOM' ? 'CUSTOM' : 'AI'
})
const routePageName = computed(() => {
  const value = Array.isArray(route.query.pageName) ? route.query.pageName[0] : route.query.pageName
  return value || ''
})
const routePageUrl = computed(() => {
  const value = Array.isArray(route.query.pageUrl) ? route.query.pageUrl[0] : route.query.pageUrl
  return value || ''
})
const routeGroupName = computed(() => {
  const value = Array.isArray(route.query.groupName) ? route.query.groupName[0] : route.query.groupName
  return value || ''
})

const visibleCandidates = computed(() =>
  sortCollectCandidatesForReview(
    candidates.value.filter(item => shouldShowCollectCandidateForFilter(item, candidateFilter.value)),
  ),
)
const selectedCandidates = computed(() => candidates.value.filter(item => item.selected))
const candidateSummary = computed(() => buildCollectCandidateValidationSummary(candidates.value))
const selectedModule = computed(() => modules.value.find(item => item.id === moduleId.value) || null)
const selectedPage = computed(() => pageId.value ? pages.value.find(item => item.id === pageId.value) || null : null)
const largePageNotice = computed(() => {
  const count = candidates.value.length || task.value?.finalCount || task.value?.rawCount || 0
  if (count < 80) {
    return null
  }
  return {
    type: 'warning' as const,
    title: `当前页面候选较多：${count} 个`,
    description: '建议优先使用“可保存 / 验证通过 / 低稳定性”等筛选，并按按钮、表单、表格等范围分次采集，避免一次保存过多低价值元素。',
  }
})
const pageContextNotice = computed(() => {
  if (!task.value?.actualUrl || !routePageUrl.value) {
    return null
  }
  const taskUrl = normalizeCollectUrl(task.value.actualUrl)
  const expectedUrl = normalizeCollectUrl(routePageUrl.value)
  if (!taskUrl || !expectedUrl || taskUrl === expectedUrl) {
    return null
  }
  return {
    type: 'warning' as const,
    title: '采集页面和目标地址不一致',
    description: `任务实际页面为 ${task.value.actualUrl}，目标地址为 ${routePageUrl.value}。如果页面跳到了登录页或首页，请重新进入目标业务页后再采集或验证。`,
  }
})
const validationProgressText = computed(() => {
  const progress = localRunnerValidationProgress.value
  if (!localRunnerValidating.value || !progress.total) {
    return ''
  }
  return progress.batchFailed
    ? `验证中 ${progress.done}/${progress.total}，失败批次 ${progress.batchFailed}`
    : `验证中 ${progress.done}/${progress.total}`
})
const localValidationNotice = computed(() => {
  if (localRunnerValidating.value) {
    const progress = localRunnerValidationProgress.value
    const progressText = progress.total
      ? `已验证 ${progress.done} / ${progress.total} 个定位器`
      : `将验证 ${visibleCandidates.value.length || candidates.value.length} 个候选定位器`
    const failedText = progress.batchFailed ? `，${progress.batchFailed} 个批次失败已保留为失败候选` : ''
    return {
      type: 'info' as const,
      title: '正在调用本地 Runner 真机验证',
      description: `${progressText}${failedText}。请保持 Runner 浏览器停留在采集页面。`,
    }
  }
  if (!candidates.value.length) {
    return null
  }
  const validatedCandidates = candidates.value.filter(item => (
    item.validationStatus === 'PASSED'
    || item.validationStatus === 'FAILED'
    || item.validationStatus === 'MULTIPLE'
  ))
  const allNotFound = validatedCandidates.length > 0
    && validatedCandidates.every(item => item.validationStatus === 'FAILED' && Number(item.matchCount || 0) === 0)
  if (allNotFound) {
    return {
      type: 'warning' as const,
      title: '所有定位器都未找到',
      description: '页面上下文可能已经变化，或 Runner 当前页不是采集时的目标页面。请重新打开目标页后再重新验证。',
    }
  }
  if (task.value?.status === 'DEGRADED') {
    return {
      type: 'warning' as const,
      title: '当前任务已降级',
      description: '候选可查看，但没有完整真机验证结果。保存前建议重新连接 Runner 并重新验证。',
    }
  }
  return null
})

const stats = computed(() => [
  { label: '候选总数', value: candidateSummary.value.total, type: 'info' },
  { label: '推荐保存', value: candidateSummary.value.recommended, type: 'primary' },
  { label: '验证通过', value: candidateSummary.value.passed, type: 'success' },
  { label: '验证异常', value: candidateSummary.value.abnormal, type: candidateSummary.value.abnormal ? 'warning' : 'info' },
  { label: '禁止保存', value: candidateSummary.value.blocked, type: candidateSummary.value.blocked ? 'danger' : 'info' },
])

function normalizeCollectUrl(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
  } catch {
    return url.trim().replace(/\/+$/, '')
  }
}

function isWorkspaceReady() {
  return props.workspaceReady !== false
}

function getCustomGroupName() {
  return groupStrategy.value === 'CUSTOM' ? routeGroupName.value.trim() : ''
}

function applyTaskDetail(nextTask: WebUiElementCollectTaskResponse) {
  task.value = nextTask
  candidates.value = mapCollectCandidatesToViews(nextTask.candidates, {
    groupStrategy: groupStrategy.value,
    customGroupName: getCustomGroupName(),
  })
}

async function loadAssets() {
  const [moduleResult, pageResult, groupResult] = await Promise.all([
    webUiAutomationApi.getElementModules(queryWorkspaceCode.value),
    webUiAutomationApi.getElementPages(queryWorkspaceCode.value),
    webUiAutomationApi.getElementGroups(queryWorkspaceCode.value),
  ])
  modules.value = moduleResult.items
  pages.value = pageResult.items
  groups.value = groupResult.items
}

async function loadTask(options: { silent?: boolean } = {}) {
  if (!taskId.value || !isWorkspaceReady()) {
    return
  }
  if (!options.silent) {
    loading.value = true
  } else {
    refreshing.value = true
  }
  try {
    const nextTask = await webUiAutomationApi.getLocalRunnerCollectTask(queryWorkspaceCode.value, taskId.value)
    applyTaskDetail(nextTask)
    await loadFilterDetails(nextTask, true)
    await loadSavedElements(nextTask, true)
    maybeAutoValidateCurrentTask()
  } catch (error) {
    if (!options.silent) {
      ElMessage.error(`采集任务加载失败：${getRequestErrorMessage(error)}`)
    }
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function loadSavedElements(nextTask = task.value, silent = true) {
  if (!nextTask) {
    savedElements.value = []
    return
  }
  savedElementsLoading.value = true
  try {
    const response = await webUiAutomationApi.getElements(queryWorkspaceCode.value, {
      collectTaskId: nextTask.taskId,
      pageNo: 1,
      pageSize: 200,
    })
    savedElements.value = response.items
  } catch (error) {
    savedElements.value = []
    if (!silent) {
      ElMessage.warning(`已入库元素加载失败：${getRequestErrorMessage(error)}`)
    }
  } finally {
    savedElementsLoading.value = false
  }
}

async function loadFilterDetails(nextTask = task.value, silent = true) {
  if (!nextTask) {
    filterDetails.value = []
    return
  }
  filterDetailsLoading.value = true
  try {
    const detailResponse = await webUiAutomationApi.getLocalRunnerCollectTaskFilterDetails(
      queryWorkspaceCode.value,
      nextTask.taskId,
    )
    filterDetails.value = detailResponse.details
  } catch (error) {
    filterDetails.value = []
    if (!silent) {
      ElMessage.warning(`过滤明细加载失败：${getRequestErrorMessage(error)}`)
    }
  } finally {
    filterDetailsLoading.value = false
  }
}

function stopPolling() {
  polling.value = false
  if (pollingTimer) {
    window.clearTimeout(pollingTimer)
    pollingTimer = null
  }
}

function schedulePolling() {
  stopPolling()
  if (!task.value || isCollectTaskTerminalStatus(task.value.status)) {
    return
  }
  polling.value = true
  pollingTimer = window.setTimeout(async () => {
    pollingTimer = null
    await loadTask({ silent: true })
    if (task.value && !isCollectTaskTerminalStatus(task.value.status)) {
      schedulePolling()
    } else {
      stopPolling()
    }
  }, 3000)
}

async function refreshTask() {
  await loadTask({ silent: true })
  ElMessage.success('采集任务已刷新')
  schedulePolling()
}

async function cancelTask() {
  if (!task.value) {
    return
  }
  try {
    await ElMessageBox.confirm(
      '取消后当前采集任务会停止刷新，已生成的候选仍可查看。是否继续？',
      '取消采集任务',
      {
        confirmButtonText: '取消任务',
        cancelButtonText: '继续等待',
        type: 'warning',
      },
    )
    const canceled = await webUiAutomationApi.cancelLocalRunnerCollectTask(
      queryWorkspaceCode.value,
      task.value.taskId,
      { reason: '用户取消采集任务' },
    )
    stopPolling()
    applyTaskDetail(canceled)
    await loadFilterDetails(canceled)
    ElMessage.success('采集任务已取消')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(`取消采集任务失败：${getRequestErrorMessage(error)}`)
    }
  }
}

async function validateCandidates(targetCandidates: Pick<WebUiElementCollectCandidateView, 'locatorType' | 'locatorValue'>[]) {
  if (!task.value) {
    ElMessage.warning('暂无可验证的采集任务')
    return null
  }
  const locators = buildCollectCandidateValidationLocators(targetCandidates)
  if (!locators.length) {
    ElMessage.warning('当前筛选下没有可验证的候选定位器')
    return null
  }

  localRunnerValidating.value = true
  localRunnerValidationProgress.value = {
    done: 0,
    total: locators.length,
    batchFailed: 0,
  }
  try {
    const results = await validateLocalRunnerLocators(locators, {
      onProgress: (progress) => {
        localRunnerValidationProgress.value = progress
      },
    })
    const validatedTask = await webUiAutomationApi.submitLocalRunnerCollectValidationResults(
      queryWorkspaceCode.value,
      task.value.taskId,
      { results },
    )
    applyTaskDetail(validatedTask)
    await loadFilterDetails(validatedTask)
    ElMessage.success(`已重新验证 ${locators.length} 个候选定位器`)
    return validatedTask
  } catch (error) {
    const errorMessage = getRequestErrorMessage(error)
    const timedOut = errorMessage.includes('超时') || errorMessage.includes('timeout')
    const reason = timedOut
      ? 'Runner 真机验证超时，已降级为未验证候选'
      : `Runner 真机验证失败：${errorMessage}`
    try {
      const degradedTask = timedOut
        ? await webUiAutomationApi.timeoutLocalRunnerCollectValidation(queryWorkspaceCode.value, task.value.taskId, { reason })
        : await webUiAutomationApi.degradeLocalRunnerCollectTask(queryWorkspaceCode.value, task.value.taskId, { reason })
      applyTaskDetail(degradedTask)
      await loadFilterDetails(degradedTask)
      ElMessage.warning('采集成功，但本地真机验证失败，当前任务已降级')
      return degradedTask
    } catch (degradeError) {
      ElMessage.error(`重新验证失败：${reason}；降级同步失败：${getRequestErrorMessage(degradeError)}`)
      return null
    }
  } finally {
    localRunnerValidating.value = false
  }
}

function revalidateVisibleCandidates() {
  void validateCandidates(visibleCandidates.value)
}

function maybeAutoValidateCurrentTask() {
  if (!task.value || task.value.status !== 'WAITING_LOCAL_VALIDATION') {
    return
  }
  if (localRunnerValidating.value || autoValidationTaskIds.has(task.value.taskId)) {
    return
  }
  if (!candidates.value.length) {
    return
  }
  autoValidationTaskIds.add(task.value.taskId)
  void validateCandidates(candidates.value)
}

function restoreFilteredDetail(detail: WebUiElementCollectFilterDetail) {
  if (!detail.recoverable) {
    ElMessage.warning('该过滤项不可恢复')
    return
  }
  const locatorValue = detail.candidate.locatorValue?.trim()
  if (!locatorValue) {
    ElMessage.warning('该过滤项没有有效定位器，不能加入待验证列表')
    return
  }
  const exists = candidates.value.some(item =>
    item.locatorType === detail.candidate.locatorType
    && item.locatorValue.trim() === locatorValue,
  )
  if (exists) {
    ElMessage.info('候选列表已存在相同定位器')
    return
  }
  const restored = mapCollectCandidatesToViews([
    {
      ...detail.candidate,
      recommendedToSave: false,
      notRecommendedReason: detail.message || '从过滤明细恢复，需重新验证后再保存',
      validationStatus: 'UNVERIFIED',
      matchCount: null,
      validationMessage: '从过滤明细恢复，等待本地 Runner 重新验证',
      saveBlockedReason: '从过滤明细恢复，需重新验证通过后才能保存',
    },
  ], {
    groupStrategy: groupStrategy.value,
    customGroupName: getCustomGroupName(),
    idPrefix: `restored-${detail.id}-`,
  })
  candidates.value = [...restored, ...candidates.value]
  candidateFilter.value = 'UNVERIFIED'
  ElMessage.success('已恢复到候选列表，请执行重新验证')
}

function selectRecommendedPassedCandidates() {
  let selectedCount = 0
  for (const candidate of candidates.value) {
    const shouldSelect = isCollectCandidateSaveable(candidate)
    candidate.selected = shouldSelect
    if (shouldSelect) {
      selectedCount += 1
    }
  }
  ElMessage.success(`已选择 ${selectedCount} 个推荐可保存候选`)
}

function unselectRiskyCandidates() {
  let unselectedCount = 0
  for (const candidate of candidates.value) {
    const risky = candidate.confidence < 70
      || candidate.validationStatus === 'FAILED'
      || candidate.validationStatus === 'MULTIPLE'
      || Boolean(candidate.saveBlockedReason)
    if (risky && candidate.selected) {
      candidate.selected = false
      unselectedCount += 1
    }
  }
  ElMessage.success(`已取消 ${unselectedCount} 个风险候选`)
}

async function batchUpdateCandidateGroup() {
  if (!selectedCandidates.value.length) {
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
    for (const candidate of selectedCandidates.value) {
      candidate.groupName = groupName
    }
    ElMessage.success(`已将 ${selectedCandidates.value.length} 个候选设置为「${groupName}」`)
  } catch {
    // user cancelled
  }
}

function previewCandidateScreenshot(candidate: WebUiElementCollectCandidateView) {
  if (!candidate.screenshotBase64) {
    ElMessage.warning('该候选没有验证截图')
    return
  }
  window.open(`data:image/png;base64,${candidate.screenshotBase64}`, '_blank', 'noopener,noreferrer')
}

function previewGlobalScreenshot() {
  if (!task.value?.globalScreenshotBase64) {
    ElMessage.warning('当前采集任务没有全局截图证据')
    return
  }
  window.open(`data:image/png;base64,${task.value.globalScreenshotBase64}`, '_blank', 'noopener,noreferrer')
}

function buildCandidateDescription(candidate: WebUiElementCollectCandidateView) {
  const parts = [
    '来源：智能采集',
    `稳定性：${candidate.confidence}%`,
    candidate.reason ? `规则依据：${candidate.reason}` : '',
    candidate.businessMeaning ? `业务含义：${candidate.businessMeaning}` : '',
    candidate.maintenanceSuggestion ? `维护建议：${candidate.maintenanceSuggestion}` : '',
    candidate.stabilityNote ? `稳定性说明：${candidate.stabilityNote}` : '',
    candidate.validationStatus ? `验证结果：${candidate.validationStatus}${candidate.matchCount === null ? '' : `，匹配 ${candidate.matchCount} 个`}` : '',
    candidate.validationMessage ? `验证信息：${candidate.validationMessage}` : '',
    task.value?.taskId ? `采集任务：#${task.value.taskId}` : '',
  ]
  return parts.filter(Boolean).join('；')
}

function isDuplicateCandidate(existingElements: WebUiElementItem[], pageId: number, groupName: string, candidate: WebUiElementCollectCandidateView) {
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

async function loadDuplicateBaseline(workspaceCode: string, pageId: number) {
  const response = await webUiAutomationApi.getElements(workspaceCode, {
    pageId,
    pageNo: 1,
    pageSize: 1000,
  })
  return response.items
}

async function confirmSaveSummary(summary: ReturnType<typeof buildCollectCandidateSaveSummary>) {
  const planItems = [
    `已选择 <strong>${summary.selectedCount}</strong> 个候选`,
    `预计新增 <strong>${summary.createCount}</strong> 个元素`,
    summary.skippedCount ? `将跳过 <strong>${summary.skippedCount}</strong> 个候选` : '',
    summary.duplicateCount ? `其中重复元素 / 重复定位器 <strong>${summary.duplicateCount}</strong> 个` : '',
  ].filter(Boolean)
  const riskItems = [
    summary.blockedCount ? `禁止保存：${summary.blockedCount} 个，将不会入库` : '',
    summary.failedCount ? `验证失败：${summary.failedCount} 个，建议先重新采集或修正定位器` : '',
    summary.multipleCount ? `多匹配：${summary.multipleCount} 个，建议改成唯一定位器` : '',
    summary.unverifiedCount ? `未验证：${summary.unverifiedCount} 个，保存后可能不可用` : '',
    summary.lowConfidenceCount ? `低稳定性：${summary.lowConfidenceCount} 个，后续页面改版时更容易失效` : '',
    summary.aiSupplementCount
      ? `AI 补充：${summary.aiSupplementCount} 个，其中真机验证通过 ${summary.aiSupplementUnlockedCount} 个，未验证 ${summary.aiSupplementUnverifiedCount} 个`
      : '',
  ].filter(Boolean)
  const detailItems = [
    '<h4>保存计划</h4>',
    ...planItems.map(item => `<p>${item}</p>`),
    riskItems.length ? '<h4>质量提醒</h4>' : '',
    ...riskItems.map(item => `<p class="web-ui-ai-save-confirm__risk">${item}</p>`),
  ].filter(Boolean)
  await ElMessageBox.confirm(
    `<div class="web-ui-ai-save-confirm">${detailItems.join('')}</div>`,
    '确认批量保存',
    {
      confirmButtonText: '继续保存',
      cancelButtonText: '取消',
      dangerouslyUseHTMLString: true,
      type: summary.blockedCount || summary.abnormalCount || summary.duplicateCount ? 'warning' : 'info',
    },
  )
}

async function saveSelectedCandidates() {
  if (!selectedCandidates.value.length) {
    ElMessage.warning('请至少选择一个候选元素')
    return
  }
  const moduleItem = selectedModule.value
  if (!moduleItem) {
    ElMessage.warning('当前任务缺少所属模块，请返回元素库重新采集')
    return
  }
  const invalidCandidate = selectedCandidates.value.find(item => (
    !item.groupName.trim()
    || !item.elementName.trim()
    || !item.locatorValue.trim()
  ))
  if (invalidCandidate) {
    ElMessage.warning('请补全已选候选元素的分组、名称和定位器')
    return
  }
  const blockedCandidate = selectedCandidates.value.find(item => !isCollectCandidateSaveable(item))
  if (blockedCandidate) {
    ElMessage.warning(blockedCandidate.saveBlockedReason || '仅推荐且未被阻止的候选元素可以入库')
    return
  }

  saving.value = true
  try {
    let page = selectedPage.value
    if (!page) {
      const pageName = routePageName.value.trim() || task.value?.pageTitle || '智能采集页面'
      page = await webUiAutomationApi.createElementPage(moduleItem.workspaceCode, {
        workspaceCode: moduleItem.workspaceCode,
        moduleId: moduleItem.id,
        moduleName: moduleItem.moduleName,
        pageName,
        pagePath: routePageUrl.value || task.value?.actualUrl || null,
        description: '智能采集创建',
        sortOrder: pages.value.filter(item => item.moduleId === moduleItem.id).length + 1,
        status: 'ENABLED',
      })
      pages.value.push(page)
    }

    const groupMap = new Map<string, WebUiElementGroupItem>()
    for (const group of groups.value.filter(item => item.pageId === page.id)) {
      groupMap.set(group.groupName, group)
    }

    const existingElements = await loadDuplicateBaseline(page.workspaceCode, page.id)
    const saveSummary = buildCollectCandidateSaveSummary(selectedCandidates.value, existingElements)
    await confirmSaveSummary(saveSummary)

    let savedCount = 0
    let skippedCount = 0
    for (const candidate of selectedCandidates.value) {
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

      if (isDuplicateCandidate(existingElements, page.id, group.groupName, candidate)) {
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
        locatorType: candidate.locatorType as WebUiLocatorType,
        locatorValue: candidate.locatorValue.trim(),
        description: buildCandidateDescription(candidate),
        status: 'ENABLED',
        collectTaskId: task.value?.taskId || null,
        collectSource: candidate.candidateSource || 'RULE',
        collectConfidence: candidate.confidence,
        collectValidationStatus: candidate.validationStatus || null,
        collectMatchCount: candidate.matchCount,
        collectValidationMessage: candidate.validationMessage || null,
        collectScreenshotBase64: candidate.screenshotBase64 || null,
      })
      existingElements.push(createdElement)
      savedCount += 1
    }

    const traceText = task.value?.taskId ? `，已关联采集任务 #${task.value.taskId}` : ''
    if (!savedCount && skippedCount) {
      ElMessage.warning(`已跳过 ${skippedCount} 个重复候选，未新增元素`)
    } else if (skippedCount) {
      ElMessage.warning(`已保存 ${savedCount} 个元素，跳过 ${skippedCount} 个重复候选${traceText}`)
    } else {
      ElMessage.success(`已保存 ${savedCount} 个元素${traceText}`)
    }

    await router.push({
      path: '/automation/web/elements',
      query: {
        workspace: page.workspaceCode,
        pageId: String(page.id),
      },
    })
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    saving.value = false
  }
}

function goBackToElements() {
  void router.push('/automation/web/elements')
}

function openSavedElement(element: WebUiElementItem) {
  void router.push({
    path: '/automation/web/elements',
    query: {
      workspace: element.workspaceCode,
      elementId: String(element.id),
      pageId: element.pageId ? String(element.pageId) : undefined,
      keyword: element.elementName,
    },
  })
}

onMounted(async () => {
  if (!isWorkspaceReady()) {
    return
  }
  loading.value = true
  try {
    await loadAssets()
    await loadTask()
    schedulePolling()
  } finally {
    loading.value = false
  }
})

watch(
  () => [props.workspaceReady, props.workspaceCode, route.params.taskId] as const,
  () => {
    if (!isWorkspaceReady()) {
      return
    }
    void (async () => {
      await loadAssets()
      await loadTask()
      schedulePolling()
    })()
  },
)

watch(
  () => task.value?.status,
  (status) => {
    if (isCollectTaskTerminalStatus(status)) {
      stopPolling()
      return
    }
    maybeAutoValidateCurrentTask()
  },
)

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <section class="web-ui-collect-workspace">
    <header class="web-ui-collect-workspace__header">
      <div class="web-ui-collect-workspace__title">
        <AppButton :icon="ArrowLeft" @click="goBackToElements">返回元素库</AppButton>
        <div>
          <h2>AI 采集工作台</h2>
          <p>
            <span v-if="task">任务 #{{ task.taskId }}</span>
            <span v-if="task?.pageTitle"> / {{ task.pageTitle }}</span>
            <span v-if="task?.createdAt"> / {{ formatWebUiDateTime(task.createdAt) }}</span>
          </p>
        </div>
      </div>
      <div class="web-ui-collect-workspace__actions">
        <AppButton :icon="RefreshRight" :loading="refreshing" @click="refreshTask">刷新</AppButton>
        <AppButton
          type="primary"
          :loading="saving"
          :disabled="!selectedCandidates.length"
          @click="saveSelectedCandidates"
        >
          保存已选元素
        </AppButton>
      </div>
    </header>

    <AppLoadingState v-if="loading && !task" text="正在加载采集任务..." />
    <AppEmptyState
      v-else-if="!task"
      title="采集任务不存在"
      description="请从元素库重新创建 AI 采集任务。"
    />
    <template v-else>
      <WebUiElementCollectTaskPanel
        :task="task"
        :refreshing="refreshing"
        :polling="polling"
        @refresh="refreshTask"
        @cancel="cancelTask"
      />

      <div class="web-ui-collect-workspace__stats">
        <el-tag
          v-for="item in stats"
          :key="item.label"
          :type="item.type"
          effect="light"
        >
          {{ item.label }} {{ item.value }}
        </el-tag>
      </div>

      <el-alert
        v-if="pageContextNotice"
        class="web-ui-collect-workspace__notice"
        :type="pageContextNotice.type"
        :title="pageContextNotice.title"
        :description="pageContextNotice.description"
        show-icon
        :closable="false"
      />

      <el-alert
        v-if="largePageNotice"
        class="web-ui-collect-workspace__notice"
        :type="largePageNotice.type"
        :title="largePageNotice.title"
        :description="largePageNotice.description"
        show-icon
        :closable="false"
      />

      <el-alert
        v-if="localValidationNotice"
        class="web-ui-collect-workspace__notice"
        :type="localValidationNotice.type"
        :title="localValidationNotice.title"
        :description="localValidationNotice.description"
        show-icon
        :closable="false"
      />

      <div class="web-ui-collect-workspace__toolbar">
        <div class="web-ui-collect-workspace__batch">
          <AppButton size="small" @click="selectRecommendedPassedCandidates">选择推荐且通过</AppButton>
          <AppButton size="small" @click="unselectRiskyCandidates">取消风险候选</AppButton>
          <AppButton size="small" @click="batchUpdateCandidateGroup">批量改分组</AppButton>
          <AppButton
            size="small"
            :loading="localRunnerValidating"
            @click="revalidateVisibleCandidates"
          >
            重新验证当前筛选
          </AppButton>
          <span v-if="validationProgressText" class="web-ui-collect-workspace__progress">
            {{ validationProgressText }}
          </span>
        </div>
        <div class="web-ui-collect-workspace__filters">
          <AppButton size="small" :type="candidateFilter === 'ALL' ? 'primary' : 'default'" @click="candidateFilter = 'ALL'">全部</AppButton>
          <AppButton size="small" :type="candidateFilter === 'RECOMMENDED' ? 'primary' : 'default'" @click="candidateFilter = 'RECOMMENDED'">可保存</AppButton>
          <AppButton size="small" :type="candidateFilter === 'PASSED' ? 'primary' : 'default'" @click="candidateFilter = 'PASSED'">验证通过</AppButton>
          <AppButton size="small" :type="candidateFilter === 'FAILED' ? 'primary' : 'default'" @click="candidateFilter = 'FAILED'">验证失败</AppButton>
          <AppButton size="small" :type="candidateFilter === 'MULTIPLE' ? 'primary' : 'default'" @click="candidateFilter = 'MULTIPLE'">多匹配</AppButton>
          <AppButton size="small" :type="candidateFilter === 'UNVERIFIED' ? 'primary' : 'default'" @click="candidateFilter = 'UNVERIFIED'">未验证</AppButton>
          <AppButton size="small" :type="candidateFilter === 'BLOCKED' ? 'primary' : 'default'" @click="candidateFilter = 'BLOCKED'">禁止保存</AppButton>
          <AppButton size="small" :type="candidateFilter === 'AI_SUPPLEMENT' ? 'primary' : 'default'" @click="candidateFilter = 'AI_SUPPLEMENT'">AI 补充</AppButton>
          <AppButton size="small" :type="candidateFilter === 'AI_UNVERIFIED' ? 'primary' : 'default'" @click="candidateFilter = 'AI_UNVERIFIED'">AI 待验证</AppButton>
          <AppButton size="small" :type="candidateFilter === 'LOW_CONFIDENCE' ? 'primary' : 'default'" @click="candidateFilter = 'LOW_CONFIDENCE'">低稳定性</AppButton>
          <span>已选 {{ selectedCandidates.length }} / {{ candidates.length }}</span>
        </div>
      </div>

      <el-tabs class="web-ui-collect-workspace__tabs">
        <el-tab-pane label="有效候选">
          <WebUiElementCollectCandidateTable
            :candidates="visibleCandidates"
            @preview-screenshot="previewCandidateScreenshot"
          />
        </el-tab-pane>
        <el-tab-pane label="过滤明细">
          <WebUiElementCollectFilterDetailsPanel
            :details="filterDetails"
            :loading="filterDetailsLoading"
            @restore="restoreFilteredDetail"
          />
        </el-tab-pane>
        <el-tab-pane label="任务信息">
          <WebUiElementCollectTracePanel
            :task="task"
            :module-item="selectedModule"
            :page-item="selectedPage"
            :route-page-name="routePageName"
            :route-page-url="routePageUrl"
            :group-strategy="groupStrategy"
            :route-group-name="routeGroupName"
            :saved-elements="savedElements"
            :saved-elements-loading="savedElementsLoading"
            @preview-global-screenshot="previewGlobalScreenshot"
            @open-element="openSavedElement"
          />
        </el-tab-pane>
      </el-tabs>
    </template>
  </section>
</template>

<style scoped>
.web-ui-collect-workspace {
  display: grid;
  gap: var(--app-space-4);
  min-width: 0;
}

.web-ui-collect-workspace__header,
.web-ui-collect-workspace__title,
.web-ui-collect-workspace__actions,
.web-ui-collect-workspace__stats,
.web-ui-collect-workspace__batch,
.web-ui-collect-workspace__filters {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  flex-wrap: wrap;
}

.web-ui-collect-workspace__header {
  justify-content: space-between;
}

.web-ui-collect-workspace__title h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
}

.web-ui-collect-workspace__title p,
.web-ui-collect-workspace__filters span,
.web-ui-collect-workspace__progress {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-workspace__progress {
  margin: 0;
}

.web-ui-collect-workspace__toolbar {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-collect-workspace__tabs {
  min-width: 0;
}

.web-ui-collect-workspace__meta {
  display: grid;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-soft);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

:global(.web-ui-ai-save-confirm) {
  display: grid;
  gap: var(--app-space-2);
}

:global(.web-ui-ai-save-confirm h4) {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

:global(.web-ui-ai-save-confirm p) {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: 1.6;
}

:global(.web-ui-ai-save-confirm__risk) {
  color: var(--el-color-warning-dark-2);
}
</style>
