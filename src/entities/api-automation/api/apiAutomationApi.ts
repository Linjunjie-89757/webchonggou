import { env } from '@/shared/config/env'
import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  ApiAiCaseGenerationEvent,
  ApiAiCaseGenerationPayload,
  ApiAutomationReportAnalysis,
  ApiAutomationReportDetail,
  ApiAutomationReportFailureBucket,
  ApiAutomationReportItem,
  ApiAutomationReportListQuery,
  ApiAutomationReportStatistics,
  ApiCaseListQuery,
  ApiDefinitionCaseDetail,
  ApiDefinitionDetail,
  ApiDefinitionListQuery,
  ApiDefinitionCaseItem,
  ApiDefinitionItem,
  ApiDefinitionModuleItem,
  ApiAutomationEnvironmentItem,
  ApiAutomationVariableSetItem,
  ApiDataFileDetail,
  ApiDataFileItem,
  ApiDataFileListQuery,
  ApiDataFilePreview,
  ApiDataFileUpdatePayload,
  ApiExecutionSuiteDataIteration,
  ApiRunHistoryDetail,
  ApiRunHistoryItem,
  ApiRunPayload,
  ApiRunResult,
  ApiScenarioDetail,
  ApiScenarioItem,
  ApiScenarioListQuery,
  ApiScenarioModuleItem,
  PageResponse,
  SaveApiDefinitionCasePayload,
  SaveApiDefinitionModulePayload,
  SaveApiDefinitionPayload,
  SaveApiScenarioModulePayload,
  SaveApiScenarioPayload,
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

function normalizeDefinition(item: ApiDefinitionItem): ApiDefinitionItem {
  return {
    ...item,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    name: item.name || '-',
    method: String(item.method || 'GET').toUpperCase(),
    path: item.path || '-',
    directoryName: item.directoryName || null,
    description: item.description || null,
    tags: Array.isArray(item.tags) ? item.tags : [],
    lastRunResult: item.lastRunResult || null,
    lastRunAt: item.lastRunAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeRequestConfig(config: ApiDefinitionDetail['requestConfig']): ApiDefinitionDetail['requestConfig'] {
  return {
    method: String(config?.method || 'GET').toUpperCase(),
    path: config?.path || '',
    timeoutMs: Number(config?.timeoutMs || 10000),
    queryParams: Array.isArray(config?.queryParams) ? config.queryParams : [],
    headers: Array.isArray(config?.headers) ? config.headers : [],
    cookies: Array.isArray(config?.cookies) ? config.cookies : [],
    body: {
      type: config?.body?.type || 'NONE',
      rawText: config?.body?.rawText || null,
      jsonText: config?.body?.jsonText || null,
      xmlText: config?.body?.xmlText || null,
      plainText: config?.body?.plainText || null,
      formItems: Array.isArray(config?.body?.formItems) ? config.body.formItems : [],
      contentType: config?.body?.contentType || null,
      fileName: config?.body?.fileName || null,
      fileSize: config?.body?.fileSize ?? null,
      binaryBase64: config?.body?.binaryBase64 || null,
    },
    authConfig: {
      authType: config?.authConfig?.authType || 'NONE',
      basicAuth: config?.authConfig?.basicAuth || null,
      digestAuth: config?.authConfig?.digestAuth || null,
    },
  }
}

function normalizeDefinitionDetail(item: ApiDefinitionDetail): ApiDefinitionDetail {
  return {
    ...normalizeDefinition(item),
    requestConfig: normalizeRequestConfig(item.requestConfig),
    assertions: Array.isArray(item.assertions) ? item.assertions : [],
    extractors: Array.isArray(item.extractors) ? item.extractors : [],
    preProcessors: Array.isArray(item.preProcessors) ? item.preProcessors : [],
    postProcessors: Array.isArray(item.postProcessors) ? item.postProcessors : [],
    createdAt: item.createdAt || null,
  }
}

function normalizeDefinitionModule(item: ApiDefinitionModuleItem): ApiDefinitionModuleItem {
  return {
    ...item,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    parentId: item.parentId ?? null,
    name: item.name || '-',
    fullPath: item.fullPath || null,
    sortOrder: item.sortOrder ?? null,
    definitionCount: Number(item.definitionCount || 0),
    children: Array.isArray(item.children) ? item.children.map(normalizeDefinitionModule) : [],
  }
}

function normalizeCase(item: ApiDefinitionCaseItem): ApiDefinitionCaseItem {
  return {
    ...item,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    definitionName: item.definitionName || '-',
    name: item.name || '-',
    method: String(item.method || 'GET').toUpperCase(),
    path: item.path || '-',
    description: item.description || null,
    tags: Array.isArray(item.tags) ? item.tags : [],
    lastRunResult: item.lastRunResult || null,
    lastRunAt: item.lastRunAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeCaseDetail(item: ApiDefinitionCaseDetail): ApiDefinitionCaseDetail {
  return {
    ...normalizeCase(item),
    requestConfig: normalizeRequestConfig(item.requestConfig),
    assertions: Array.isArray(item.assertions) ? item.assertions : [],
    extractors: Array.isArray(item.extractors) ? item.extractors : [],
    preProcessors: Array.isArray(item.preProcessors) ? item.preProcessors : [],
    postProcessors: Array.isArray(item.postProcessors) ? item.postProcessors : [],
    createdAt: item.createdAt || null,
  }
}

function normalizeScenarioModule(item: ApiScenarioModuleItem): ApiScenarioModuleItem {
  return {
    ...item,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    parentId: item.parentId ?? null,
    name: item.name || '-',
    sortOrder: item.sortOrder ?? null,
    scenarioCount: Number(item.scenarioCount || 0),
    children: Array.isArray(item.children) ? item.children.map(normalizeScenarioModule) : [],
  }
}

function normalizeScenario(item: ApiScenarioItem): ApiScenarioItem {
  return {
    ...item,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    name: item.name || '-',
    directoryName: item.directoryName || null,
    moduleId: item.moduleId ?? null,
    moduleName: item.moduleName || null,
    priority: item.priority || 'P1',
    status: item.status || 'IN_PROGRESS',
    description: item.description || null,
    tags: Array.isArray(item.tags) ? item.tags : [],
    stepCount: Number(item.stepCount || 0),
    defaultEnvironmentId: item.defaultEnvironmentId ?? null,
    variableSetId: item.variableSetId ?? null,
    runOn: item.runOn || 'LOCAL',
    continueOnFailure: Boolean(item.continueOnFailure),
    globalTimeoutMs: Number(item.globalTimeoutMs || 300000),
    stepFailureRetryCount: Number(item.stepFailureRetryCount || 0),
    defaultStepWaitMs: Number(item.defaultStepWaitMs || 0),
    dataDrivenEnabled: Boolean(item.dataDrivenEnabled),
    dataFileId: item.dataFileId ?? null,
    dataFileNameSnapshot: item.dataFileNameSnapshot || null,
    caseDescColumn: item.caseDescColumn || 'caseDesc',
    dataFailureStrategy: item.dataFailureStrategy || 'STOP_ON_ROW_FAILURE',
    lastRunResult: item.lastRunResult || null,
    lastRunAt: item.lastRunAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeScenarioDetail(item: ApiScenarioDetail): ApiScenarioDetail {
  return {
    ...normalizeScenario(item),
    relatedCaseId: item.relatedCaseId ?? null,
    scenarioVariables: Array.isArray(item.scenarioVariables) ? item.scenarioVariables : [],
    scenarioAssertions: Array.isArray(item.scenarioAssertions) ? item.scenarioAssertions : [],
    steps: Array.isArray(item.steps) ? item.steps : [],
    createdAt: item.createdAt || null,
  }
}

function normalizeRunResult(item: ApiRunResult): ApiRunResult {
  return {
    ...item,
    taskId: item.taskId ?? null,
    reportId: item.reportId ?? null,
    taskName: item.taskName || null,
    reportName: item.reportName || null,
    result: item.result || null,
    failureSummary: item.failureSummary || null,
    dataIterations: Array.isArray(item.dataIterations) ? item.dataIterations.map(normalizeDataIteration) : [],
    stepResults: Array.isArray(item.stepResults) ? item.stepResults : [],
  }
}

function normalizeDataIteration(item: ApiExecutionSuiteDataIteration): ApiExecutionSuiteDataIteration {
  return {
    ...item,
    rowIndex: Number(item.rowIndex ?? 0),
    caseDesc: item.caseDesc || null,
    rowValues: item.rowValues || {},
    result: item.result || null,
    failedStep: item.failedStep || null,
    stepCount: item.stepCount ?? null,
    durationMs: item.durationMs ?? null,
    failureSummary: item.failureSummary || null,
  }
}

function normalizeRunHistoryItem(item: ApiRunHistoryItem): ApiRunHistoryItem {
  return {
    ...item,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    caseName: item.caseName || '-',
    reportId: item.reportId ?? null,
    result: item.result || null,
    failureSummary: item.failureSummary || null,
    statusCode: item.statusCode ?? null,
    durationMs: item.durationMs ?? null,
    responseSize: item.responseSize ?? null,
    environmentId: item.environmentId ?? null,
    environmentName: item.environmentName || null,
    variableSetId: item.variableSetId ?? null,
    variableSetName: item.variableSetName || null,
    operator: item.operator || null,
    createdAt: item.createdAt || null,
  }
}

function normalizeRunHistoryDetail(item: ApiRunHistoryDetail): ApiRunHistoryDetail {
  return {
    ...normalizeRunHistoryItem(item),
    stepResults: Array.isArray(item.stepResults) ? item.stepResults : [],
  }
}

function normalizeReportItem(item: ApiAutomationReportItem): ApiAutomationReportItem {
  return {
    ...item,
    reportKey: item.reportKey || '',
    objectType: item.objectType || 'API_CASE',
    historyId: item.historyId ?? null,
    reportId: item.reportId ?? null,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    objectId: item.objectId ?? null,
    objectName: item.objectName || item.reportName || '-',
    reportName: item.reportName || item.objectName || '-',
    result: item.result || null,
    failureSummary: item.failureSummary || null,
    totalCount: item.totalCount ?? null,
    successCount: item.successCount ?? null,
    failedCount: item.failedCount ?? null,
    skippedCount: item.skippedCount ?? null,
    statusCode: item.statusCode ?? null,
    durationMs: item.durationMs ?? null,
    responseSize: item.responseSize ?? null,
    environmentId: item.environmentId ?? null,
    environmentName: item.environmentName || null,
    variableSetId: item.variableSetId ?? null,
    variableSetName: item.variableSetName || null,
    runMode: item.runMode || null,
    runOn: item.runOn || null,
    branchName: item.branchName || null,
    triggerSource: item.triggerSource || null,
    dataDrivenEnabled: Boolean(item.dataDrivenEnabled),
    dataFileId: item.dataFileId ?? null,
    dataFileName: item.dataFileName || null,
    dataRowCount: item.dataRowCount ?? null,
    operatorName: item.operatorName || null,
    createdAt: item.createdAt || null,
    archived: Boolean(item.archived),
  }
}

function normalizeReportDetail(item: ApiAutomationReportDetail): ApiAutomationReportDetail {
  return {
    ...normalizeReportItem(item),
    continueOnFailure: item.continueOnFailure ?? null,
    globalTimeoutMs: item.globalTimeoutMs ?? null,
    stepFailureRetryCount: item.stepFailureRetryCount ?? null,
    defaultStepWaitMs: item.defaultStepWaitMs ?? null,
    dataIterations: Array.isArray(item.dataIterations) ? item.dataIterations.map(normalizeDataIteration) : [],
    itemSnapshots: Array.isArray(item.itemSnapshots) ? item.itemSnapshots : [],
    stepResults: Array.isArray(item.stepResults) ? item.stepResults : [],
  }
}

function normalizeReportFailureBucket(item: ApiAutomationReportFailureBucket): ApiAutomationReportFailureBucket {
  return {
    key: item.key || item.label || '-',
    label: item.label || item.key || '-',
    count: Number(item.count ?? 0),
    durationMs: item.durationMs ?? null,
  }
}

function normalizeReportAnalysis(item: ApiAutomationReportAnalysis): ApiAutomationReportAnalysis {
  return {
    totalCount: Number(item.totalCount ?? 0),
    passedCount: Number(item.passedCount ?? 0),
    failedCount: Number(item.failedCount ?? 0),
    skippedCount: Number(item.skippedCount ?? 0),
    failureRate: Number(item.failureRate ?? 0),
    averageDurationMs: item.averageDurationMs ?? null,
    failureReasons: Array.isArray(item.failureReasons) ? item.failureReasons.map(normalizeReportFailureBucket) : [],
    topFailedObjects: Array.isArray(item.topFailedObjects) ? item.topFailedObjects.map(normalizeReportFailureBucket) : [],
    recentFailures: Array.isArray(item.recentFailures) ? item.recentFailures.map(normalizeReportItem) : [],
  }
}

function normalizeReportStatistics(item: ApiAutomationReportStatistics): ApiAutomationReportStatistics {
  return {
    trendPoints: Array.isArray(item.trendPoints)
      ? item.trendPoints.map(point => ({
          date: point.date || '-',
          totalCount: Number(point.totalCount ?? 0),
          passedCount: Number(point.passedCount ?? 0),
          failedCount: Number(point.failedCount ?? 0),
          skippedCount: Number(point.skippedCount ?? 0),
          failureRate: Number(point.failureRate ?? 0),
          averageDurationMs: point.averageDurationMs ?? null,
        }))
      : [],
    resultDistribution: Array.isArray(item.resultDistribution)
      ? item.resultDistribution.map(normalizeReportFailureBucket)
      : [],
    objectTypeDistribution: Array.isArray(item.objectTypeDistribution)
      ? item.objectTypeDistribution.map(normalizeReportFailureBucket)
      : [],
    slowestRuns: Array.isArray(item.slowestRuns) ? item.slowestRuns.map(normalizeReportItem) : [],
  }
}

async function streamJsonEvents<T>(
  path: string,
  payload: unknown,
  headers: Record<string, string>,
  onEvent: (event: T) => void,
) {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }
  if (!response.body) {
    throw new Error('Streaming response is not available')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const chunks = buffer.split(/\r?\n\r?\n/)
    buffer = chunks.pop() || ''

    chunks.forEach((chunk) => {
      const data = chunk
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .join('\n')

      if (!data || data === '[DONE]') {
        return
      }

      onEvent(JSON.parse(data) as T)
    })

    if (done) {
      break
    }
  }

  const rest = buffer.trim()
  if (rest.startsWith('data:')) {
    const data = rest
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())
      .join('\n')
    if (data && data !== '[DONE]') {
      onEvent(JSON.parse(data) as T)
    }
  }
}

function normalizeEnvironment(item: ApiAutomationEnvironmentItem): ApiAutomationEnvironmentItem {
  return {
    id: Number(item.id),
    workspaceCode: item.workspaceCode,
    workspaceName: item.workspaceName || null,
    name: item.name,
    baseUrl: item.baseUrl || null,
    status: item.status ?? null,
  }
}

function normalizeVariableSet(item: ApiAutomationVariableSetItem): ApiAutomationVariableSetItem {
  return {
    id: Number(item.id),
    workspaceCode: item.workspaceCode,
    workspaceName: item.workspaceName || null,
    name: item.name,
    status: item.status ?? null,
  }
}

function normalizeDataFileRow(item: { rowIndex?: number; caseDesc?: string | null; values?: Record<string, string> }) {
  return {
    rowIndex: Number(item.rowIndex || 0),
    caseDesc: item.caseDesc || null,
    values: item.values || {},
  }
}

function normalizeDataFile(item: ApiDataFileItem): ApiDataFileItem {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || null,
    fileName: item.fileName || '-',
    originalFileName: item.originalFileName || null,
    fileType: item.fileType || 'CSV',
    encoding: item.encoding || 'UTF-8',
    delimiter: item.delimiter || ',',
    ignoreFirstLine: Boolean(item.ignoreFirstLine),
    caseDescColumn: item.caseDescColumn || null,
    rowCount: Number(item.rowCount || 0),
    columns: Array.isArray(item.columns) ? item.columns : [],
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeDataFileDetail(item: ApiDataFileDetail): ApiDataFileDetail {
  return {
    ...normalizeDataFile(item),
    previewRows: Array.isArray(item.previewRows) ? item.previewRows.map(normalizeDataFileRow) : [],
  }
}

function normalizeDataFilePreview(item: ApiDataFilePreview): ApiDataFilePreview {
  return {
    id: Number(item.id),
    columns: Array.isArray(item.columns) ? item.columns : [],
    rows: Array.isArray(item.rows) ? item.rows.map(normalizeDataFileRow) : [],
    rowCount: Number(item.rowCount || 0),
  }
}

export const apiAutomationApi = {
  async getEnvironments(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<PageResponse<ApiAutomationEnvironmentItem>>>('/automation/api/environments', {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizePageResponse(unwrapApiResponse(payload), normalizeEnvironment)
  },

  async getVariableSets(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<PageResponse<ApiAutomationVariableSetItem>>>('/automation/api/variable-sets', {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizePageResponse(unwrapApiResponse(payload), normalizeVariableSet)
  },

  async getDataFiles(workspaceCode = 'ALL', query?: ApiDataFileListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<ApiDataFileItem>>>('/automation/api/data-files', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return normalizePageResponse(unwrapApiResponse(payload), normalizeDataFile)
  },

  async getDataFile(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<ApiDataFileDetail>>(`/automation/api/data-files/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDataFileDetail(unwrapApiResponse(payload))
  },

  async previewDataFile(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<ApiDataFilePreview>>(`/automation/api/data-files/${id}/preview`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDataFilePreview(unwrapApiResponse(payload))
  },

  async uploadDataFile(
    workspaceCode = 'ALL',
    file: File,
    options?: { fileName?: string; caseDescColumn?: string; ignoreFirstLine?: boolean },
  ) {
    const form = new FormData()
    form.append('file', file)
    form.append('workspaceCode', workspaceCode)
    if (options?.fileName) {
      form.append('fileName', options.fileName)
    }
    if (options?.caseDescColumn) {
      form.append('caseDescColumn', options.caseDescColumn)
    }
    if (options?.ignoreFirstLine !== undefined) {
      form.append('ignoreFirstLine', String(options.ignoreFirstLine))
    }

    const response = await fetch(`${env.apiBaseUrl}/automation/api/data-files`, {
      method: 'POST',
      credentials: 'include',
      headers: workspaceHeaders(workspaceCode),
      body: form,
    })

    if (!response.ok) {
      throw new Error(await response.text() || `Request failed with status ${response.status}`)
    }

    const payload = await response.json() as ApiResponse<ApiDataFileDetail>
    return normalizeDataFileDetail(unwrapApiResponse(payload))
  },

  async updateDataFile(workspaceCode = 'ALL', id: number, data: ApiDataFileUpdatePayload) {
    const payload = await httpPut<ApiResponse<ApiDataFileDetail>, ApiDataFileUpdatePayload>(
      `/automation/api/data-files/${id}`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return normalizeDataFileDetail(unwrapApiResponse(payload))
  },

  async deleteDataFile(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/api/data-files/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async getDefinitions(workspaceCode = 'ALL', query?: ApiDefinitionListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<ApiDefinitionItem>>>('/automation/api/definitions', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return normalizePageResponse(unwrapApiResponse(payload), normalizeDefinition)
  },

  async getDefinitionModules(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<ApiDefinitionModuleItem[]>>('/automation/api/definition-modules', {
      headers: workspaceHeaders(workspaceCode),
    })

    const modules = unwrapApiResponse(payload)
    return Array.isArray(modules) ? modules.map(normalizeDefinitionModule) : []
  },

  async createDefinitionModule(workspaceCode = 'ALL', data: SaveApiDefinitionModulePayload) {
    const payload = await httpPost<ApiResponse<ApiDefinitionModuleItem>, SaveApiDefinitionModulePayload>(
      '/automation/api/definition-modules',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeDefinitionModule(unwrapApiResponse(payload))
  },

  async updateDefinitionModule(workspaceCode = 'ALL', id: number, data: SaveApiDefinitionModulePayload) {
    const payload = await httpPut<ApiResponse<ApiDefinitionModuleItem>, SaveApiDefinitionModulePayload>(
      `/automation/api/definition-modules/${id}`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeDefinitionModule(unwrapApiResponse(payload))
  },

  async moveDefinitionModule(workspaceCode = 'ALL', id: number, data: SaveApiDefinitionModulePayload) {
    const payload = await httpPut<ApiResponse<ApiDefinitionModuleItem>, SaveApiDefinitionModulePayload>(
      `/automation/api/definition-modules/${id}/move`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeDefinitionModule(unwrapApiResponse(payload))
  },

  async deleteDefinitionModule(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/api/definition-modules/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async getScenarios(workspaceCode = 'ALL', query?: ApiScenarioListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<ApiScenarioItem>>>('/automation/api/scenarios', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return normalizePageResponse(unwrapApiResponse(payload), normalizeScenario)
  },

  async getScenarioModules(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<ApiScenarioModuleItem[]>>('/automation/api/scenario-modules', {
      headers: workspaceHeaders(workspaceCode),
    })

    const modules = unwrapApiResponse(payload)
    return Array.isArray(modules) ? modules.map(normalizeScenarioModule) : []
  },

  async createScenarioModule(workspaceCode = 'ALL', data: SaveApiScenarioModulePayload) {
    const payload = await httpPost<ApiResponse<ApiScenarioModuleItem>, SaveApiScenarioModulePayload>(
      '/automation/api/scenario-modules',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeScenarioModule(unwrapApiResponse(payload))
  },

  async updateScenarioModule(workspaceCode = 'ALL', id: number, data: SaveApiScenarioModulePayload) {
    const payload = await httpPut<ApiResponse<ApiScenarioModuleItem>, SaveApiScenarioModulePayload>(
      `/automation/api/scenario-modules/${id}`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeScenarioModule(unwrapApiResponse(payload))
  },

  async deleteScenarioModule(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/api/scenario-modules/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async getDefinitionDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<ApiDefinitionDetail>>(`/automation/api/definitions/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefinitionDetail(unwrapApiResponse(payload))
  },

  async getScenarioDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<ApiScenarioDetail>>(`/automation/api/scenarios/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeScenarioDetail(unwrapApiResponse(payload))
  },

  async createScenario(workspaceCode = 'ALL', data: SaveApiScenarioPayload) {
    const payload = await httpPost<ApiResponse<ApiScenarioDetail>, SaveApiScenarioPayload>(
      '/automation/api/scenarios',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeScenarioDetail(unwrapApiResponse(payload))
  },

  async updateScenario(workspaceCode = 'ALL', id: number, data: SaveApiScenarioPayload) {
    const payload = await httpPut<ApiResponse<ApiScenarioDetail>, SaveApiScenarioPayload>(
      `/automation/api/scenarios/${id}`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeScenarioDetail(unwrapApiResponse(payload))
  },

  async deleteScenario(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/api/scenarios/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async createDefinition(workspaceCode = 'ALL', data: SaveApiDefinitionPayload) {
    const payload = await httpPost<ApiResponse<ApiDefinitionDetail>, SaveApiDefinitionPayload>(
      '/automation/api/definitions',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeDefinitionDetail(unwrapApiResponse(payload))
  },

  async updateDefinition(workspaceCode = 'ALL', id: number, data: SaveApiDefinitionPayload) {
    const payload = await httpPut<ApiResponse<ApiDefinitionDetail>, SaveApiDefinitionPayload>(
      `/automation/api/definitions/${id}`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeDefinitionDetail(unwrapApiResponse(payload))
  },

  async deleteDefinition(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/api/definitions/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async getCases(workspaceCode = 'ALL', query?: ApiCaseListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<ApiDefinitionCaseItem>>>('/automation/api/cases', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return normalizePageResponse(unwrapApiResponse(payload), normalizeCase)
  },

  async getCaseDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<ApiDefinitionCaseDetail>>(`/automation/api/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async createCase(workspaceCode = 'ALL', data: SaveApiDefinitionCasePayload) {
    const payload = await httpPost<ApiResponse<ApiDefinitionCaseDetail>, SaveApiDefinitionCasePayload>(
      '/automation/api/cases',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async updateCase(workspaceCode = 'ALL', id: number, data: SaveApiDefinitionCasePayload) {
    const payload = await httpPut<ApiResponse<ApiDefinitionCaseDetail>, SaveApiDefinitionCasePayload>(
      `/automation/api/cases/${id}`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async deleteCase(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/api/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async debugRunDefinition(workspaceCode = 'ALL', id: number, data?: ApiRunPayload) {
    const payload = await httpPost<ApiResponse<ApiRunResult>, ApiRunPayload>(
      `/automation/api/definitions/${id}/debug-run`,
      data || {},
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeRunResult(unwrapApiResponse(payload))
  },

  async debugRunDefinitionDraft(workspaceCode = 'ALL', data: SaveApiDefinitionPayload & ApiRunPayload) {
    const payload = await httpPost<ApiResponse<ApiRunResult>, SaveApiDefinitionPayload & ApiRunPayload>(
      '/automation/api/definitions/debug-run',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeRunResult(unwrapApiResponse(payload))
  },

  async runCase(workspaceCode = 'ALL', id: number, data?: ApiRunPayload) {
    const payload = await httpPost<ApiResponse<ApiRunResult>, ApiRunPayload>(
      `/automation/api/cases/${id}/run`,
      data || {},
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeRunResult(unwrapApiResponse(payload))
  },

  async runScenario(workspaceCode = 'ALL', id: number, data?: ApiRunPayload) {
    const payload = await httpPost<ApiResponse<ApiRunResult>, ApiRunPayload>(
      `/automation/api/scenarios/${id}/run`,
      data || {},
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeRunResult(unwrapApiResponse(payload))
  },

  async getCaseRunHistory(workspaceCode = 'ALL', caseId: number, query?: { pageNo?: number; pageSize?: number }) {
    const payload = await httpGet<ApiResponse<PageResponse<ApiRunHistoryItem>>>(
      `/automation/api/cases/${caseId}/run-history`,
      {
        headers: workspaceHeaders(workspaceCode),
        params: cleanQuery(query),
      },
    )

    return normalizePageResponse(unwrapApiResponse(payload), normalizeRunHistoryItem)
  },

  async getCaseRunHistoryDetail(workspaceCode = 'ALL', historyId: number) {
    const payload = await httpGet<ApiResponse<ApiRunHistoryDetail>>(
      `/automation/api/cases/run-history/${historyId}`,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeRunHistoryDetail(unwrapApiResponse(payload))
  },

  async getReports(workspaceCode = 'ALL', query?: ApiAutomationReportListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<ApiAutomationReportItem>>>(
      '/automation/api/reports',
      {
        headers: workspaceHeaders(workspaceCode),
        params: cleanQuery(query),
      },
    )

    return normalizePageResponse(unwrapApiResponse(payload), normalizeReportItem)
  },

  async getReportAnalysis(workspaceCode = 'ALL', query?: ApiAutomationReportListQuery) {
    const payload = await httpGet<ApiResponse<ApiAutomationReportAnalysis>>(
      '/automation/api/reports/analysis',
      {
        headers: workspaceHeaders(workspaceCode),
        params: cleanQuery({
          keyword: query?.keyword,
          objectType: query?.objectType,
          result: query?.result,
          createdFrom: query?.createdFrom,
          createdTo: query?.createdTo,
          archived: query?.archived,
        }),
      },
    )

    return normalizeReportAnalysis(unwrapApiResponse(payload))
  },

  async getReportStatistics(workspaceCode = 'ALL', query?: ApiAutomationReportListQuery) {
    const payload = await httpGet<ApiResponse<ApiAutomationReportStatistics>>(
      '/automation/api/reports/statistics',
      {
        headers: workspaceHeaders(workspaceCode),
        params: cleanQuery({
          keyword: query?.keyword,
          objectType: query?.objectType,
          result: query?.result,
          createdFrom: query?.createdFrom,
          createdTo: query?.createdTo,
          archived: query?.archived,
        }),
      },
    )

    return normalizeReportStatistics(unwrapApiResponse(payload))
  },

  async getReportDetail(workspaceCode = 'ALL', reportKey: string) {
    const payload = await httpGet<ApiResponse<ApiAutomationReportDetail>>(
      `/automation/api/reports/${encodeURIComponent(reportKey)}`,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeReportDetail(unwrapApiResponse(payload))
  },

  async exportReports(workspaceCode = 'ALL', query?: ApiAutomationReportListQuery) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(cleanQuery({
      keyword: query?.keyword,
      objectType: query?.objectType,
      result: query?.result,
      createdFrom: query?.createdFrom,
      createdTo: query?.createdTo,
      archived: query?.archived,
    }) || {})) {
      params.set(key, String(value))
    }
    const response = await fetch(`${env.apiBaseUrl}/automation/api/reports-export${params.size ? `?${params.toString()}` : ''}`, {
      credentials: 'include',
      headers: workspaceHeaders(workspaceCode),
    })

    if (!response.ok) {
      throw new Error(await response.text() || `Request failed with status ${response.status}`)
    }

    return response.blob()
  },

  async rerunReport(workspaceCode = 'ALL', reportKey: string, data?: ApiRunPayload) {
    const payload = await httpPost<ApiResponse<ApiRunResult>, ApiRunPayload>(
      `/automation/api/reports/${encodeURIComponent(reportKey)}/rerun`,
      data || { triggerSource: 'REPORT_RERUN' },
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeRunResult(unwrapApiResponse(payload))
  },

  async archiveReport(workspaceCode = 'ALL', reportKey: string) {
    const response = await fetch(`${env.apiBaseUrl}/automation/api/reports/${encodeURIComponent(reportKey)}/archive`, {
      method: 'PATCH',
      credentials: 'include',
      headers: workspaceHeaders(workspaceCode),
    })

    if (!response.ok) {
      throw new Error(await response.text() || `Request failed with status ${response.status}`)
    }

    const payload = await response.json() as ApiResponse<ApiAutomationReportDetail>
    return normalizeReportDetail(unwrapApiResponse(payload))
  },

  async streamAiCaseGeneration(
    workspaceCode = 'ALL',
    data: ApiAiCaseGenerationPayload,
    onEvent: (event: ApiAiCaseGenerationEvent) => void,
  ) {
    await streamJsonEvents<ApiAiCaseGenerationEvent>(
      '/automation/api/ai-case-generation/stream',
      data,
      workspaceHeaders(workspaceCode),
      onEvent,
    )
  },
}
