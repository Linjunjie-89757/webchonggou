import type {
  AiProviderConnectionItem,
  AiProviderStatus,
  SaveAiProviderConnectionPayload,
} from '@/entities/ai-provider'

export type AiProviderDialogMode = 'create' | 'edit'

export interface AiProviderForm {
  workspaceCode: string
  connectionName: string
  protocolType: string
  baseUrl: string
  requestTimeoutSeconds: number
  modelName: string
  apiKey: string
  status: AiProviderStatus
}

export const aiProviderProtocolOptions = [
  { value: 'OPENAI_COMPATIBLE_CHAT', label: 'OpenAI Chat' },
  { value: 'OPENAI_COMPATIBLE_RESPONSES', label: 'Responses' },
  { value: 'AZURE_OPENAI', label: 'Azure OpenAI' },
] as const

export function createDefaultAiProviderForm(workspaceCode = 'ALL'): AiProviderForm {
  return {
    workspaceCode,
    connectionName: '',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    baseUrl: '',
    requestTimeoutSeconds: 180,
    modelName: '',
    apiKey: '',
    status: 1,
  }
}

export function createAiProviderFormFromItem(item: AiProviderConnectionItem): AiProviderForm {
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    connectionName: item.connectionName,
    protocolType: item.protocolType || 'OPENAI_COMPATIBLE_CHAT',
    baseUrl: item.baseUrl,
    requestTimeoutSeconds: item.requestTimeoutSeconds ?? 180,
    modelName: item.modelName ?? '',
    apiKey: '',
    status: item.status,
  }
}

export function buildSaveAiProviderPayload(
  form: AiProviderForm,
  options: { includeApiKey: boolean },
): SaveAiProviderConnectionPayload {
  const payload: SaveAiProviderConnectionPayload = {
    workspaceCode: form.workspaceCode.trim() || 'ALL',
    connectionName: form.connectionName.trim(),
    protocolType: form.protocolType,
    baseUrl: form.baseUrl.trim(),
    requestTimeoutSeconds: form.requestTimeoutSeconds,
    modelName: form.modelName.trim(),
    status: form.status,
  }

  if (options.includeApiKey) {
    payload.apiKey = form.apiKey.trim() || null
  }

  return payload
}

export function validateAiProviderForm(form: AiProviderForm, mode: AiProviderDialogMode) {
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
  if (!Number.isFinite(form.requestTimeoutSeconds) || form.requestTimeoutSeconds <= 0) {
    return '请求超时时间必须大于 0'
  }
  return ''
}
