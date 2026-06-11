import { httpGet, type ApiResponse } from '@/shared/api/request'

import type { AutomationTaskListResponse, AutomationTaskSummaryItem } from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '任务加载失败')
  }

  return payload.data
}

function normalizeTaskItem(item: AutomationTaskSummaryItem): AutomationTaskSummaryItem {
  return {
    ...item,
    taskName: item.taskName || '-',
    summary: item.summary || null,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
  }
}

function normalizeTaskListResponse(page: AutomationTaskListResponse): AutomationTaskListResponse {
  const items = Array.isArray(page.items) ? page.items.map(normalizeTaskItem) : []
  const total = Number(page.total ?? items.length)

  return {
    items,
    total,
    pageNo: Number(page.pageNo || 1),
    pageSize: Number(page.pageSize || items.length || total || 10),
    totalPages: Number(page.totalPages || (total > 0 ? 1 : 0)),
  }
}

export const automationTaskApi = {
  async getTasks(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<AutomationTaskListResponse>>('/tasks', {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeTaskListResponse(unwrapApiResponse(payload))
  },
}
