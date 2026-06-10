import { httpGet, httpPost, type ApiResponse } from '@/shared/api/request'

import type { CurrentUser, LoginPayload } from '../model/types'

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '请求失败')
  }

  return payload.data
}

export const sessionApi = {
  async login(payload: LoginPayload) {
    const response = await httpPost<ApiResponse<CurrentUser>, LoginPayload>('/auth/login', payload)
    return unwrapApiResponse(response)
  },

  async getCurrentUser() {
    const response = await httpGet<ApiResponse<CurrentUser>>('/auth/me')
    return unwrapApiResponse(response)
  },

  async logout() {
    const response = await httpPost<ApiResponse<null>, undefined>('/auth/logout')
    return unwrapApiResponse(response)
  },
}
