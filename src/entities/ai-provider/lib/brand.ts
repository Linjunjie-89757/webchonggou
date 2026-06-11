import type { AiProviderConnectionItem } from '../model/types'

export type AiProviderBrandTone = 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'default'

export interface AiProviderBrand {
  id: string
  name: string
  shortName: string
  mark: string
  description: string
  tone: AiProviderBrandTone
  baseUrl: string
  protocolType: string
  models: string[]
  aliases: string[]
}

export const aiProviderBrands: AiProviderBrand[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    shortName: 'OpenAI',
    mark: 'AI',
    description: 'GPT-4o, GPT-4 Turbo 等模型',
    tone: 'success',
    baseUrl: 'https://api.openai.com/v1',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    aliases: ['openai', 'api.openai.com', 'chatgpt', 'gpt-'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    shortName: 'Anthropic',
    mark: 'A',
    description: 'Claude 系列模型',
    tone: 'default',
    baseUrl: 'https://api.anthropic.com',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    aliases: ['anthropic', 'claude'],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    shortName: 'Google',
    mark: 'G',
    description: 'Gemini Pro, Gemini Flash 等模型',
    tone: 'primary',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
    aliases: ['google', 'gemini', 'generativelanguage.googleapis.com'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    mark: 'D',
    description: 'DeepSeek Chat, Coder, Reasoner',
    tone: 'primary',
    baseUrl: 'https://api.deepseek.com/v1',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    aliases: ['deepseek'],
  },
  {
    id: 'qwen',
    name: '阿里云 / Qwen',
    shortName: '阿里云',
    mark: 'Q',
    description: '通义千问 Qwen 系列模型',
    tone: 'warning',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    aliases: ['qwen', 'dashscope', 'aliyun', 'aliyuncs', '阿里', '通义'],
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    shortName: 'Azure',
    mark: 'Az',
    description: 'Azure 托管的 OpenAI 模型',
    tone: 'primary',
    baseUrl: 'https://{resource}.openai.azure.com',
    protocolType: 'AZURE_OPENAI',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo'],
    aliases: ['azure'],
  },
  {
    id: 'xiaomi',
    name: '小米 / MiMo',
    shortName: '小米',
    mark: 'Mi',
    description: 'MiMo 推理模型',
    tone: 'warning',
    baseUrl: 'https://api.mimo.xiaomi.com/v1',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: ['mimo-7b', 'mimo-7b-rl'],
    aliases: ['xiaomi', 'mimo', '小米'],
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    shortName: '智谱',
    mark: 'Z',
    description: 'GLM 系列模型',
    tone: 'purple',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: ['glm-4', 'glm-4-flash', 'glm-4-air'],
    aliases: ['zhipu', 'glm', 'bigmodel', '智谱'],
  },
  {
    id: 'kimi',
    name: 'Kimi',
    shortName: 'Kimi',
    mark: 'K',
    description: 'Moonshot 长文本模型',
    tone: 'default',
    baseUrl: 'https://api.moonshot.cn/v1',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    aliases: ['kimi', 'moonshot'],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    shortName: 'MiniMax',
    mark: 'M',
    description: 'MiniMax Text 与 abab 系列',
    tone: 'danger',
    baseUrl: 'https://api.minimax.chat/v1',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: ['abab6.5s-chat', 'abab6.5-chat', 'abab5.5-chat'],
    aliases: ['minimax', 'abab'],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    shortName: 'Ollama',
    mark: 'O',
    description: '本地运行的开源大模型',
    tone: 'default',
    baseUrl: 'http://localhost:11434/v1',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: ['llama3', 'mistral', 'codellama', 'qwen2'],
    aliases: ['ollama', 'llama', 'mistral', 'localhost:11434'],
  },
  {
    id: 'custom',
    name: '自定义',
    shortName: '自定义',
    mark: '*',
    description: '兼容 OpenAI API 规范的模型服务',
    tone: 'default',
    baseUrl: 'https://your-api-endpoint/v1',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: [],
    aliases: ['custom', '自定义'],
  },
]

export function getAiProviderSearchText(provider: AiProviderConnectionItem) {
  return `${provider.connectionName} ${provider.baseUrl} ${provider.modelName ?? ''}`.toLowerCase()
}

export function inferAiProviderBrand(provider: AiProviderConnectionItem) {
  const source = getAiProviderSearchText(provider)

  return (
    aiProviderBrands.find((brand) => brand.aliases.some((alias) => source.includes(alias.toLowerCase()))) ??
    aiProviderBrands.find((brand) => brand.id === 'custom') ??
    aiProviderBrands[0]
  )
}

export function hasAiProviderBrandConnection(brand: AiProviderBrand, providers: AiProviderConnectionItem[]) {
  return providers.some((provider) => inferAiProviderBrand(provider).id === brand.id)
}

export function getAiProviderBrandInitial(provider: AiProviderConnectionItem) {
  return provider.connectionName.trim().slice(0, 1) || inferAiProviderBrand(provider).mark
}
