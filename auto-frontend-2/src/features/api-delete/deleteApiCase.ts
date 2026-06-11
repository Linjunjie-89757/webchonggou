import { apiAutomationApi } from '@/entities/api-automation'

export function deleteApiCase(workspaceCode: string, id: number) {
  return apiAutomationApi.deleteCase(workspaceCode, id)
}
