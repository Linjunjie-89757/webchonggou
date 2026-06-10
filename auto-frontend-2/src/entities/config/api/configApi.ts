import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  ConfigStatus,
  CreateDbConnectionPayload,
  CreateEnvPayload,
  CreateParamPayload,
  DbConnectionItem,
  DbConnectionTestPayload,
  DbConnectionTestResult,
  EnvConfigItem,
  ParamSetItem,
  UpdateDbConnectionStatusPayload,
} from '../model/types'

export interface PageResponse<T> {
  items: T[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface SettingsEnvQuery {
  keyword?: string
  envType?: string
  status?: ConfigStatus
}

export interface SettingsParamQuery {
  keyword?: string
  paramType?: string
  status?: ConfigStatus
}

export interface SettingsDbConnectionQuery {
  keyword?: string
  dbType?: string
  status?: ConfigStatus
}

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function cleanQuery(query?: object) {
  if (!query) {
    return undefined
  }
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '请求失败')
  }
  return payload.data
}

export const configApi = {
  async getSettingsEnvs(workspaceCode = 'ALL', query?: SettingsEnvQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<EnvConfigItem>>>('/settings/envs', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createSettingsEnv(workspaceCode: string, payload: CreateEnvPayload) {
    const response = await httpPost<ApiResponse<EnvConfigItem>, CreateEnvPayload>(
      '/settings/envs',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async updateSettingsEnv(workspaceCode: string, id: number, payload: CreateEnvPayload) {
    const response = await httpPut<ApiResponse<EnvConfigItem>, CreateEnvPayload>(
      `/settings/envs/${id}`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async deleteSettingsEnv(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/envs/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async updateSettingsEnvStatus(workspaceCode: string, id: number, status: ConfigStatus) {
    const response = await httpPut<ApiResponse<EnvConfigItem>, { status: ConfigStatus }>(
      `/settings/envs/${id}/status`,
      { status },
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async getSettingsParams(workspaceCode = 'ALL', query?: SettingsParamQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<ParamSetItem>>>('/settings/params', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createSettingsParam(workspaceCode: string, payload: CreateParamPayload) {
    const response = await httpPost<ApiResponse<ParamSetItem>, CreateParamPayload>(
      '/settings/params',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async updateSettingsParam(workspaceCode: string, id: number, payload: CreateParamPayload) {
    const response = await httpPut<ApiResponse<ParamSetItem>, CreateParamPayload>(
      `/settings/params/${id}`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async deleteSettingsParam(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/params/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getSettingsDbConnections(workspaceCode = 'ALL', query?: SettingsDbConnectionQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<DbConnectionItem>>>('/settings/db-connections', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createSettingsDbConnection(workspaceCode: string, payload: CreateDbConnectionPayload) {
    const response = await httpPost<ApiResponse<DbConnectionItem>, CreateDbConnectionPayload>(
      '/settings/db-connections',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async updateSettingsDbConnection(workspaceCode: string, id: number, payload: CreateDbConnectionPayload) {
    const response = await httpPut<ApiResponse<DbConnectionItem>, CreateDbConnectionPayload>(
      `/settings/db-connections/${id}`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async testSettingsDbConnection(workspaceCode: string, id: number) {
    const response = await httpPost<ApiResponse<DbConnectionTestResult>, DbConnectionTestPayload>(
      '/settings/db-connections/test',
      { id },
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async deleteSettingsDbConnection(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/db-connections/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async updateSettingsDbConnectionStatus(workspaceCode: string, id: number, status: ConfigStatus) {
    const response = await httpPut<ApiResponse<DbConnectionItem>, UpdateDbConnectionStatusPayload>(
      `/settings/db-connections/${id}/status`,
      { status },
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },
}
