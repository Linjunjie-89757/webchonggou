import { httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type { ResetUserPasswordResponse, UpdateUserPayload, UserItem } from '../model/types'

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

function unwrapSingleUserResponse(payload: ApiResponse<UserItem>, fallbackMessage: string) {
  if (payload.success === false) {
    throw new Error(payload.message || fallbackMessage)
  }

  return payload.data
}

function unwrapResetPasswordResponse(payload: ApiResponse<ResetUserPasswordResponse>) {
  if (payload.success === false) {
    throw new Error(payload.message || '密码重置失败')
  }

  return payload.data
}

export const userApi = {
  async getUsers() {
    const payload = await httpGet<ApiResponse<UserItem[]>>('/users', {
      headers: workspaceHeaders('ALL'),
    })

    return unwrapUserResponse(payload)
  },

  async updateUser(userId: number, payload: UpdateUserPayload) {
    const response = await httpPut<ApiResponse<UserItem>, UpdateUserPayload>(
      `/users/${userId}`,
      payload,
      {
        headers: workspaceHeaders('ALL'),
      },
    )

    return unwrapSingleUserResponse(response, '用户信息更新失败')
  },

  async resetUserPassword(userId: number) {
    const response = await httpPost<ApiResponse<ResetUserPasswordResponse>, undefined>(
      `/users/${userId}/reset-password`,
      undefined,
      {
        headers: workspaceHeaders('ALL'),
      },
    )

    return unwrapResetPasswordResponse(response)
  },
}
