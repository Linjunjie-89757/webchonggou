import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  BatchUpdateCasesPayload,
  BatchUpdateCasesResult,
  BatchDeleteCasesPayload,
  BatchMoveCasesPayload,
  CaseDetail,
  CaseDirectoryWorkspace,
  CreateCaseDirectoryPayload,
  CaseListQuery,
  MoveCaseDirectoryPayload,
  RenameCaseDirectoryPayload,
  ReviewCasePayload,
  ReviewCaseResult,
  RunCasePayload,
  RunCaseResult,
  SaveCasePayload,
  CaseSummaryItem,
  PageResponse,
} from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function cleanQuery(query?: CaseListQuery) {
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

export const caseApi = {
  async getCases(workspaceCode = 'ALL', query?: CaseListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<CaseSummaryItem>>>('/cases', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async getCaseDirectories(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<CaseDirectoryWorkspace[]>>('/cases/directories', {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async createCaseDirectory(workspaceCode = 'ALL', payload: CreateCaseDirectoryPayload) {
    const response = await httpPost<ApiResponse<CaseDirectoryWorkspace>, CreateCaseDirectoryPayload>(
      '/cases/directories',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async renameCaseDirectory(id: number, workspaceCode = 'ALL', payload: RenameCaseDirectoryPayload) {
    const response = await httpPut<ApiResponse<CaseDirectoryWorkspace>, RenameCaseDirectoryPayload>(
      `/cases/directories/${id}`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async moveCaseDirectory(id: number, workspaceCode = 'ALL', payload: MoveCaseDirectoryPayload) {
    const response = await httpPost<ApiResponse<CaseDirectoryWorkspace>, MoveCaseDirectoryPayload>(
      `/cases/directories/${id}/move`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async deleteCaseDirectory(id: number, workspaceCode = 'ALL') {
    const response = await httpDelete<ApiResponse<null>>(`/cases/directories/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getCaseDetail(id: number, workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<CaseDetail>>(`/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async createCase(workspaceCode = 'ALL', payload: SaveCasePayload) {
    const response = await httpPost<ApiResponse<CaseSummaryItem>, SaveCasePayload>('/cases', payload, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async updateCase(id: number, workspaceCode = 'ALL', payload: SaveCasePayload) {
    const response = await httpPut<ApiResponse<CaseSummaryItem>, SaveCasePayload>(`/cases/${id}`, payload, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async updateCaseStatus(id: number, workspaceCode = 'ALL', payload: SaveCasePayload) {
    return this.updateCase(id, workspaceCode, payload)
  },

  async deleteCase(id: number, workspaceCode = 'ALL') {
    const response = await httpDelete<ApiResponse<null>>(`/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async runCase(id: number, workspaceCode = 'ALL', payload: RunCasePayload) {
    const response = await httpPost<ApiResponse<RunCaseResult>, RunCasePayload>(`/cases/${id}/execute`, payload, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async reviewCase(id: number, workspaceCode = 'ALL', payload: ReviewCasePayload) {
    const response = await httpPost<ApiResponse<ReviewCaseResult>, ReviewCasePayload>(`/cases/${id}/review`, payload, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async batchUpdateCases(workspaceCode = 'ALL', payload: BatchUpdateCasesPayload) {
    const response = await httpPost<ApiResponse<BatchUpdateCasesResult>, BatchUpdateCasesPayload>(
      '/cases/batch/update',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async batchMoveCases(workspaceCode = 'ALL', payload: BatchMoveCasesPayload) {
    const response = await httpPost<ApiResponse<BatchUpdateCasesResult>, BatchMoveCasesPayload>(
      '/cases/batch/move',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async batchDeleteCases(workspaceCode = 'ALL', payload: BatchDeleteCasesPayload) {
    const response = await httpPost<ApiResponse<BatchUpdateCasesResult>, BatchDeleteCasesPayload>(
      '/cases/batch/delete',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },
}
