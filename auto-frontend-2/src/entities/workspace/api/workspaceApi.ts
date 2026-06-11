import { httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type { SaveWorkspacePayload, WorkspaceItem } from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function normalizeWorkspaceItem(item: WorkspaceItem): WorkspaceItem {
  const workspaceCode = item.workspaceCode || item.code || 'ALL'
  const workspaceName = item.workspaceName || item.name || workspaceCode

  return {
    ...item,
    workspaceCode,
    workspaceName,
    current: item.current || item.isCurrent || item.allScope,
  }
}

function unwrapWorkspaceResponse(payload: ApiResponse<WorkspaceItem[]>) {
  if (payload.success === false) {
    throw new Error(payload.message || '工作空间加载失败')
  }

  return Array.isArray(payload.data) ? payload.data.map(normalizeWorkspaceItem) : []
}

export const workspaceApi = {
  async getWorkspaces() {
    const payload = await httpGet<ApiResponse<WorkspaceItem[]>>('/workspaces', {
      headers: workspaceHeaders('ALL'),
    })
    return unwrapWorkspaceResponse(payload)
  },

  async getSwitchableWorkspaces() {
    const payload = await httpGet<ApiResponse<WorkspaceItem[]>>('/workspaces/switchable', {
      headers: workspaceHeaders('ALL'),
    })
    return unwrapWorkspaceResponse(payload)
  },

  async createWorkspace(payload: SaveWorkspacePayload) {
    const response = await httpPost<ApiResponse<WorkspaceItem>, SaveWorkspacePayload>('/workspaces', payload, {
      headers: workspaceHeaders('ALL'),
    })

    if (response.success === false) {
      throw new Error(response.message || '工作空间创建失败')
    }

    return normalizeWorkspaceItem(response.data)
  },

  async updateWorkspace(workspaceCode: string, payload: SaveWorkspacePayload) {
    const response = await httpPut<ApiResponse<WorkspaceItem>, SaveWorkspacePayload>(
      `/workspaces/${encodeURIComponent(workspaceCode)}`,
      payload,
      {
        headers: workspaceHeaders('ALL'),
      },
    )

    if (response.success === false) {
      throw new Error(response.message || '工作空间更新失败')
    }

    return normalizeWorkspaceItem(response.data)
  },
}
