import { httpGet, type ApiResponse } from '@/shared/api/request'

import type { DefectListResponse, DefectStatistics, DefectSummaryItem } from '../model/types'

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
  async getDefects(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<DefectListResponse>>('/bugs', {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeDefectListResponse(unwrapApiResponse(payload))
  },

  async getDefectStatistics(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<DefectStatistics>>('/bugs/statistics', {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },
}
