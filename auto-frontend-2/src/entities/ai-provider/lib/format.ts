import type { AiProviderConnectionItem } from '../model/types'

export function getAiProviderStatusMeta(provider: Pick<AiProviderConnectionItem, 'status' | 'lastVerifiedAt'>) {
  if (provider.status === 0) {
    return { label: '连接异常', tone: 'danger' as const }
  }
  if (provider.lastVerifiedAt) {
    return { label: '已连接', tone: 'success' as const }
  }
  return { label: '未测试', tone: 'warning' as const }
}

export function getAiProviderProtocolLabel(protocolType: string) {
  const labels: Record<string, string> = {
    OPENAI_COMPATIBLE_CHAT: 'OpenAI Chat',
    OPENAI_COMPATIBLE_RESPONSES: 'OpenAI Responses',
    AZURE_OPENAI: 'Azure OpenAI',
  }
  return labels[protocolType] ?? (protocolType || '-')
}

export function getAiProviderEndpointSummary(baseUrl: string) {
  try {
    const url = new URL(baseUrl)
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return baseUrl || '-'
  }
}

export function formatAiProviderDate(value: string | null) {
  if (!value) {
    return '-'
  }
  return value.replace('T', ' ').slice(0, 16)
}
