import type { DbConnectionItem, EnvConfigItem, ParamSetItem } from '../model/types'

export function isProductionEnv(item: Pick<EnvConfigItem, 'envType' | 'envName' | 'configJson'>) {
  const text = `${item.envType} ${item.envName} ${item.configJson ?? ''}`.toLowerCase()
  return text.includes('prod') || text.includes('生产')
}

export function getEnvVisualMeta(item: Pick<EnvConfigItem, 'envType' | 'envName' | 'configJson'>) {
  if (item.envType === 'WEB_UI') {
    return {
      typeLabel: 'Web UI 环境',
      tone: 'purple' as const,
      description: getWebUiEnvDescription(item.configJson),
    }
  }

  const text = `${item.envType} ${item.envName} ${item.configJson ?? ''}`.toLowerCase()
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

export function getParamCategory(item: Pick<ParamSetItem, 'paramType' | 'paramName'>) {
  const text = `${item.paramType} ${item.paramName}`.toLowerCase()
  if (item.paramType === 'WEB_UI_VARIABLE_SET') {
    return 'webUi'
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
  if (category === 'webUi') {
    return { label: 'Web UI 变量集', tone: 'purple' as const }
  }
  if (category === 'api') {
    return { label: item.paramType === 'API_VARIABLE_SET' ? '接口变量集' : '接口参数', tone: 'purple' as const }
  }
  if (category === 'business') {
    return { label: '业务参数', tone: 'success' as const }
  }
  return { label: '全局参数', tone: 'primary' as const }
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
    return item.paramType === 'WEB_UI_VARIABLE_SET' ? 'Web UI 执行变量集' : '接口自动化变量集'
  }

  const parsed = parseParamContent(item.contentJson)
  return parsed.description || item.paramType || '-'
}

function getWebUiEnvDescription(configJson: string) {
  const raw = configJson?.trim()
  if (!raw) {
    return '浏览器执行环境'
  }

  try {
    const parsed = JSON.parse(raw) as {
      browserType?: unknown
      defaultTimeoutMs?: unknown
      viewport?: {
        width?: unknown
        height?: unknown
      }
    }
    const browserType = typeof parsed.browserType === 'string' ? parsed.browserType : 'CHROMIUM'
    const timeout = typeof parsed.defaultTimeoutMs === 'number' ? `${parsed.defaultTimeoutMs}ms` : ''
    const width = typeof parsed.viewport?.width === 'number' ? parsed.viewport.width : null
    const height = typeof parsed.viewport?.height === 'number' ? parsed.viewport.height : null
    const viewport = width && height ? `${width}x${height}` : ''

    return [browserType, viewport, timeout].filter(Boolean).join(' / ') || '浏览器执行环境'
  } catch {
    return '浏览器执行环境'
  }
}

function isVariableSetType(paramType: string) {
  return paramType === 'WEB_UI_VARIABLE_SET' || paramType === 'API_VARIABLE_SET'
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
