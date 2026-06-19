import { env } from '@/shared/config/env'
import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  ApiAiCaseGenerationEvent,
  ApiAiCaseGenerationPayload,
  ApiCaseListQuery,
  ApiDefinitionCaseDetail,
  ApiDefinitionDetail,
  ApiDefinitionListQuery,
  ApiDefinitionCaseItem,
  ApiDefinitionItem,
  ApiDefinitionModuleItem,
  ApiAutomationEnvironmentItem,
  ApiAutomationVariableSetItem,
  ApiRunHistoryDetail,
  ApiRunHistoryItem,
  ApiRunPayload,
  ApiRunResult,
  PageResponse,
  SaveApiDefinitionCasePayload,
  SaveApiDefinitionModulePayload,
  SaveApiDefinitionPayload,
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

function normalizeRunResult(item: ApiRunResult): ApiRunResult {
  return {
    ...item,
    taskId: item.taskId ?? null,
    reportId: item.reportId ?? null,
    taskName: item.taskName || null,
    reportName: item.reportName || null,
    result: item.result || null,
    failureSummary: item.failureSummary || null,
    stepResults: Array.isArray(item.stepResults) ? item.stepResults : [],
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

  async getDefinitionDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<ApiDefinitionDetail>>(`/automation/api/definitions/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefinitionDetail(unwrapApiResponse(payload))
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
