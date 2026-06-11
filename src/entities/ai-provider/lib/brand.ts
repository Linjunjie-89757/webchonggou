import type { AiProviderConnectionItem } from '../model/types'

export type AiProviderBrandTone = 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'default'

export interface AiProviderBrand {
  id: string
  name: string
  shortName: string
  mark: string
  description: string
  tone: AiProviderBrandTone
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
    aliases: ['openai', 'api.openai.com', 'chatgpt', 'gpt-'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    shortName: 'Anthropic',
    mark: 'A',
    description: 'Claude 系列模型',
    tone: 'default',
    aliases: ['anthropic', 'claude'],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    shortName: 'Google',
    mark: 'G',
    description: 'Gemini Pro, Gemini Flash 等模型',
    tone: 'primary',
    aliases: ['google', 'gemini', 'generativelanguage.googleapis.com'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    mark: 'D',
    description: 'DeepSeek Chat, Coder, Reasoner',
    tone: 'primary',
    aliases: ['deepseek'],
  },
  {
    id: 'qwen',
    name: '阿里云 / Qwen',
    shortName: '阿里云',
    mark: 'Q',
    description: '通义千问 Qwen 系列模型',
    tone: 'warning',
    aliases: ['qwen', 'dashscope', 'aliyun', 'aliyuncs', '阿里', '通义'],
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    shortName: 'Azure',
    mark: 'Az',
    description: 'Azure 托管的 OpenAI 模型',
    tone: 'primary',
    aliases: ['azure'],
  },
  {
    id: 'xiaomi',
    name: '小米 / MiMo',
    shortName: '小米',
    mark: 'Mi',
    description: 'MiMo 推理模型',
    tone: 'warning',
    aliases: ['xiaomi', 'mimo', '小米'],
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    shortName: '智谱',
    mark: 'Z',
    description: 'GLM 系列模型',
    tone: 'purple',
    aliases: ['zhipu', 'glm', 'bigmodel', '智谱'],
  },
  {
    id: 'kimi',
    name: 'Kimi',
    shortName: 'Kimi',
    mark: 'K',
    description: 'Moonshot 长文本模型',
    tone: 'default',
    aliases: ['kimi', 'moonshot'],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    shortName: 'MiniMax',
    mark: 'M',
    description: 'MiniMax Text 与 abab 系列',
    tone: 'danger',
    aliases: ['minimax', 'abab'],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    shortName: 'Ollama',
    mark: 'O',
    description: '本地运行的开源大模型',
    tone: 'default',
    aliases: ['ollama', 'llama', 'mistral', 'localhost:11434'],
  },
  {
    id: 'custom',
    name: '自定义',
    shortName: '自定义',
    mark: '*',
    description: '兼容 OpenAI API 规范的模型服务',
    tone: 'default',
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
