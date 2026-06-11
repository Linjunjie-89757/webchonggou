import { httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  AssignDefectPayload,
  AssignDefectResult,
  DefectDetail,
  DefectListQuery,
  DefectListResponse,
  DefectStatistics,
  DefectSummaryItem,
  SaveDefectPayload,
  TransitionDefectPayload,
  TransitionDefectResult,
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

function cleanQuery(query?: DefectListQuery) {
  if (!query) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function normalizeDefectItem(item: DefectSummaryItem): DefectSummaryItem {
  return {
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
    assigneeName: item.assigneeName || null,
    reporterName: item.reporterName || null,
    updatedByName: item.updatedByName || null,
    relatedCaseCount: Number(item.relatedCaseCount || 0),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
  }
}

function normalizeDefectDetail(item: DefectDetail): DefectDetail {
  const summary = normalizeDefectItem(item)

  return {
    ...item,
    ...summary,
    description: item.description || '',
    sourceType: item.sourceType || null,
    assigneeId: item.assigneeId ?? null,
    reporterId: item.reporterId ?? null,
    relatedCaseId: item.relatedCaseId ?? null,
    relatedReportId: item.relatedReportId ?? null,
    relatedTaskId: item.relatedTaskId ?? null,
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    activities: Array.isArray(item.activities) ? item.activities : [],
    flows: Array.isArray(item.flows) ? item.flows : [],
    comments: Array.isArray(item.comments) ? item.comments : [],
  }
}

function normalizeDefectListResponse(page: DefectListResponse): DefectListResponse {
  const items = Array.isArray(page.items) ? page.items.map(normalizeDefectItem) : []
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

export const defectApi = {
  async getDefects(workspaceCode = 'ALL', query?: DefectListQuery) {
    const payload = await httpGet<ApiResponse<DefectListResponse>>('/bugs', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return normalizeDefectListResponse(unwrapApiResponse(payload))
  },

  async getDefectStatistics(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<DefectStatistics>>('/bugs/statistics', {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async getDefectDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<DefectDetail>>(`/bugs/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },

  async createDefect(workspaceCode = 'ALL', data: SaveDefectPayload) {
    const payload = await httpPost<ApiResponse<DefectDetail>, SaveDefectPayload>('/bugs', data, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },

  async updateDefect(workspaceCode = 'ALL', id: number, data: SaveDefectPayload) {
    const payload = await httpPut<ApiResponse<DefectDetail>, SaveDefectPayload>(`/bugs/${id}`, data, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },

  async assignDefect(workspaceCode = 'ALL', id: number, data: AssignDefectPayload) {
    const payload = await httpPost<ApiResponse<AssignDefectResult>, AssignDefectPayload>(`/bugs/${id}/assign`, data, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },

  async transitionDefect(workspaceCode = 'ALL', id: number, data: TransitionDefectPayload) {
    const payload = await httpPost<ApiResponse<TransitionDefectResult>, TransitionDefectPayload>(
      `/bugs/${id}/transition`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return normalizeDefectDetail(unwrapApiResponse(payload))
  },
}
