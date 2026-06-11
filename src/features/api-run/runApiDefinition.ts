import { apiAutomationApi, type ApiRunPayload } from '@/entities/api-automation'

export function runApiDefinition(workspaceCode: string, id: number, payload?: ApiRunPayload) {
  return apiAutomationApi.debugRunDefinition(workspaceCode, id, {
    workspaceCode: workspaceCode === 'ALL' ? undefined : workspaceCode,
    ...payload,
  })
}
