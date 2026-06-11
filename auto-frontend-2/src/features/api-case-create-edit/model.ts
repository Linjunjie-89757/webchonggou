import type {
  ApiDefinitionCaseDetail,
  ApiDefinitionCaseItem,
  ApiDefinitionItem,
  ApiRequestConfigInput,
  SaveApiDefinitionCasePayload,
} from '@/entities/api-automation'

export type ApiCaseDialogMode = 'create' | 'edit'

export interface ApiCaseForm {
  workspaceCode: string
  definitionId: number | null
  definitionName: string
  name: string
  method: string
  path: string
  description: string
  tagsText: string
  timeoutMs: string
  baseRequestConfig: ApiRequestConfigInput | null
  assertions: unknown[]
  extractors: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
}

function createDefaultRequestConfig(method = 'GET', path = '', timeoutMs = 10000): ApiRequestConfigInput {
  return {
    method,
    path,
    timeoutMs,
    queryParams: [],
    headers: [],
    cookies: [],
    body: {
      type: 'NONE',
      rawText: null,
      formItems: [],
      contentType: null,
      fileName: null,
      binaryBase64: null,
    },
    authConfig: {
      authType: 'NONE',
      basicAuth: null,
      digestAuth: null,
    },
  }
}

export function createDefaultApiCaseForm(
  definition: ApiDefinitionItem | null,
  workspaceCode = 'ALL',
): ApiCaseForm {
  return {
    workspaceCode,
    definitionId: definition?.id ?? null,
    definitionName: definition?.name || '',
    name: '',
    method: definition?.method || 'GET',
    path: definition?.path || '',
    description: '',
    tagsText: '',
    timeoutMs: '10000',
    baseRequestConfig: createDefaultRequestConfig(definition?.method || 'GET', definition?.path || ''),
    assertions: [],
    extractors: [],
    preProcessors: [],
    postProcessors: [],
  }
}

export function createApiCaseFormFromSummary(
  item: ApiDefinitionCaseItem,
  definition: ApiDefinitionItem | null,
  fallbackWorkspaceCode = 'ALL',
): ApiCaseForm {
  return {
    workspaceCode: item.workspaceCode || fallbackWorkspaceCode,
    definitionId: item.definitionId || definition?.id || null,
    definitionName: item.definitionName || definition?.name || '',
    name: item.name || '',
    method: item.method || definition?.method || 'GET',
    path: item.path || definition?.path || '',
    description: item.description || '',
    tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    timeoutMs: '10000',
    baseRequestConfig: createDefaultRequestConfig(item.method || definition?.method || 'GET', item.path || definition?.path || ''),
    assertions: [],
    extractors: [],
    preProcessors: [],
    postProcessors: [],
  }
}

export function createApiCaseFormFromDetail(item: ApiDefinitionCaseDetail): ApiCaseForm {
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    definitionId: item.definitionId,
    definitionName: item.definitionName || '',
    name: item.name || '',
    method: item.requestConfig?.method || item.method || 'GET',
    path: item.requestConfig?.path || item.path || '',
    description: item.description || '',
    tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    timeoutMs: String(item.requestConfig?.timeoutMs || 10000),
    baseRequestConfig: item.requestConfig || createDefaultRequestConfig(item.method || 'GET', item.path || ''),
    assertions: Array.isArray(item.assertions) ? item.assertions : [],
    extractors: Array.isArray(item.extractors) ? item.extractors : [],
    preProcessors: Array.isArray(item.preProcessors) ? item.preProcessors : [],
    postProcessors: Array.isArray(item.postProcessors) ? item.postProcessors : [],
  }
}

function parseTags(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function buildSaveApiCasePayload(form: ApiCaseForm): SaveApiDefinitionCasePayload {
  const baseRequestConfig = form.baseRequestConfig || createDefaultRequestConfig(form.method, form.path)

  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    definitionId: Number(form.definitionId),
    name: form.name.trim(),
    description: form.description.trim() || null,
    tags: parseTags(form.tagsText),
    requestConfig: {
      ...baseRequestConfig,
      method: form.method.trim().toUpperCase(),
      path: form.path.trim(),
      timeoutMs: Number(form.timeoutMs) || 10000,
    },
    assertions: form.assertions,
    preProcessors: form.preProcessors,
    postProcessors: form.postProcessors,
  }
}

export function validateApiCaseForm(form: ApiCaseForm) {
  if (!form.definitionId) {
    return '请先选择接口定义'
  }
  if (!form.name.trim()) {
    return '请输入用例名称'
  }
  if (!form.method.trim()) {
    return '请选择请求方法'
  }
  if (!form.path.trim()) {
    return '请输入请求路径'
  }
  if (!Number.isFinite(Number(form.timeoutMs)) || Number(form.timeoutMs) <= 0) {
    return '超时时间必须是大于 0 的数字'
  }
  return ''
}
