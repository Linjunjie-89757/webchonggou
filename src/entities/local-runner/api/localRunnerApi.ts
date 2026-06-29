import { httpGet, httpPost, type ApiResponse } from '@/shared/api/request'

import type { RunnerNodeSummary, RunnerOfflineScanResult } from '../model/types'

export interface RunnerNodeQuery {
  taskType?: string | null
  resourceCost?: number | null
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '请求失败')
  }
  return payload.data
}

export const localRunnerApi = {
  async getRunnerNodes(query: RunnerNodeQuery = {}) {
    const search = new URLSearchParams()
    if (query.taskType) {
      search.set('taskType', query.taskType)
    }
    if (query.resourceCost != null) {
      search.set('resourceCost', String(query.resourceCost))
    }
    const url = search.size > 0 ? `/local-runner/nodes?${search.toString()}` : '/local-runner/nodes'
    const response = await httpGet<ApiResponse<RunnerNodeSummary[]>>(url)
    return unwrapApiResponse(response)
  },

  async triggerOfflineScan(thresholdSeconds = 120) {
    const response = await httpPost<ApiResponse<RunnerOfflineScanResult>, { thresholdSeconds: number }>(
      '/local-runner/tasks/offline-scan',
      { thresholdSeconds },
    )
    return unwrapApiResponse(response)
  },
}
