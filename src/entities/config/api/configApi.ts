import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  ConfigReferenceSummary,
  ConfigStatus,
  CreateMockApplicationPayload,
  CreateMockEndpointPayload,
  CreateMockScenarioPayload,
  CreateDbConnectionPayload,
  CreateEnvPayload,
  CreateParamPayload,
  DbConnectionItem,
  DbConnectionTestPayload,
  DbConnectionTestResult,
  EnvConfigItem,
  MockApplicationItem,
  MockCallLogItem,
  MockEndpointItem,
  MockScenarioItem,
  ParamSetChangeHistoryItem,
  ParamSetItem,
  ParamSetVersionItem,
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

export interface SettingsMockApplicationQuery {
  keyword?: string
  status?: ConfigStatus
}

export interface SettingsMockEndpointQuery {
  appId?: number
  keyword?: string
  status?: ConfigStatus
}

export interface SettingsMockScenarioQuery {
  endpointId?: number
  keyword?: string
  status?: ConfigStatus
}

export interface SettingsMockCallLogQuery {
  appId?: number
  scenarioId?: number
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

  async getSettingsEnvReferences(workspaceCode: string, id: number) {
    const response = await httpGet<ApiResponse<ConfigReferenceSummary>>(`/settings/envs/${id}/references`, {
      headers: workspaceHeaders(workspaceCode),
    })

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

  async getSettingsParamReferences(workspaceCode: string, id: number) {
    const response = await httpGet<ApiResponse<ConfigReferenceSummary>>(`/settings/params/${id}/references`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getSettingsParamChangeHistory(workspaceCode: string, id: number) {
    const response = await httpGet<ApiResponse<PageResponse<ParamSetChangeHistoryItem>>>(`/settings/params/${id}/change-history`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getSettingsParamVersions(workspaceCode: string, id: number) {
    const response = await httpGet<ApiResponse<PageResponse<ParamSetVersionItem>>>(`/settings/params/${id}/versions`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async rollbackSettingsParamVersion(workspaceCode: string, id: number, versionId: number) {
    const response = await httpPost<ApiResponse<ParamSetItem>, undefined>(
      `/settings/params/${id}/versions/${versionId}/rollback`,
      undefined,
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

  async getMockApplications(workspaceCode = 'ALL', query?: SettingsMockApplicationQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<MockApplicationItem>>>('/settings/mock/applications', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createMockApplication(workspaceCode: string, payload: CreateMockApplicationPayload) {
    const response = await httpPost<ApiResponse<MockApplicationItem>, CreateMockApplicationPayload>(
      '/settings/mock/applications',
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async updateMockApplication(workspaceCode: string, id: number, payload: CreateMockApplicationPayload) {
    const response = await httpPut<ApiResponse<MockApplicationItem>, CreateMockApplicationPayload>(
      `/settings/mock/applications/${id}`,
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async deleteMockApplication(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/mock/applications/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getMockApplicationReferences(workspaceCode: string, id: number) {
    const response = await httpGet<ApiResponse<ConfigReferenceSummary>>(`/settings/mock/applications/${id}/references`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getMockEndpoints(workspaceCode = 'ALL', query?: SettingsMockEndpointQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<MockEndpointItem>>>('/settings/mock/endpoints', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createMockEndpoint(workspaceCode: string, payload: CreateMockEndpointPayload) {
    const response = await httpPost<ApiResponse<MockEndpointItem>, CreateMockEndpointPayload>(
      '/settings/mock/endpoints',
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async updateMockEndpoint(workspaceCode: string, id: number, payload: CreateMockEndpointPayload) {
    const response = await httpPut<ApiResponse<MockEndpointItem>, CreateMockEndpointPayload>(
      `/settings/mock/endpoints/${id}`,
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async deleteMockEndpoint(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/mock/endpoints/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getMockScenarios(workspaceCode = 'ALL', query?: SettingsMockScenarioQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<MockScenarioItem>>>('/settings/mock/scenarios', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createMockScenario(workspaceCode: string, payload: CreateMockScenarioPayload) {
    const response = await httpPost<ApiResponse<MockScenarioItem>, CreateMockScenarioPayload>(
      '/settings/mock/scenarios',
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async updateMockScenario(workspaceCode: string, id: number, payload: CreateMockScenarioPayload) {
    const response = await httpPut<ApiResponse<MockScenarioItem>, CreateMockScenarioPayload>(
      `/settings/mock/scenarios/${id}`,
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async deleteMockScenario(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/mock/scenarios/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getMockCallLogs(workspaceCode = 'ALL', query?: SettingsMockCallLogQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<MockCallLogItem>>>('/settings/mock/call-logs', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },
}
