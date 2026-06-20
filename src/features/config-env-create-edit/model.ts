import type { ConfigStatus, CreateEnvPayload, EnvConfigItem } from '@/entities/config'

export type ConfigEnvDialogMode = 'create' | 'edit'

export interface ConfigEnvForm {
  workspaceCode: string
  envType: string
  envName: string
  baseUrl: string
  configJson: string
  browserType: 'CHROMIUM' | 'FIREFOX' | 'WEBKIT'
  headless: boolean
  defaultTimeoutMs: number
  viewportWidth: number
  viewportHeight: number
  ignoreHttpsErrors: boolean
  defaultVariableSetId: number | null
  status: ConfigStatus
}

interface WebUiEnvConfig {
  browserType?: string
  headless?: boolean
  defaultTimeoutMs?: number
  viewport?: {
    width?: number
    height?: number
  }
  ignoreHttpsErrors?: boolean
  defaultVariableSetId?: number | null
}

export function createDefaultConfigEnvForm(workspaceCode = 'ALL'): ConfigEnvForm {
  return {
    workspaceCode,
    envType: 'TEST',
    envName: '',
    baseUrl: '',
    configJson: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    viewportWidth: 1440,
    viewportHeight: 900,
    ignoreHttpsErrors: false,
    defaultVariableSetId: null,
    status: 1,
  }
}

export function createConfigEnvFormFromItem(item: EnvConfigItem): ConfigEnvForm {
  const webUiConfig = parseWebUiEnvConfig(item.configJson)
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    envType: item.envType || 'TEST',
    envName: item.envName,
    baseUrl: item.baseUrl,
    configJson: item.configJson ?? '',
    browserType: normalizeBrowserType(webUiConfig.browserType),
    headless: webUiConfig.headless !== false,
    defaultTimeoutMs: clampNumber(webUiConfig.defaultTimeoutMs, 1000, 60000, 10000),
    viewportWidth: clampNumber(webUiConfig.viewport?.width, 320, 7680, 1440),
    viewportHeight: clampNumber(webUiConfig.viewport?.height, 240, 4320, 900),
    ignoreHttpsErrors: webUiConfig.ignoreHttpsErrors === true,
    defaultVariableSetId: typeof webUiConfig.defaultVariableSetId === 'number' ? webUiConfig.defaultVariableSetId : null,
    status: item.status,
  }
}

export function buildCreateEnvPayload(form: ConfigEnvForm): CreateEnvPayload {
  const configJson = form.envType === 'WEB_UI'
    ? JSON.stringify({
        browserType: form.browserType,
        headless: form.headless,
        defaultTimeoutMs: clampNumber(form.defaultTimeoutMs, 1000, 60000, 10000),
        viewport: {
          width: clampNumber(form.viewportWidth, 320, 7680, 1440),
          height: clampNumber(form.viewportHeight, 240, 4320, 900),
        },
        ignoreHttpsErrors: form.ignoreHttpsErrors,
        defaultVariableSetId: form.defaultVariableSetId,
      })
    : form.configJson.trim()

  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    envType: form.envType,
    envName: form.envName.trim(),
    baseUrl: form.baseUrl.trim(),
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
  return ''
}

function parseWebUiEnvConfig(configJson: string): WebUiEnvConfig {
  if (!configJson?.trim()) {
    return {}
  }
  try {
    return JSON.parse(configJson) as WebUiEnvConfig
  } catch {
    return {}
  }
}

function normalizeBrowserType(value: unknown): ConfigEnvForm['browserType'] {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (normalized === 'FIREFOX' || normalized === 'WEBKIT') {
    return normalized
  }
  return 'CHROMIUM'
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return fallback
  }
  return Math.min(max, Math.max(min, numberValue))
}
