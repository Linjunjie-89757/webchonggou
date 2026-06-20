import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'
import { env } from '@/shared/config/env'

import type {
  PageResponse,
  SaveWebUiCasePayload,
  SaveWebUiCaseTemplatePayload,
  SaveWebUiCiTokenPayload,
  SaveWebUiEnvironmentPayload,
  SaveWebUiReportSharePayload,
  SaveWebUiTemplateFromCasePayload,
  ValidateWebUiLocatorPayload,
  ValidateWebUiLocatorResponse,
  WebUiBatchRunRequest,
  WebUiBatchRunResponse,
  WebUiCaseDetail,
  WebUiCaseItem,
  WebUiCaseListQuery,
  WebUiCaseStepItem,
  WebUiCaseTemplateDetail,
  WebUiCaseTemplateItem,
  WebUiCaseTemplateListQuery,
  WebUiCiTokenCreated,
  WebUiCiTokenSummary,
  WebUiEnvironmentItem,
  WebUiRunBatchDetail,
  WebUiRunBatchListQuery,
  WebUiRunBatchSummary,
  WebUiRunDetail,
  WebUiRunListQuery,
  WebUiRunRequest,
  WebUiRunResponse,
  WebUiRunStepResult,
  WebUiRunSummary,
  WebUiReportShareCreated,
  WebUiReportShareSummary,
  WebUiSharedReport,
} from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '请求失败')
  }

  return payload.data
}

function cleanQuery(query?: object) {
  if (!query) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function normalizePageResponse<T>(page: PageResponse<T>, normalizeItem: (item: T) => T): PageResponse<T> {
  const items = Array.isArray(page.items) ? page.items.map(normalizeItem) : []
  const total = Number(page.total ?? items.length)
  const pageSize = Number(page.pageSize || total || items.length || 10)

  return {
    items,
    total,
    pageNo: Number(page.pageNo || 1),
    pageSize,
    totalPages: Number(page.totalPages || (total > 0 ? Math.ceil(total / Math.max(pageSize, 1)) : 0)),
  }
}

function normalizeApiAssetUrl(url: string | null | undefined) {
  if (!url || /^https?:\/\//i.test(url)) {
    return url || null
  }

  if (url.startsWith('/api/')) {
    return `${env.apiBaseUrl.replace(/\/api\/?$/, '')}${url}`
  }

  if (url.startsWith('/')) {
    return `${env.apiBaseUrl.replace(/\/$/, '')}${url}`
  }

  return url
}

function normalizeStep(item: WebUiCaseStepItem): WebUiCaseStepItem {
  const raw = item as WebUiCaseStepItem & {
    stepName?: string | null
    stepType?: WebUiCaseStepItem['type'] | null
  }
  return {
    ...item,
    id: item.id ?? null,
    name: item.name || raw.stepName || null,
    type: item.type || raw.stepType || 'OPEN',
    locatorType: item.locatorType || null,
    locatorValue: item.locatorValue || null,
    inputValue: item.inputValue || null,
    timeoutMs: item.timeoutMs ?? null,
    continueOnFailure: Boolean(item.continueOnFailure),
    screenshotPolicy: item.screenshotPolicy || 'NONE',
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder || 0),
  }
}

function normalizeCase(item: WebUiCaseItem): WebUiCaseItem {
  const raw = item as WebUiCaseItem & { caseName?: string | null; steps?: unknown[] }
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    name: item.name || raw.caseName || '-',
    moduleName: item.moduleName || null,
    status: item.status || 'ENABLED',
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    defaultTimeoutMs: Number(item.defaultTimeoutMs || 10000),
    baseUrl: item.baseUrl || null,
    description: item.description || null,
    stepCount: Number(item.stepCount || raw.steps?.length || 0),
    lastRunResult: item.lastRunResult || null,
    lastRunAt: item.lastRunAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeCaseDetail(item: WebUiCaseDetail): WebUiCaseDetail {
  return {
    ...normalizeCase(item),
    steps: Array.isArray(item.steps) ? item.steps.map(normalizeStep) : [],
    createdAt: item.createdAt || null,
  }
}

function normalizeTemplate(item: WebUiCaseTemplateItem): WebUiCaseTemplateItem {
  const raw = item as WebUiCaseTemplateItem & { templateName?: string | null; steps?: unknown[] }
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    name: item.name || raw.templateName || '-',
    moduleName: item.moduleName || null,
    status: item.status || 'ENABLED',
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    defaultTimeoutMs: Number(item.defaultTimeoutMs || 10000),
    baseUrl: item.baseUrl || null,
    description: item.description || null,
    stepCount: Number(item.stepCount || raw.steps?.length || 0),
    updatedAt: item.updatedAt || null,
  }
}

function normalizeTemplateDetail(item: WebUiCaseTemplateDetail): WebUiCaseTemplateDetail {
  return {
    ...normalizeTemplate(item),
    steps: Array.isArray(item.steps) ? item.steps.map(step => ({
      ...normalizeStep(step),
      templateId: step.templateId === null || step.templateId === undefined ? null : Number(step.templateId),
    })) : [],
    createdAt: item.createdAt || null,
  }
}

function normalizeEnvironmentStatus(value: number | null | undefined): number {
  if (value === 0 || value === 1) {
    return value
  }

  return value ?? 1
}

function normalizeEnvironment(item: WebUiEnvironmentItem): WebUiEnvironmentItem {
  const raw = item as WebUiEnvironmentItem & { environmentName?: string | null }
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    name: item.name || raw.environmentName || '-',
    baseUrl: item.baseUrl || '',
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    defaultTimeoutMs: Number(item.defaultTimeoutMs || 10000),
    status: normalizeEnvironmentStatus(item.status),
    source: item.source || 'WEB_UI',
    defaultVariableSetId: item.defaultVariableSetId === null || item.defaultVariableSetId === undefined
      ? null
      : Number(item.defaultVariableSetId),
    defaultVariableSetName: item.defaultVariableSetName || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeRunStep(item: WebUiRunStepResult): WebUiRunStepResult {
  return {
    ...item,
    id: Number(item.id),
    caseStepId: item.caseStepId === null || item.caseStepId === undefined ? null : Number(item.caseStepId),
    stepName: item.stepName || '-',
    stepType: item.stepType || 'OPEN',
    status: item.status || 'PENDING',
    locatorType: item.locatorType || null,
    locatorValue: item.locatorValue || null,
    inputValueSnapshot: item.inputValueSnapshot || null,
    durationMs: item.durationMs === null || item.durationMs === undefined ? null : Number(item.durationMs),
    errorMessage: item.errorMessage || null,
    screenshotArtifactId: item.screenshotArtifactId === null || item.screenshotArtifactId === undefined
      ? null
      : Number(item.screenshotArtifactId),
    screenshotUrl: normalizeApiAssetUrl(item.screenshotUrl),
    sortOrder: Number(item.sortOrder || 0),
    startedAt: item.startedAt || null,
    finishedAt: item.finishedAt || null,
  }
}

function normalizeRunSummary(item: WebUiRunSummary): WebUiRunSummary {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    batchId: item.batchId === null || item.batchId === undefined ? null : Number(item.batchId),
    batchSortOrder: item.batchSortOrder === null || item.batchSortOrder === undefined ? null : Number(item.batchSortOrder),
    caseId: item.caseId === null || item.caseId === undefined ? null : Number(item.caseId),
    caseName: item.caseName || '-',
    environmentId: item.environmentId === null || item.environmentId === undefined ? null : Number(item.environmentId),
    environmentName: item.environmentName || null,
    status: item.status || 'RUNNING',
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    baseUrl: item.baseUrl || null,
    durationMs: item.durationMs === null || item.durationMs === undefined ? null : Number(item.durationMs),
    failureSummary: item.failureSummary || null,
    totalSteps: Number(item.totalSteps || 0),
    passedSteps: Number(item.passedSteps || 0),
    failedSteps: Number(item.failedSteps || 0),
    skippedSteps: Number(item.skippedSteps || 0),
    operatorName: item.operatorName || null,
    startedAt: item.startedAt || null,
    finishedAt: item.finishedAt || null,
    createdAt: item.createdAt || null,
  }
}

function normalizeRunDetail(item: WebUiRunDetail): WebUiRunDetail {
  return {
    summary: normalizeRunSummary(item.summary),
    context: item.context
      ? {
          environment: item.context.environment
            ? {
                id: item.context.environment.id === null || item.context.environment.id === undefined
                  ? null
                  : Number(item.context.environment.id),
                name: item.context.environment.name || null,
                baseUrl: item.context.environment.baseUrl || null,
                browserType: item.context.environment.browserType || null,
                headless: item.context.environment.headless === null || item.context.environment.headless === undefined
                  ? null
                  : Boolean(item.context.environment.headless),
                defaultTimeoutMs: item.context.environment.defaultTimeoutMs === null || item.context.environment.defaultTimeoutMs === undefined
                  ? null
                  : Number(item.context.environment.defaultTimeoutMs),
              }
            : null,
          variableSetId: item.context.variableSetId === null || item.context.variableSetId === undefined
            ? null
            : Number(item.context.variableSetId),
          variableSetName: item.context.variableSetName || null,
          variables: item.context.variables || {},
        }
      : null,
    steps: Array.isArray(item.steps) ? item.steps.map(normalizeRunStep) : [],
  }
}

function normalizeRunResponse(item: WebUiRunResponse): WebUiRunResponse {
  return {
    ...item,
    runId: Number(item.runId),
    batchId: item.batchId === null || item.batchId === undefined ? null : Number(item.batchId),
    caseId: item.caseId === null || item.caseId === undefined ? null : Number(item.caseId),
    caseName: item.caseName || '-',
    status: item.status || 'RUNNING',
    durationMs: item.durationMs === null || item.durationMs === undefined ? null : Number(item.durationMs),
    failureSummary: item.failureSummary || null,
    totalSteps: Number(item.totalSteps || 0),
    passedSteps: Number(item.passedSteps || 0),
    failedSteps: Number(item.failedSteps || 0),
    skippedSteps: Number(item.skippedSteps || 0),
    stepResults: Array.isArray(item.stepResults) ? item.stepResults.map(normalizeRunStep) : [],
  }
}

function normalizeBatchSummary(item: WebUiRunBatchSummary): WebUiRunBatchSummary {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    batchName: item.batchName || '-',
    source: item.source || 'MANUAL',
    environmentId: item.environmentId === null || item.environmentId === undefined ? null : Number(item.environmentId),
    environmentName: item.environmentName || null,
    status: item.status || 'RUNNING',
    totalCases: Number(item.totalCases || 0),
    successCases: Number(item.successCases || 0),
    failedCases: Number(item.failedCases || 0),
    durationMs: item.durationMs === null || item.durationMs === undefined ? null : Number(item.durationMs),
    failureSummary: item.failureSummary || null,
    operatorName: item.operatorName || null,
    ciTokenId: item.ciTokenId === null || item.ciTokenId === undefined ? null : Number(item.ciTokenId),
    externalBuildId: item.externalBuildId || null,
    startedAt: item.startedAt || null,
    finishedAt: item.finishedAt || null,
    createdAt: item.createdAt || null,
  }
}

function normalizeBatchDetail(item: WebUiRunBatchDetail): WebUiRunBatchDetail {
  return {
    summary: normalizeBatchSummary(item.summary),
    runs: Array.isArray(item.runs) ? item.runs.map(normalizeRunSummary) : [],
  }
}

function normalizeBatchRunResponse(item: WebUiBatchRunResponse): WebUiBatchRunResponse {
  return {
    ...item,
    batchId: Number(item.batchId),
    batchName: item.batchName || '-',
    status: item.status || 'RUNNING',
    passed: item.passed === undefined ? item.status === 'SUCCESS' : Boolean(item.passed),
    totalCases: Number(item.totalCases || 0),
    successCases: Number(item.successCases || 0),
    failedCases: Number(item.failedCases || 0),
    durationMs: item.durationMs === null || item.durationMs === undefined ? null : Number(item.durationMs),
    failureSummary: item.failureSummary || null,
    externalBuildId: item.externalBuildId || null,
    reportUrl: item.reportUrl || null,
    summaryText: item.summaryText || null,
    failedRuns: Array.isArray(item.failedRuns)
      ? item.failedRuns.map(run => ({
          runId: Number(run.runId),
          caseId: run.caseId === null || run.caseId === undefined ? null : Number(run.caseId),
          caseName: run.caseName || '-',
          status: run.status || 'FAILED',
          failureSummary: run.failureSummary || null,
          reportUrl: run.reportUrl || null,
        }))
      : [],
    runs: Array.isArray(item.runs) ? item.runs.map(normalizeRunSummary) : [],
  }
}

function normalizeCiToken(item: WebUiCiTokenSummary): WebUiCiTokenSummary {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    tokenName: item.tokenName || '-',
    status: item.status === 0 ? 0 : 1,
    createdBy: item.createdBy || null,
    lastUsedAt: item.lastUsedAt || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeCreatedCiToken(item: WebUiCiTokenCreated): WebUiCiTokenCreated {
  return {
    ...normalizeCiToken(item),
    token: item.token || '',
  }
}

function normalizeReportShare(item: WebUiReportShareSummary): WebUiReportShareSummary {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    shareType: item.shareType || 'RUN',
    targetId: Number(item.targetId),
    status: item.status === 0 ? 0 : 1,
    expiresAt: item.expiresAt || null,
    createdBy: item.createdBy || null,
    lastAccessedAt: item.lastAccessedAt || null,
    accessCount: Number(item.accessCount || 0),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeCreatedReportShare(item: WebUiReportShareCreated): WebUiReportShareCreated {
  return {
    ...normalizeReportShare(item),
    token: item.token || '',
    shareUrl: item.shareUrl || '',
  }
}

function normalizeSharedReport(item: WebUiSharedReport): WebUiSharedReport {
  return {
    shareType: item.shareType || 'RUN',
    run: item.run ? normalizeRunDetail(item.run) : null,
    batch: item.batch ? normalizeBatchDetail(item.batch) : null,
    expiresAt: item.expiresAt || null,
    generatedAt: item.generatedAt || null,
  }
}

function toBackendCasePayload(data: SaveWebUiCasePayload) {
  return {
    ...data,
    caseName: data.name,
    steps: data.steps.map(step => ({
      ...step,
      stepName: step.name,
      stepType: step.type,
    })),
  }
}

function toBackendTemplatePayload(data: SaveWebUiCaseTemplatePayload) {
  return {
    ...data,
    templateName: data.name,
    steps: data.steps.map(step => ({
      ...step,
      stepName: step.name,
      stepType: step.type,
    })),
  }
}

function toBackendEnvironmentPayload(data: SaveWebUiEnvironmentPayload) {
  return {
    ...data,
    environmentName: data.name,
  }
}

export const webUiAutomationApi = {
  async getCases(workspaceCode = 'ALL', query?: WebUiCaseListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiCaseItem>>>('/automation/web/cases', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeCase)
  },

  async getCaseDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<WebUiCaseDetail>>(`/automation/web/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async createCase(workspaceCode = 'ALL', data: SaveWebUiCasePayload) {
    const payload = await httpPost<ApiResponse<WebUiCaseDetail>, ReturnType<typeof toBackendCasePayload>>(
      '/automation/web/cases',
      toBackendCasePayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async updateCase(workspaceCode = 'ALL', id: number, data: SaveWebUiCasePayload) {
    const payload = await httpPut<ApiResponse<WebUiCaseDetail>, ReturnType<typeof toBackendCasePayload>>(
      `/automation/web/cases/${id}`,
      toBackendCasePayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async deleteCase(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async getTemplates(workspaceCode = 'ALL', query?: WebUiCaseTemplateListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiCaseTemplateItem>>>('/automation/web/templates', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeTemplate)
  },

  async getTemplateDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<WebUiCaseTemplateDetail>>(`/automation/web/templates/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeTemplateDetail(unwrapApiResponse(payload))
  },

  async createTemplate(workspaceCode = 'ALL', data: SaveWebUiCaseTemplatePayload) {
    const payload = await httpPost<ApiResponse<WebUiCaseTemplateDetail>, ReturnType<typeof toBackendTemplatePayload>>(
      '/automation/web/templates',
      toBackendTemplatePayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeTemplateDetail(unwrapApiResponse(payload))
  },

  async updateTemplate(workspaceCode = 'ALL', id: number, data: SaveWebUiCaseTemplatePayload) {
    const payload = await httpPut<ApiResponse<WebUiCaseTemplateDetail>, ReturnType<typeof toBackendTemplatePayload>>(
      `/automation/web/templates/${id}`,
      toBackendTemplatePayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeTemplateDetail(unwrapApiResponse(payload))
  },

  async saveCaseAsTemplate(workspaceCode = 'ALL', caseId: number, data: SaveWebUiTemplateFromCasePayload) {
    const payload = await httpPost<ApiResponse<WebUiCaseTemplateDetail>, SaveWebUiTemplateFromCasePayload>(
      `/automation/web/cases/${caseId}/save-as-template`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeTemplateDetail(unwrapApiResponse(payload))
  },

  async deleteTemplate(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/templates/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async runCase(workspaceCode = 'ALL', id: number, data: WebUiRunRequest = {}) {
    const payload = await httpPost<ApiResponse<WebUiRunResponse>, WebUiRunRequest>(
      `/automation/web/cases/${id}/run`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeRunResponse(unwrapApiResponse(payload))
  },

  async runBatch(workspaceCode = 'ALL', data: WebUiBatchRunRequest) {
    const payload = await httpPost<ApiResponse<WebUiBatchRunResponse>, WebUiBatchRunRequest>(
      '/automation/web/batches/run',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeBatchRunResponse(unwrapApiResponse(payload))
  },

  async debugRunCase(workspaceCode = 'ALL', data: SaveWebUiCasePayload & WebUiRunRequest & { caseId?: number | null }) {
    type DebugRunPayload = Omit<ReturnType<typeof toBackendCasePayload>, 'headless'> & WebUiRunRequest & { caseId?: number | null }
    const requestPayload: DebugRunPayload = {
      ...toBackendCasePayload(data),
      caseId: data.caseId ?? null,
      environmentId: data.environmentId ?? null,
      headless: data.headless ?? null,
      variableSetId: data.variableSetId ?? null,
      runtimeVariables: data.runtimeVariables ?? null,
    }
    const payload = await httpPost<ApiResponse<WebUiRunResponse>, DebugRunPayload>(
      '/automation/web/cases/debug-run',
      requestPayload,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeRunResponse(unwrapApiResponse(payload))
  },

  async validateLocator(workspaceCode = 'ALL', data: ValidateWebUiLocatorPayload) {
    const payload = await httpPost<ApiResponse<ValidateWebUiLocatorResponse>, ValidateWebUiLocatorPayload>(
      '/automation/web/locators/validate',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    const result = unwrapApiResponse(payload)
    return {
      matched: Boolean(result.matched),
      matchCount: Number(result.matchCount || 0),
      errorMessage: result.errorMessage || null,
      screenshotBase64: result.screenshotBase64 || null,
    }
  },

  async getRuns(workspaceCode = 'ALL', query?: WebUiRunListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiRunSummary>>>('/automation/web/runs', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeRunSummary)
  },

  async getRunDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<WebUiRunDetail>>(`/automation/web/runs/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeRunDetail(unwrapApiResponse(payload))
  },

  async getBatches(workspaceCode = 'ALL', query?: WebUiRunBatchListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiRunBatchSummary>>>('/automation/web/batches', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeBatchSummary)
  },

  async getBatchDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<WebUiRunBatchDetail>>(`/automation/web/batches/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeBatchDetail(unwrapApiResponse(payload))
  },

  async getCiTokens(workspaceCode = 'ALL', query?: { pageNo?: number; pageSize?: number }) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiCiTokenSummary>>>('/automation/web/ci/tokens', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeCiToken)
  },

  async createCiToken(workspaceCode = 'ALL', data: SaveWebUiCiTokenPayload) {
    const payload = await httpPost<ApiResponse<WebUiCiTokenCreated>, SaveWebUiCiTokenPayload>(
      '/automation/web/ci/tokens',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCreatedCiToken(unwrapApiResponse(payload))
  },

  async disableCiToken(workspaceCode = 'ALL', id: number) {
    const payload = await httpPost<ApiResponse<WebUiCiTokenSummary>, Record<string, never>>(
      `/automation/web/ci/tokens/${id}/disable`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCiToken(unwrapApiResponse(payload))
  },

  async rotateCiToken(workspaceCode = 'ALL', id: number) {
    const payload = await httpPost<ApiResponse<WebUiCiTokenCreated>, Record<string, never>>(
      `/automation/web/ci/tokens/${id}/rotate`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCreatedCiToken(unwrapApiResponse(payload))
  },

  async deleteCiToken(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/ci/tokens/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async createReportShare(workspaceCode = 'ALL', data: SaveWebUiReportSharePayload) {
    const payload = await httpPost<ApiResponse<WebUiReportShareCreated>, SaveWebUiReportSharePayload>(
      '/automation/web/report-shares',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCreatedReportShare(unwrapApiResponse(payload))
  },

  async getReportShares(workspaceCode = 'ALL', query: Pick<SaveWebUiReportSharePayload, 'shareType' | 'targetId'>) {
    const payload = await httpGet<ApiResponse<WebUiReportShareSummary[]>>('/automation/web/report-shares', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return (unwrapApiResponse(payload) || []).map(normalizeReportShare)
  },

  async revokeReportShare(workspaceCode = 'ALL', id: number) {
    const payload = await httpPost<ApiResponse<WebUiReportShareSummary>, Record<string, never>>(
      `/automation/web/report-shares/${id}/revoke`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeReportShare(unwrapApiResponse(payload))
  },

  async regenerateReportShare(workspaceCode = 'ALL', id: number) {
    const payload = await httpPost<ApiResponse<WebUiReportShareCreated>, Record<string, never>>(
      `/automation/web/report-shares/${id}/regenerate`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCreatedReportShare(unwrapApiResponse(payload))
  },

  async getSharedReport(token: string) {
    const payload = await httpGet<ApiResponse<WebUiSharedReport>>(`/public/automation/web/report-shares/${encodeURIComponent(token)}`)
    return normalizeSharedReport(unwrapApiResponse(payload))
  },

  async getEnvironments(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiEnvironmentItem>>>('/automation/web/environments', {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeEnvironment)
  },

  async createEnvironment(workspaceCode = 'ALL', data: SaveWebUiEnvironmentPayload) {
    const payload = await httpPost<ApiResponse<WebUiEnvironmentItem>, ReturnType<typeof toBackendEnvironmentPayload>>(
      '/automation/web/environments',
      toBackendEnvironmentPayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeEnvironment(unwrapApiResponse(payload))
  },

  async updateEnvironment(workspaceCode = 'ALL', id: number, data: SaveWebUiEnvironmentPayload) {
    const payload = await httpPut<ApiResponse<WebUiEnvironmentItem>, ReturnType<typeof toBackendEnvironmentPayload>>(
      `/automation/web/environments/${id}`,
      toBackendEnvironmentPayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeEnvironment(unwrapApiResponse(payload))
  },

  async deleteEnvironment(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/environments/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },
}
