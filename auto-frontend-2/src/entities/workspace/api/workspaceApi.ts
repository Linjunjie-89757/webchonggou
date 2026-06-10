import { httpGet, type ApiResponse } from '@/shared/api/request'

import type { WorkspaceItem } from '../model/types'

function unwrapWorkspaceResponse(payload: ApiResponse<WorkspaceItem[]>) {
  if (payload.success === false) {
    throw new Error(payload.message || '工作空间加载失败')
  }

  return Array.isArray(payload.data) ? payload.data : []
}

export const workspaceApi = {
  async getSwitchableWorkspaces() {
    const payload = await httpGet<ApiResponse<WorkspaceItem[]>>('/workspaces/switchable')
    return unwrapWorkspaceResponse(payload)
  },
}
