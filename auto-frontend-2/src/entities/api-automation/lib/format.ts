import type {
  ApiAutomationClientFilter,
  ApiDefinitionCaseItem,
  ApiDefinitionItem,
  ApiDefinitionModuleItem,
  ApiAutomationStat,
} from '../model/types'

type BadgeTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'

const methodToneMap: Record<string, BadgeTone> = {
  GET: 'success',
  POST: 'primary',
  PUT: 'warning',
  PATCH: 'purple',
  DELETE: 'danger',
}

const runResultMetaMap: Record<string, { label: string; tone: BadgeTone }> = {
  SUCCESS: { label: '成功', tone: 'success' },
  PASSED: { label: '成功', tone: 'success' },
  FAILED: { label: '失败', tone: 'danger' },
  FAILURE: { label: '失败', tone: 'danger' },
  ERROR: { label: '错误', tone: 'danger' },
  SKIPPED: { label: '跳过', tone: 'warning' },
  TIMEOUT: { label: '超时', tone: 'warning' },
}

export function getApiMethodTone(method?: string | null): BadgeTone {
  return methodToneMap[String(method || '').toUpperCase()] || 'default'
}

export function getApiRunResultMeta(result?: string | null) {
  const normalized = String(result || '').toUpperCase()

  return runResultMetaMap[normalized] || {
    label: normalized || '未执行',
    tone: normalized ? 'default' : 'warning',
  }
}

export function formatApiDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }

  return value.replace('T', ' ').slice(0, 16)
}

export function formatApiTags(tags?: string[] | null) {
  return Array.isArray(tags) && tags.length > 0 ? tags.join(' / ') : '-'
}

export function formatApiDuration(value?: number | null) {
  if (value === null || value === undefined || value < 0) {
    return '-'
  }

  if (value < 1000) {
    return `${value} ms`
  }

  return `${(value / 1000).toFixed(2)} s`
}

export function formatApiSize(value?: number | null) {
  if (!value || value <= 0) {
    return '-'
  }

  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export function getApiModuleDisplayName(module?: ApiDefinitionModuleItem | null) {
  if (!module) {
    return '未分组'
  }

  return module.fullPath || module.name || '未命名模块'
}

export function matchesApiDefinitionClientFilter(item: ApiDefinitionItem, filter: ApiAutomationClientFilter) {
  const keyword = filter.keyword.trim().toLowerCase()
  if (!keyword) {
    return true
  }

  return [
    item.name,
    item.path,
    item.method,
    item.directoryName,
    item.description,
    ...(item.tags || []),
  ].some((value) => String(value || '').toLowerCase().includes(keyword))
}

export function matchesApiCaseClientFilter(item: ApiDefinitionCaseItem, keyword: string) {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) {
    return true
  }

  return [
    item.name,
    item.definitionName,
    item.path,
    item.method,
    item.description,
    ...(item.tags || []),
  ].some((value) => String(value || '').toLowerCase().includes(normalized))
}

export function buildApiAutomationStats(
  definitions: ApiDefinitionItem[],
  cases: ApiDefinitionCaseItem[],
  modules: ApiDefinitionModuleItem[],
): ApiAutomationStat[] {
  const successCount = definitions.filter((item) => getApiRunResultMeta(item.lastRunResult).tone === 'success').length
  const failedCount = definitions.filter((item) => getApiRunResultMeta(item.lastRunResult).tone === 'danger').length

  return [
    { label: '接口定义', value: definitions.length, tone: 'primary' },
    { label: '模块数', value: modules.length },
    { label: '接口用例', value: cases.length, tone: 'purple' },
    { label: '最近成功', value: successCount, tone: 'success' },
    { label: '最近失败', value: failedCount, tone: failedCount > 0 ? 'danger' : 'default' },
  ]
}
