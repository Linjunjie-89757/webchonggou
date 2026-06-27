import type { ConfigStatus, CreateEnvPayload, EnvConfigItem } from '@/entities/config'

export type ConfigEnvDialogMode = 'create' | 'edit'

export interface ConfigEnvServiceEndpointForm {
  key: string
  name: string
  baseUrl: string
}

export interface ConfigEnvForm {
  workspaceCode: string
  envType: string
  envName: string
  baseUrl: string
  defaultServiceKey: string
  services: ConfigEnvServiceEndpointForm[]
  configJson: string
  description: string
  browserType: 'CHROMIUM' | 'FIREFOX' | 'WEBKIT'
  headless: boolean
  defaultTimeoutMs: number
  viewportWidth: number
  viewportHeight: number
  ignoreHttpsErrors: boolean
  defaultVariableSetId: number | null
  mockApplicationId: number | null
  status: ConfigStatus
}

interface WebUiEnvConfig {
  envGroup?: string
  description?: string
  defaultServiceKey?: string
  services?: Array<{
    key?: unknown
    name?: unknown
    baseUrl?: unknown
  }>
  browserType?: string
  headless?: boolean
  defaultTimeoutMs?: number
  viewport?: {
    width?: number
    height?: number
  }
  ignoreHttpsErrors?: boolean
  defaultVariableSetId?: number | null
  mockApplicationId?: number | null
}

export function createDefaultConfigEnvForm(workspaceCode = 'ALL'): ConfigEnvForm {
  return {
    workspaceCode,
    envType: 'TEST',
    envName: '',
    baseUrl: '',
    defaultServiceKey: 'default',
    services: [createDefaultServiceEndpoint()],
    configJson: '',
    description: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    viewportWidth: 1440,
    viewportHeight: 900,
    ignoreHttpsErrors: false,
    defaultVariableSetId: null,
    mockApplicationId: null,
    status: 1,
  }
}

export function createConfigEnvFormFromItem(item: EnvConfigItem): ConfigEnvForm {
  const envConfig = parseEnvConfig(item.configJson)
  const services = normalizeServiceEndpoints(envConfig.services, item.baseUrl)
  const defaultServiceKey = normalizeDefaultServiceKey(envConfig.defaultServiceKey, services)
  const defaultService = services.find(service => service.key === defaultServiceKey) ?? services[0]
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    envType: normalizeEnvGroup(envConfig.envGroup ?? item.envType),
    envName: item.envName,
    baseUrl: defaultService?.baseUrl || item.baseUrl,
    defaultServiceKey,
    services,
    configJson: item.configJson ?? '',
    description: envConfig.description || '',
    browserType: normalizeBrowserType(envConfig.browserType),
    headless: envConfig.headless !== false,
    defaultTimeoutMs: clampNumber(envConfig.defaultTimeoutMs ?? envConfig.timeoutMs, 1000, 60000, 10000),
    viewportWidth: clampNumber(envConfig.viewport?.width, 320, 7680, 1440),
    viewportHeight: clampNumber(envConfig.viewport?.height, 240, 4320, 900),
    ignoreHttpsErrors: envConfig.ignoreHttpsErrors === true || envConfig.ignoreSsl === true,
    defaultVariableSetId: typeof envConfig.defaultVariableSetId === 'number' ? envConfig.defaultVariableSetId : null,
    mockApplicationId: typeof envConfig.mockApplicationId === 'number' ? envConfig.mockApplicationId : null,
    status: item.status,
  }
}

export function buildCreateEnvPayload(form: ConfigEnvForm): CreateEnvPayload {
  const services = normalizeServiceEndpoints(form.services, form.baseUrl)
  const defaultServiceKey = normalizeDefaultServiceKey(form.defaultServiceKey, services)
  const defaultService = services.find(service => service.key === defaultServiceKey) ?? services[0]
  const configJson = JSON.stringify({
    envGroup: normalizeEnvGroup(form.envType),
    description: form.description.trim(),
    defaultServiceKey,
    services,
    timeoutMs: clampNumber(form.defaultTimeoutMs, 1000, 60000, 10000),
    ignoreSsl: form.ignoreHttpsErrors,
    defaultVariableSetId: form.defaultVariableSetId,
    mockApplicationId: form.mockApplicationId,
  })

  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    envType: normalizeEnvGroup(form.envType),
    envName: form.envName.trim(),
    baseUrl: defaultService?.baseUrl.trim() || form.baseUrl.trim(),
    configJson,
    status: form.status,
  }
}

export function validateConfigEnvForm(form: ConfigEnvForm) {
  if (!form.envName.trim()) {
    return '请输入环境名称'
  }
  if (!form.baseUrl.trim()) {
    return '请输入 Base URL'
  }
  if (!/^https?:\/\//i.test(form.baseUrl.trim())) {
    return 'Base URL 必须以 http:// 或 https:// 开头'
  }
  const services = normalizeServiceEndpoints(form.services, form.baseUrl)
  const serviceKeys = new Set<string>()
  for (const service of services) {
    if (!service.key.trim()) {
      return '请输入服务标识'
    }
    if (serviceKeys.has(service.key)) {
      return '服务标识不能重复'
    }
    serviceKeys.add(service.key)
    if (!/^https?:\/\//i.test(service.baseUrl)) {
      return '服务地址必须以 http:// 或 https:// 开头'
    }
  }
  return ''
}

function parseEnvConfig(configJson: string): WebUiEnvConfig & {
  timeoutMs?: number
  ignoreSsl?: boolean
} {
  if (!configJson?.trim()) {
    return {}
  }
  try {
    return JSON.parse(configJson) as WebUiEnvConfig & {
      timeoutMs?: number
      ignoreSsl?: boolean
    }
  } catch {
    return { description: configJson.trim() }
  }
}

function normalizeBrowserType(value: unknown): ConfigEnvForm['browserType'] {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (normalized === 'FIREFOX' || normalized === 'WEBKIT') {
    return normalized
  }
  return 'CHROMIUM'
}

function normalizeEnvGroup(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (normalized === 'STAGING' || normalized === 'PROD' || normalized === 'SANDBOX') {
    return normalized
  }
  return 'TEST'
}

function normalizeServiceEndpoints(value: unknown, fallbackBaseUrl: string) {
  const endpoints = Array.isArray(value)
    ? value
      .filter((item): item is { key?: unknown; name?: unknown; baseUrl?: unknown } => typeof item === 'object' && item !== null)
      .map((item, index) => ({
        key: normalizeServiceKey(item.key, index),
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : normalizeServiceKey(item.key, index),
        baseUrl: typeof item.baseUrl === 'string' ? item.baseUrl.trim() : '',
      }))
      .filter(item => item.key && item.baseUrl)
    : []

  if (endpoints.length > 0) {
    return endpoints
  }

  return [{
    ...createDefaultServiceEndpoint(),
    baseUrl: fallbackBaseUrl.trim(),
  }]
}

function normalizeDefaultServiceKey(value: unknown, services: ConfigEnvServiceEndpointForm[]) {
  const key = typeof value === 'string' ? value.trim() : ''
  if (key && services.some(service => service.key === key)) {
    return key
  }
  return services[0]?.key ?? 'default'
}

function normalizeServiceKey(value: unknown, index: number) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || (index === 0 ? 'default' : `service-${index + 1}`)
}

export function createDefaultServiceEndpoint(): ConfigEnvServiceEndpointForm {
  return {
    key: 'default',
    name: '默认服务',
    baseUrl: '',
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return fallback
  }
  return Math.min(max, Math.max(min, numberValue))
}
