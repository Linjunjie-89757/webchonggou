import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'

export async function syncAiProviderModels(provider: AiProviderConnectionItem, workspaceCode = 'ALL') {
  return aiProviderApi.syncProviderModels(workspaceCode, provider.id)
}
