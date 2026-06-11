import { apiAutomationApi, type ApiRunPayload } from '@/entities/api-automation'

export function runApiCase(workspaceCode: string, id: number, payload?: ApiRunPayload) {
  return apiAutomationApi.runCase(workspaceCode, id, {
    workspaceCode: workspaceCode === 'ALL' ? undefined : workspaceCode,
    ...payload,
  })
}
