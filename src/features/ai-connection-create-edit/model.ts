import type {
  AiProviderConnectionItem,
  AiProviderStatus,
  AiProviderType,
  SaveAiProviderConnectionPayload,
} from '@/entities/ai-provider'

export type AiConnectionDialogMode = 'create' | 'edit'

export interface AiConnectionForm {
  workspaceCode: string
  providerType: AiProviderType
  connectionName: string
  protocolType: string
  baseUrl: string
  requestTimeoutSeconds: number
  modelName: string
  apiKey: string
  usingSavedApiKey: boolean
  status: AiProviderStatus
}

export const aiConnectionProtocolOptions = [
  { value: 'OPENAI_COMPATIBLE_CHAT', label: 'OpenAI Chat' },
  { value: 'OPENAI_COMPATIBLE_RESPONSES', label: 'OpenAI Responses' },
  { value: 'AZURE_OPENAI', label: 'Azure OpenAI' },
] as const

export const aiConnectionStatusOptions: Array<{ value: AiProviderStatus; label: string }> = [
  { value: 1, label: '启用' },
  { value: 0, label: '停用' },
]

export function createDefaultAiConnectionForm(workspaceCode = 'ALL'): AiConnectionForm {
  return {
    workspaceCode,
    providerType: 'openai',
    connectionName: '',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    baseUrl: '',
    requestTimeoutSeconds: 180,
    modelName: '',
    apiKey: '',
    usingSavedApiKey: false,
    status: 1,
  }
}

export function createAiConnectionFormFromItem(item: AiProviderConnectionItem): AiConnectionForm {
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    providerType: item.providerType,
    connectionName: item.connectionName,
    protocolType: item.protocolType || 'OPENAI_COMPATIBLE_CHAT',
    baseUrl: item.baseUrl,
    requestTimeoutSeconds: item.requestTimeoutSeconds ?? 180,
    modelName: item.modelName ?? '',
    apiKey: item.apiKeyConfigured ? item.apiKeyMasked || '' : '',
    usingSavedApiKey: item.apiKeyConfigured,
    status: item.status,
  }
}

export function buildSaveAiConnectionPayload(
  form: AiConnectionForm,
  options: { includeApiKey: boolean },
): SaveAiProviderConnectionPayload {
  const payload: SaveAiProviderConnectionPayload = {
    workspaceCode: form.workspaceCode.trim() || 'ALL',
    providerType: form.providerType,
    connectionName: form.connectionName.trim(),
    protocolType: form.protocolType,
    baseUrl: form.baseUrl.trim(),
    requestTimeoutSeconds: form.requestTimeoutSeconds,
    modelName: form.modelName.trim(),
    status: form.status,
  }

  if (options.includeApiKey && !form.usingSavedApiKey && form.apiKey.trim()) {
    payload.apiKey = form.apiKey.trim() || null
  }

  return payload
}

export function validateAiConnectionForm(form: AiConnectionForm, mode: AiConnectionDialogMode) {
  if (!form.connectionName.trim()) {
    return '请输入连接名称'
  }
  if (!/^https?:\/\/.+/i.test(form.baseUrl.trim())) {
    return 'Base URL 必须以 http:// 或 https:// 开头'
  }
  if (!form.modelName.trim()) {
    return '请输入模型名称'
  }
  if (mode === 'create' && !form.apiKey.trim()) {
    return '请输入 API Key'
  }
  if (!Number.isFinite(form.requestTimeoutSeconds) || form.requestTimeoutSeconds < 10 || form.requestTimeoutSeconds > 600) {
    return '请求超时时间必须在 10 到 600 秒之间'
  }
  return ''
}
