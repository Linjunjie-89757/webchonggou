import { apiAutomationApi } from '@/entities/api-automation'

export function deleteApiDefinition(workspaceCode: string, id: number) {
  return apiAutomationApi.deleteDefinition(workspaceCode, id)
}
