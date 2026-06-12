import type { AiProviderConnectionItem } from '../model/types'
import anthropicLogo from '../assets/anthropic.svg'
import azureLogo from '../assets/azure.svg'
import customLogo from '../assets/custom.svg'
import deepseekLogo from '../assets/deepseek.svg'
import googleLogo from '../assets/google.svg'
import kimiLogo from '../assets/kimi.svg'
import minimaxLogo from '../assets/minimax.svg'
import ollamaLogo from '../assets/ollama.svg'
import openaiLogo from '../assets/openai.svg'
import qwenLogo from '../assets/qwen.svg'
import xiaomiLogo from '../assets/xiaomi.svg'
import zhipuLogo from '../assets/zhipu.svg'

export type AiProviderBrandTone = 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'default'

export interface AiProviderBrand {
  id: string
  name: string
  shortName: string
  mark: string
  description: string
  tone: AiProviderBrandTone
  bg: string
  text: string
  logoClass: string
  logoSrc: string
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
    bg: '#e3f5f0',
    text: '#10a37f',
    logoClass: 'provider-logo-openai',
    logoSrc: openaiLogo,
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
    bg: '#f5ede8',
    text: '#c05f36',
    logoClass: 'provider-logo-anthropic',
    logoSrc: anthropicLogo,
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
    bg: '#f8fafc',
    text: '#64748b',
    logoClass: 'provider-logo-google',
    logoSrc: googleLogo,
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
    bg: '#eef2ff',
    text: '#1c3ef0',
    logoClass: 'provider-logo-deepseek',
    logoSrc: deepseekLogo,
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
    bg: '#fff7ed',
    text: '#fb923c',
    logoClass: 'provider-logo-qwen',
    logoSrc: qwenLogo,
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
    bg: '#f8fafc',
    text: '#93c5fd',
    logoClass: 'provider-logo-azure',
    logoSrc: azureLogo,
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
    bg: '#f8fafc',
    text: '#94a3b8',
    logoClass: 'provider-logo-xiaomi',
    logoSrc: xiaomiLogo,
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
    bg: '#f8fafc',
    text: '#94a3b8',
    logoClass: 'provider-logo-zhipu',
    logoSrc: zhipuLogo,
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
    bg: '#f8fafc',
    text: '#94a3b8',
    logoClass: 'provider-logo-kimi',
    logoSrc: kimiLogo,
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
    bg: '#f8fafc',
    text: '#94a3b8',
    logoClass: 'provider-logo-minimax',
    logoSrc: minimaxLogo,
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
    bg: '#f8fafc',
    text: '#94a3b8',
    logoClass: 'provider-logo-ollama',
    logoSrc: ollamaLogo,
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
    bg: '#f8fafc',
    text: '#94a3b8',
    logoClass: 'provider-logo-custom',
    logoSrc: customLogo,
    baseUrl: 'https://your-api-endpoint/v1',
    protocolType: 'OPENAI_COMPATIBLE_CHAT',
    models: [],
    aliases: ['custom', '自定义'],
  },
]

export function getAiProviderSearchText(provider: AiProviderConnectionItem) {
  return `${provider.connectionName} ${provider.baseUrl} ${provider.modelName ?? ''}`.toLowerCase()
}

function getCustomProviderIntentText(provider: AiProviderConnectionItem) {
  return `${provider.connectionName} ${provider.baseUrl}`.toLowerCase()
}

function hasCustomProviderIntent(provider: AiProviderConnectionItem) {
  const source = getCustomProviderIntentText(provider)
  const customSignals = [
    'custom',
    '自定义',
    '中转',
    '代理',
    '网关',
    '转发',
    'proxy',
    'gateway',
    'relay',
  ]

  return customSignals.some((signal) => source.includes(signal))
}

export function inferAiProviderBrand(provider: AiProviderConnectionItem) {
  const customBrand = aiProviderBrands.find((brand) => brand.id === 'custom')

  if (customBrand && hasCustomProviderIntent(provider)) {
    return customBrand
  }

  const source = getAiProviderSearchText(provider)

  return (
    aiProviderBrands.find((brand) => brand.aliases.some((alias) => source.includes(alias.toLowerCase()))) ??
    customBrand ??
    aiProviderBrands[0]
  )
}

export function hasAiProviderBrandConnection(brand: AiProviderBrand, providers: AiProviderConnectionItem[]) {
  return providers.some((provider) => inferAiProviderBrand(provider).id === brand.id)
}

export function getAiProviderBrandInitial(provider: AiProviderConnectionItem) {
  return provider.connectionName.trim().slice(0, 1) || inferAiProviderBrand(provider).mark
}
