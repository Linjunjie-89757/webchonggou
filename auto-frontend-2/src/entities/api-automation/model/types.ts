export interface PageResponse<T> {
  items: T[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface ApiDefinitionItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  method: string
  path: string
  directoryName: string | null
  description: string | null
  tags: string[]
  lastRunResult: string | null
  lastRunAt: string | null
  updatedAt: string | null
}

export interface ApiKeyValueInput {
  key: string
  value: string
  description?: string | null
  enabled?: boolean
  paramType?: string | null
  required?: boolean
  encode?: boolean
  minLength?: number | null
  maxLength?: number | null
  fileName?: string | null
  contentType?: string | null
  fileBase64?: string | null
}

export interface ApiAuthCredentialInput {
  userName?: string | null
  password?: string | null
}

export interface ApiAuthConfigInput {
  authType: string
  basicAuth?: ApiAuthCredentialInput | null
  digestAuth?: ApiAuthCredentialInput | null
}

export interface ApiRequestBodyInput {
  type: string
  rawText?: string | null
  formItems: ApiKeyValueInput[]
  contentType?: string | null
  fileName?: string | null
  binaryBase64?: string | null
}

export interface ApiRequestConfigInput {
  method: string
  path: string
  timeoutMs: number
  queryParams: ApiKeyValueInput[]
  headers: ApiKeyValueInput[]
  cookies: ApiKeyValueInput[]
  body: ApiRequestBodyInput
  authConfig: ApiAuthConfigInput
}

export interface ApiDefinitionDetail extends ApiDefinitionItem {
  requestConfig: ApiRequestConfigInput
  assertions: unknown[]
  extractors: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
  createdAt: string | null
}

export interface SaveApiDefinitionPayload {
  workspaceCode?: string
  name: string
  directoryName?: string | null
  description?: string | null
  tags: string[]
  requestConfig: ApiRequestConfigInput
  assertions: unknown[]
  extractors: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
}

export interface ApiDefinitionModuleItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  parentId: number | null
  name: string
  fullPath: string | null
  sortOrder: number | null
  definitionCount: number
  children: ApiDefinitionModuleItem[]
}

export interface ApiDefinitionCaseItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  definitionId: number
  definitionName: string
  name: string
  method: string
  path: string
  description: string | null
  tags: string[]
  lastRunResult: string | null
  lastRunAt: string | null
  updatedAt: string | null
}

export interface ApiDefinitionListQuery {
  keyword?: string
  moduleId?: number | null
  pageNo?: number
  pageSize?: number
}

export interface ApiCaseListQuery {
  definitionId?: number | null
  keyword?: string
  pageNo?: number
  pageSize?: number
}

export interface ApiAutomationClientFilter {
  keyword: string
}

export interface ApiAutomationStat {
  label: string
  value: number
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
}
