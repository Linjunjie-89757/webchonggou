import type { DbConnectionItem, EnvConfigItem, ParamSetItem } from '../model/types'

export function isProductionEnv(item: Pick<EnvConfigItem, 'envType' | 'envName' | 'configJson'>) {
  const envGroup = getEnvGroup(item)
  const text = `${envGroup} ${item.envType} ${item.envName} ${item.configJson ?? ''}`.toLowerCase()
  return text.includes('prod') || text.includes('生产')
}

export function getEnvVisualMeta(item: Pick<EnvConfigItem, 'envType' | 'envName' | 'configJson'>) {
  const envGroup = getEnvGroup(item)
  const text = `${envGroup} ${item.envType} ${item.envName} ${item.configJson ?? ''}`.toLowerCase()
  if (envGroup === 'SANDBOX' || text.includes('sandbox') || text.includes('沙箱')) {
    return {
      typeLabel: '沙箱环境',
      tone: 'purple' as const,
      description: getEnvDescription(item.configJson, '沙箱联调和支付验证环境'),
    }
  }
  if (text.includes('prod') || text.includes('生产')) {
    return {
      typeLabel: '生产环境',
      tone: 'danger' as const,
      description: getEnvDescription(item.configJson, '正式生产环境（谨慎操作）'),
    }
  }
  if (text.includes('staging') || text.includes('stage') || text.includes('预发')) {
    return {
      typeLabel: '预发布环境',
      tone: 'warning' as const,
      description: getEnvDescription(item.configJson, '上线前验证环境'),
    }
  }
  return {
    typeLabel: '测试环境',
    tone: 'primary' as const,
    description: getEnvDescription(item.configJson, '开发和测试使用的环境'),
  }
}

export function getEnvDescription(configJson: string, fallback: string) {
  const raw = configJson?.trim()
  if (!raw) {
    return fallback
  }
  try {
    const parsed = JSON.parse(raw) as {
      description?: unknown
      desc?: unknown
      remark?: unknown
    }
    const description = parsed.description ?? parsed.desc ?? parsed.remark
    if (typeof description === 'string' && description.trim()) {
      return description.trim()
    }
  } catch {
    if (!raw.startsWith('{') && !raw.startsWith('[')) {
      return raw
    }
  }
  return fallback
}

export function getEnvServiceSummary(item: Pick<EnvConfigItem, 'baseUrl' | 'configJson'>) {
  const parsed = parseEnvConfigObject(item.configJson)
  const services = getEnvServiceDetails(item)
  const defaultServiceKey = typeof parsed?.defaultServiceKey === 'string' ? parsed.defaultServiceKey.trim() : ''
  const defaultService = services.find(service => service.key === defaultServiceKey) ?? services[0]

  return {
    defaultLabel: defaultService?.name || defaultService?.key || '默认服务',
    defaultBaseUrl: defaultService?.baseUrl || item.baseUrl,
    serviceCount: services.length || 1,
  }
}

export function getEnvServiceDetails(item: Pick<EnvConfigItem, 'baseUrl' | 'configJson'>) {
  const parsed = parseEnvConfigObject(item.configJson)
  const services = Array.isArray(parsed?.services)
    ? parsed.services
      .filter((service): service is { key?: unknown; name?: unknown; baseUrl?: unknown } => typeof service === 'object' && service !== null)
      .map(service => ({
        key: typeof service.key === 'string' ? service.key.trim() : '',
        name: typeof service.name === 'string' ? service.name.trim() : '',
        baseUrl: typeof service.baseUrl === 'string' ? service.baseUrl.trim() : '',
      }))
      .filter(service => service.key && service.baseUrl)
    : []
  const defaultServiceKey = typeof parsed?.defaultServiceKey === 'string' ? parsed.defaultServiceKey.trim() : ''
  const normalized = services.length > 0
    ? services
    : [{ key: 'default', name: '默认服务', baseUrl: item.baseUrl }]

  return normalized.map((service, index) => ({
    ...service,
    name: service.name || service.key || `服务 ${index + 1}`,
    isDefault: defaultServiceKey ? service.key === defaultServiceKey : index === 0,
  }))
}

export function getEnvDefaultVariableSetId(item: Pick<EnvConfigItem, 'configJson'>) {
  return readNumericEnvConfig(item.configJson, 'defaultVariableSetId')
}

export function getEnvMockApplicationId(item: Pick<EnvConfigItem, 'configJson'>) {
  return readNumericEnvConfig(item.configJson, 'mockApplicationId')
}

export function getEnvTimeoutMs(item: Pick<EnvConfigItem, 'configJson'>) {
  return readNumericEnvConfig(item.configJson, 'timeoutMs') ?? readNumericEnvConfig(item.configJson, 'defaultTimeoutMs')
}

export function getEnvBuiltInVariableHints(item: Pick<EnvConfigItem, 'baseUrl' | 'configJson'>) {
  const services = getEnvServiceDetails(item)
  const serviceKeys = services.map(service => service.key).filter(Boolean)
  return [
    'BASE_URL',
    'DEFAULT_SERVICE_URL',
    'DEFAULT_SERVICE_KEY',
    ...serviceKeys,
  ]
}

export function getParamCategory(item: Pick<ParamSetItem, 'paramType' | 'paramName'>) {
  const text = `${item.paramType} ${item.paramName}`.toLowerCase()
  if (item.paramType === 'APP_UI_VARIABLE_SET') {
    return 'appUi'
  }
  if (item.paramType === 'WEB_UI_VARIABLE_SET') {
    return 'webUi'
  }
  if (item.paramType === 'PAYMENT_CHANNEL' || ['payment', 'pay', 'wechat', 'alipay', '支付', '微信', '支付宝'].some((keyword) => text.includes(keyword))) {
    return 'payment'
  }
  if (item.paramType === 'BUSINESS' || ['business', '业务'].some((keyword) => text.includes(keyword))) {
    return 'business'
  }
  if (item.paramType === 'API_VARIABLE_SET' || item.paramType === 'API' || ['header', 'body', 'query', 'api'].some((keyword) => text.includes(keyword))) {
    return 'api'
  }
  return 'global'
}

export function getParamTypeMeta(item: Pick<ParamSetItem, 'paramType' | 'paramName'>) {
  const category = getParamCategory(item)
  if (category === 'appUi') {
    return { label: 'APP UI变量', tone: 'purple' as const }
  }
  if (category === 'webUi') {
    return { label: 'Web UI变量', tone: 'purple' as const }
  }
  if (category === 'api') {
    return { label: '接口变量', tone: 'purple' as const }
  }
  if (category === 'payment') {
    return { label: '支付渠道变量集', tone: 'warning' as const }
  }
  if (category === 'business') {
    return { label: '通用业务变量', tone: 'success' as const }
  }
  return { label: '全局公共变量', tone: 'primary' as const }
}

export function parseParamContent(contentJson: string) {
  const raw = contentJson?.trim() ?? ''
  if (!raw) {
    return { value: '', description: '', sensitive: false }
  }
  try {
    const parsed = JSON.parse(raw) as {
      value?: unknown
      description?: unknown
      desc?: unknown
      sensitive?: unknown
      isSecret?: unknown
    }
    const value = typeof parsed.value === 'string' ? parsed.value : raw
    const description =
      typeof parsed.description === 'string'
        ? parsed.description
        : typeof parsed.desc === 'string'
          ? parsed.desc
          : ''
    return {
      value,
      description,
      sensitive: parsed.sensitive === true || parsed.isSecret === true,
    }
  } catch {
    return { value: raw, description: '', sensitive: false }
  }
}

export function getParamValueText(item: Pick<ParamSetItem, 'contentJson' | 'paramType'>) {
  const variables = isVariableSetType(item.paramType) ? parseVariableSummary(item.contentJson) : []
  if (isVariableSetType(item.paramType)) {
    return `${variables.length} 个变量`
  }

  const parsed = parseParamContent(item.contentJson)
  if (parsed.sensitive && parsed.value) {
    return '••••••••'
  }
  return parsed.value || '-'
}

export function getParamDescriptionText(item: Pick<ParamSetItem, 'contentJson' | 'paramType'>) {
  if (isVariableSetType(item.paramType)) {
    const variables = parseVariableSummary(item.contentJson)
    if (variables.length > 0) {
      return `包含 ${variables.slice(0, 3).join('、')}${variables.length > 3 ? ' 等' : ''}`
    }
    if (item.paramType === 'GLOBAL') {
      return '所有环境默认生效，优先级最低'
    }
    if (item.paramType === 'BUSINESS') {
      return '接口和 UI 可复用的业务变量集'
    }
    if (item.paramType === 'PAYMENT_CHANNEL') {
      return '微信、支付宝、沙箱支付等渠道参数'
    }
    if (item.paramType === 'APP_UI_VARIABLE_SET') {
      return 'APP UI 自动化专用变量'
    }
    return item.paramType === 'WEB_UI_VARIABLE_SET' ? 'Web UI 自动化专用变量' : '接口自动化专用变量'
  }

  const parsed = parseParamContent(item.contentJson)
  return parsed.description || item.paramType || '-'
}

function getEnvGroup(item: Pick<EnvConfigItem, 'envType' | 'configJson'>) {
  const parsed = parseEnvConfigObject(item.configJson)
  if (parsed) {
    if (typeof parsed.envGroup === 'string' && parsed.envGroup.trim()) {
      return parsed.envGroup.trim().toUpperCase()
    }
  }
  return item.envType?.trim().toUpperCase() || 'TEST'
}

function parseEnvConfigObject(configJson: string) {
  const raw = configJson?.trim()
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function readNumericEnvConfig(configJson: string, key: string) {
  const parsed = parseEnvConfigObject(configJson)
  const value = parsed?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isVariableSetType(paramType: string) {
  return ['GLOBAL', 'BUSINESS', 'PAYMENT_CHANNEL', 'WEB_UI_VARIABLE_SET', 'APP_UI_VARIABLE_SET', 'API_VARIABLE_SET'].includes(paramType)
}

function parseVariableSummary(contentJson: string) {
  const raw = contentJson?.trim()
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    const source = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { variables?: unknown }).variables)
        ? (parsed as { variables: unknown[] }).variables
        : []

    return source
      .filter((item): item is { name?: unknown } => typeof item === 'object' && item !== null)
      .map(item => (typeof item.name === 'string' ? item.name.trim() : ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

export function getDbHostSummary(jdbcUrl: string) {
  const match = jdbcUrl.match(/^jdbc:[^:]+:\/\/([^/?]+)(?:\/([^?]+))?/)
  return match?.[1] ?? jdbcUrl
}

export function getDbNameSummary(row: Pick<DbConnectionItem, 'jdbcUrl' | 'description'>) {
  const match = row.jdbcUrl.match(/^jdbc:[^:]+:\/\/[^/?]+\/([^?]+)/)
  return match?.[1] || row.description || '-'
}
