import { httpGet, httpPost, type ApiResponse } from '@/shared/api/request'

import type { RunnerNodeSummary, RunnerOfflineScanResult } from '../model/types'

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '请求失败')
  }
  return payload.data
}

export const localRunnerApi = {
  async getRunnerNodes() {
    const response = await httpGet<ApiResponse<RunnerNodeSummary[]>>('/local-runner/nodes')
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
