import { httpGet, type ApiResponse } from '@/shared/api/request'

import type { UserItem } from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function unwrapUserResponse(payload: ApiResponse<UserItem[]>) {
  if (payload.success === false) {
    throw new Error(payload.message || '用户列表加载失败')
  }

  return Array.isArray(payload.data) ? payload.data : []
}

export const userApi = {
  async getUsers() {
    const payload = await httpGet<ApiResponse<UserItem[]>>('/users', {
      headers: workspaceHeaders('ALL'),
    })

    return unwrapUserResponse(payload)
  },
}
