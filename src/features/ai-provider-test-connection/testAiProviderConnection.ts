import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'

export async function testAiProviderConnection(provider: AiProviderConnectionItem, workspaceCode = 'ALL') {
  return aiProviderApi.testProviderConnection(workspaceCode, provider.id)
}
