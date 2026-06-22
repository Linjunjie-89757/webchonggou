import type {
  WebUiElementCollectCandidate,
  WebUiElementCollectTaskResponse,
} from '../model/types'

export type WebUiCollectTaskStageKey =
  | 'UPLOAD_SNAPSHOT'
  | 'RULE_CLEAN'
  | 'AI_ANALYZE'
  | 'LOCAL_VALIDATE'
  | 'FAILED'
  | 'FINALIZE'

export type WebUiCollectTaskStageStatus = 'pending' | 'running' | 'done' | 'failed' | 'degraded'

export interface WebUiCollectTaskStage {
  key: WebUiCollectTaskStageKey
  title: string
  status: WebUiCollectTaskStageStatus
  description: string
}

export function normalizeElementCollectCandidate(item: WebUiElementCollectCandidate): WebUiElementCollectCandidate {
  return {
    ...item,
    groupName: item.groupName || '页面元素',
    elementName: item.elementName || '未命名元素',
    locatorType: item.locatorType || 'CSS',
    locatorValue: item.locatorValue || '',
    confidence: Number(item.confidence || 0),
    reason: item.reason || '',
    tagName: item.tagName || null,
    elementType: item.elementType || null,
    text: item.text || null,
    placeholder: item.placeholder || null,
    ariaLabel: item.ariaLabel || null,
    labelText: item.labelText || null,
    nearbyHeading: item.nearbyHeading || null,
    businessMeaning: item.businessMeaning || null,
    candidateSource: item.candidateSource || 'RULE',
    recommendedToSave: item.recommendedToSave !== false,
    notRecommendedReason: item.notRecommendedReason || null,
    maintenanceSuggestion: item.maintenanceSuggestion || null,
    stabilityNote: item.stabilityNote || null,
    validationStatus: item.validationStatus || 'SKIPPED',
    matchCount: item.matchCount === null || item.matchCount === undefined ? null : Number(item.matchCount),
    validationMessage: item.validationMessage || null,
    screenshotBase64: item.screenshotBase64 || null,
    saveBlockedReason: item.saveBlockedReason || null,
  }
}

export function normalizeElementCollectTaskResponse(item: WebUiElementCollectTaskResponse): WebUiElementCollectTaskResponse {
  const filterSummary = item.filterSummary
    ? {
        originalCount: Number(item.filterSummary.originalCount || 0),
        emptyLocatorCount: Number(item.filterSummary.emptyLocatorCount || 0),
        duplicateCount: Number(item.filterSummary.duplicateCount || 0),
        lowStabilityCount: Number(item.filterSummary.lowStabilityCount || 0),
        finalCount: Number(item.filterSummary.finalCount || 0),
      }
    : null
  return {
    taskId: Number(item.taskId),
    status: item.status || 'COMPLETED',
    currentStage: item.currentStage || deriveCollectCurrentStage(item.status),
    progressPercent: Number(item.progressPercent ?? deriveCollectProgressPercent(item.status)),
    source: item.source || 'LOCAL_RUNNER_STATIC',
    actualUrl: item.actualUrl || null,
    pageTitle: item.pageTitle || null,
    rawCount: Number(item.rawCount || 0),
    finalCount: Number(item.finalCount || 0),
    filterSummary,
    filterLogs: Array.isArray(item.filterLogs)
      ? item.filterLogs.map(log => ({
          stage: log.stage || 'STATIC_RULE',
          reason: log.reason || 'UNKNOWN',
          count: Number(log.count || 0),
          message: log.message || null,
        }))
      : [],
    candidates: Array.isArray(item.candidates) ? item.candidates.map(normalizeElementCollectCandidate) : [],
    message: item.message || null,
    createdAt: item.createdAt || null,
    completedAt: item.completedAt || null,
  }
}

export function buildCollectTaskStages(task: WebUiElementCollectTaskResponse | null): WebUiCollectTaskStage[] {
  const status = task?.status || 'PENDING'
  const failed = status === 'FAILED'
  const degraded = status === 'DEGRADED'
  const currentStage = task?.currentStage || deriveCollectCurrentStage(status)
  const stageOrder: WebUiCollectTaskStageKey[] = ['UPLOAD_SNAPSHOT', 'RULE_CLEAN', 'AI_ANALYZE', 'LOCAL_VALIDATE', 'FINALIZE']
  const currentIndex = stageOrder.indexOf(currentStage as WebUiCollectTaskStageKey)
  const resolveStageStatus = (key: WebUiCollectTaskStageKey): WebUiCollectTaskStageStatus => {
    if (failed) {
      return key === currentStage ? 'failed' : 'pending'
    }
    if (degraded && key === 'LOCAL_VALIDATE') {
      return 'degraded'
    }
    if (status === 'COMPLETED' || (degraded && key === 'FINALIZE')) {
      return key === 'AI_ANALYZE' || key === 'LOCAL_VALIDATE' ? 'pending' : 'done'
    }
    const index = stageOrder.indexOf(key)
    if (currentIndex >= 0 && index >= 0) {
      if (index < currentIndex) return 'done'
      if (index === currentIndex) return 'running'
    }
    return 'pending'
  }
  return [
    {
      key: 'UPLOAD_SNAPSHOT',
      title: '上传快照',
      status: resolveStageStatus('UPLOAD_SNAPSHOT'),
      description: task?.actualUrl || '等待本地 Runner 上传页面素材',
    },
    {
      key: 'RULE_CLEAN',
      title: '规则清洗',
      status: resolveStageStatus('RULE_CLEAN'),
      description: task?.filterSummary
        ? `原始 ${task.filterSummary.originalCount}，保留 ${task.filterSummary.finalCount}`
        : '等待后端规则过滤、去重和评分',
    },
    {
      key: 'AI_ANALYZE',
      title: 'AI 分析',
      status: resolveStageStatus('AI_ANALYZE'),
      description: '后续接入 AI 命名、分组、解释和补充候选',
    },
    {
      key: 'LOCAL_VALIDATE',
      title: '真机验证',
      status: resolveStageStatus('LOCAL_VALIDATE'),
      description: degraded
        ? task?.message || '本地 Runner 不可用，已降级为未验证候选'
        : '后续接入 Runner 本地真机验证',
    },
    {
      key: 'FINALIZE',
      title: '生成候选',
      status: resolveStageStatus('FINALIZE'),
      description: task?.finalCount === undefined ? '等待候选生成' : `最终候选 ${task.finalCount}`,
    },
  ]
}

export function isCollectTaskTerminalStatus(status?: string | null) {
  return status === 'COMPLETED'
    || status === 'FAILED'
    || status === 'DEGRADED'
    || status === 'CANCELED'
}

function deriveCollectCurrentStage(status?: string | null) {
  if (status === 'FAILED') return 'FAILED'
  if (status === 'DEGRADED') return 'LOCAL_VALIDATE'
  if (status === 'PROCESSING') return 'RULE_CLEAN'
  if (status === 'PENDING') return 'UPLOAD_SNAPSHOT'
  return 'FINALIZE'
}

function deriveCollectProgressPercent(status?: string | null) {
  if (status === 'FAILED') return 100
  if (status === 'DEGRADED') return 80
  if (status === 'PROCESSING') return 40
  if (status === 'PENDING') return 10
  return 100
}
