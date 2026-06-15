import { httpDelete, httpGet, httpPost, httpPut, request, type ApiResponse } from '@/shared/api/request'

import type {
  AiCaseConfigResponse,
  AiGenerationTaskItem,
  AiRequirementAssetItem,
  CreateAiGenerationTaskPayload,
  ImportRequirementDocumentResult,
  SaveAiCaseConfigPayload,
  TestAiCaseConfigResponse,
  UpdateAiGenerationTaskPayload,
  ValidateAiGenerationImageSupportPayload,
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

export const caseAiApi = {
  async getConfig(workspaceCode = 'ALL', targetWorkspaceCode?: string) {
    const payload = await httpGet<ApiResponse<AiCaseConfigResponse>>('/cases/ai/config', {
      headers: workspaceHeaders(workspaceCode),
      params: targetWorkspaceCode ? { targetWorkspaceCode } : undefined,
    })

    return unwrapApiResponse(payload)
  },

  async createConfig(workspaceCode: string, data: SaveAiCaseConfigPayload) {
    const payload = await httpPost<ApiResponse<AiCaseConfigResponse['generatorConfig']>, SaveAiCaseConfigPayload>(
      '/cases/ai/config',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async updateConfig(workspaceCode: string, id: number, data: SaveAiCaseConfigPayload) {
    const payload = await httpPut<ApiResponse<AiCaseConfigResponse['generatorConfig']>, SaveAiCaseConfigPayload>(
      `/cases/ai/config/${id}`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async testConfig(workspaceCode: string, data: SaveAiCaseConfigPayload) {
    const payload = await httpPost<ApiResponse<TestAiCaseConfigResponse>, SaveAiCaseConfigPayload>(
      '/cases/ai/config/test',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async bootstrapFromLegacy(workspaceCode: string) {
    const payload = await httpPost<ApiResponse<AiCaseConfigResponse>, undefined>(
      '/cases/ai/config/bootstrap-from-legacy',
      undefined,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async importRequirementDocument(workspaceCode: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const payload = await httpPost<ApiResponse<ImportRequirementDocumentResult>, FormData>(
      '/cases/ai/requirement-import',
      formData,
      {
        headers: {
          ...workspaceHeaders(workspaceCode),
          'Content-Type': 'multipart/form-data',
        },
      },
    )

    return unwrapApiResponse(payload)
  },

  async uploadAssets(workspaceCode: string, files: File[]) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    const payload = await httpPost<ApiResponse<AiRequirementAssetItem[]>, FormData>(
      '/cases/ai/assets',
      formData,
      {
        headers: {
          ...workspaceHeaders(workspaceCode),
          'Content-Type': 'multipart/form-data',
        },
      },
    )

    return unwrapApiResponse(payload)
  },

  async deleteAsset(workspaceCode: string, id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/cases/ai/assets/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async downloadAsset(workspaceCode: string, id: number) {
    const response = await request.get<Blob>(`/cases/ai/assets/${id}/download`, {
      headers: workspaceHeaders(workspaceCode),
      responseType: 'blob',
    })

    return response.data
  },

  async validateImageSupport(workspaceCode: string, data: ValidateAiGenerationImageSupportPayload) {
    const payload = await httpPost<ApiResponse<null>, ValidateAiGenerationImageSupportPayload>(
      '/cases/ai/tasks/image-support/validate',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async createTask(workspaceCode: string, data: CreateAiGenerationTaskPayload) {
    const payload = await httpPost<ApiResponse<AiGenerationTaskItem>, CreateAiGenerationTaskPayload>(
      '/cases/ai/tasks',
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async listTasks(workspaceCode: string) {
    const payload = await httpGet<ApiResponse<AiGenerationTaskItem[]>>('/cases/ai/tasks', {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async getTask(workspaceCode: string, taskId: string) {
    const payload = await httpGet<ApiResponse<AiGenerationTaskItem>>(`/cases/ai/tasks/${taskId}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async cancelTask(workspaceCode: string, taskId: string) {
    const payload = await httpPost<ApiResponse<AiGenerationTaskItem>, undefined>(
      `/cases/ai/tasks/${taskId}/cancel`,
      undefined,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async retryTask(workspaceCode: string, taskId: string) {
    const payload = await httpPost<ApiResponse<AiGenerationTaskItem>, undefined>(
      `/cases/ai/tasks/${taskId}/retry`,
      undefined,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },

  async deleteTask(workspaceCode: string, taskId: string) {
    const payload = await httpDelete<ApiResponse<null>>(`/cases/ai/tasks/${taskId}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async updateTask(workspaceCode: string, taskId: string, data: UpdateAiGenerationTaskPayload) {
    const payload = await httpPut<ApiResponse<AiGenerationTaskItem>, UpdateAiGenerationTaskPayload>(
      `/cases/ai/tasks/${taskId}`,
      data,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(payload)
  },
}
