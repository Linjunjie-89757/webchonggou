import {
  aiProviderApi,
  type AiProviderConnectionItem,
  type AiProviderStatus,
  type UpdateAiProviderStatusPayload,
} from '@/entities/ai-provider'

function buildStatusPayload(provider: AiProviderConnectionItem, status: AiProviderStatus): UpdateAiProviderStatusPayload {
  return {
    workspaceCode: provider.workspaceCode || 'ALL',
    connectionName: provider.connectionName,
    protocolType: provider.protocolType,
    baseUrl: provider.baseUrl,
    requestTimeoutSeconds: provider.requestTimeoutSeconds,
    modelName: provider.modelName,
    status,
  }
}

export async function toggleAiProviderStatus(provider: AiProviderConnectionItem, workspaceCode = 'ALL') {
  const nextStatus: AiProviderStatus = provider.status === 1 ? 0 : 1
  return aiProviderApi.updateProviderStatus(workspaceCode, provider.id, buildStatusPayload(provider, nextStatus))
}
