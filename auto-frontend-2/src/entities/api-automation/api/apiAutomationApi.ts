import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  ApiCaseListQuery,
  ApiDefinitionCaseDetail,
  ApiDefinitionDetail,
  ApiDefinitionListQuery,
  ApiDefinitionCaseItem,
  ApiDefinitionItem,
  ApiDefinitionModuleItem,
  ApiRunPayload,
  ApiRunResult,
  PageResponse,
  SaveApiDefinitionCasePayload,
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
      formItems: Array.isArray(config?.body?.formItems) ? config.body.formItems : [],
      contentType: config?.body?.contentType || null,
      fileName: config?.body?.fileName || null,
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

export const apiAutomationApi = {
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
}
