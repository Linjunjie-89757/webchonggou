import type {
  ApiDefinitionDetail,
  ApiDefinitionItem,
  SaveApiDefinitionPayload,
} from '@/entities/api-automation'

export type ApiDefinitionDialogMode = 'create' | 'edit'

export interface ApiDefinitionForm {
  workspaceCode: string
  name: string
  method: string
  path: string
  directoryName: string
  description: string
  tagsText: string
  timeoutMs: string
}

export function createDefaultApiDefinitionForm(workspaceCode = 'ALL'): ApiDefinitionForm {
  return {
    workspaceCode,
    name: '',
    method: 'GET',
    path: '',
    directoryName: '',
    description: '',
    tagsText: '',
    timeoutMs: '10000',
  }
}

export function createApiDefinitionFormFromSummary(
  item: ApiDefinitionItem,
  fallbackWorkspaceCode = 'ALL',
): ApiDefinitionForm {
  return {
    workspaceCode: item.workspaceCode || fallbackWorkspaceCode,
    name: item.name || '',
    method: item.method || 'GET',
    path: item.path || '',
    directoryName: item.directoryName || '',
    description: item.description || '',
    tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    timeoutMs: '10000',
  }
}

export function createApiDefinitionFormFromDetail(item: ApiDefinitionDetail): ApiDefinitionForm {
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    name: item.name || '',
    method: item.requestConfig?.method || item.method || 'GET',
    path: item.requestConfig?.path || item.path || '',
    directoryName: item.directoryName || '',
    description: item.description || '',
    tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    timeoutMs: String(item.requestConfig?.timeoutMs || 10000),
  }
}

function parseTags(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function buildSaveApiDefinitionPayload(form: ApiDefinitionForm): SaveApiDefinitionPayload {
  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    name: form.name.trim(),
    directoryName: form.directoryName.trim() || null,
    description: form.description.trim() || null,
    tags: parseTags(form.tagsText),
    requestConfig: {
      method: form.method.trim().toUpperCase(),
      path: form.path.trim(),
      timeoutMs: Number(form.timeoutMs) || 10000,
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
    },
    assertions: [],
    extractors: [],
    preProcessors: [],
    postProcessors: [],
  }
}

export function validateApiDefinitionForm(form: ApiDefinitionForm) {
  if (!form.name.trim()) {
    return '请输入接口名称'
  }
  if (!form.method.trim()) {
    return '请选择请求方法'
  }
  if (!form.path.trim()) {
    return '请输入接口路径'
  }
  if (!Number.isFinite(Number(form.timeoutMs)) || Number(form.timeoutMs) <= 0) {
    return '超时时间必须是大于 0 的数字'
  }
  return ''
}
