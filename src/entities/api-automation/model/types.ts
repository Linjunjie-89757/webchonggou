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
  fileSize?: number | null
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
  jsonText?: string | null
  xmlText?: string | null
  plainText?: string | null
  formItems: ApiKeyValueInput[]
  contentType?: string | null
  fileName?: string | null
  fileSize?: number | null
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

export interface ApiAutomationEnvironmentItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  baseUrl: string | null
  status: number | null
}

export interface ApiAutomationVariableSetItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  status: number | null
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

export interface SaveApiDefinitionModulePayload {
  workspaceCode?: string
  parentId?: number | null
  name: string
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

export interface ApiDefinitionCaseDetail extends ApiDefinitionCaseItem {
  requestConfig: ApiRequestConfigInput
  assertions: unknown[]
  extractors: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
  createdAt: string | null
}

export interface SaveApiDefinitionCasePayload {
  workspaceCode?: string
  definitionId: number
  name: string
  description?: string | null
  tags: string[]
  requestConfig: ApiRequestConfigInput
  assertions: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
}

export interface ApiAiCaseGenerationOptionPayload {
  id: string
  key: string
  group: string
  label: string
  groupLabel: string
}

export interface ApiAiExistingCaseSummary {
  id: number
  name: string
  tags: string[]
}

export interface ApiAiGeneratedCaseDraft {
  name: string
  description?: string | null
  tags?: string[] | null
  group?: string | null
  groupKey?: string | null
  type?: string | null
  typeKey?: string | null
  expected?: string | null
  requestConfig?: ApiRequestConfigInput | null
  assertions?: unknown[] | null
  preProcessors?: unknown[] | null
  postProcessors?: unknown[] | null
}

export interface ApiAiGeneratedCaseOutline {
  name?: string | null
  description?: string | null
  tags?: string[] | null
  group?: string | null
  groupKey?: string | null
  type?: string | null
  typeKey?: string | null
  expected?: string | null
}

export interface ApiAiCaseGenerationPayload {
  workspaceCode?: string
  definitionId: number
  definitionName: string
  name: string
  method: string
  path: string
  description?: string | null
  providerConnectionId: number
  modelName: string
  caseCount: string
  noDuplicate: boolean
  prompt?: string | null
  options: ApiAiCaseGenerationOptionPayload[]
  requestConfig: ApiRequestConfigInput
  assertions: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
  existingCases: ApiAiExistingCaseSummary[]
}

export interface ApiAiCaseGenerationEvent {
  event: 'started' | 'item_outline' | 'item_completed' | 'item_failed' | 'completed' | 'failed' | string
  itemId?: string | null
  group?: string | null
  type?: string | null
  total?: number | null
  item?: ApiAiGeneratedCaseDraft | null
  outline?: ApiAiGeneratedCaseOutline | null
  message?: string | null
}

export interface ApiRunPayload {
  workspaceCode?: string
  environmentId?: number | null
  variableSetId?: number | null
}

export interface ApiRequestSnapshot {
  method: string
  url: string
  headers: Record<string, string>
  queryParams?: ApiKeyValueInput[] | null
  cookies?: ApiKeyValueInput[] | null
  bodyType?: string | null
  bodyContentType?: string | null
  bodyFormItems?: ApiKeyValueInput[] | null
  bodyFileName?: string | null
  bodyFileContentType?: string | null
  body: string | null
}

export interface ApiResponseSnapshot {
  statusCode: number
  headers: Record<string, string>
  body: string | null
  contentType: string | null
}

export interface ApiAssertionResult {
  id?: string | null
  type: string
  name?: string | null
  subject?: string | null
  condition?: string | null
  expectedValue?: string | null
  actualValue?: string | null
  success: boolean
  message?: string | null
}

export interface ApiRunStepResult {
  id: number | null
  reportId: number | null
  stepOrder: number
  stepName: string
  definitionId: number | null
  success: boolean
  durationMs: number
  request: ApiRequestSnapshot | null
  response: ApiResponseSnapshot | null
  assertionResults: ApiAssertionResult[]
  extractionResults?: unknown[]
  processorResults?: unknown[]
  errorMessage: string | null
  createdAt: string | null
}

export interface ApiRunResult {
  taskId: number | null
  reportId: number | null
  taskName: string | null
  reportName: string | null
  result: string | null
  failureSummary: string | null
  stepResults: ApiRunStepResult[]
}

export interface ApiRunHistoryItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  caseId: number
  definitionId: number
  caseName: string
  reportId: number | null
  result: string | null
  failureSummary: string | null
  statusCode: number | null
  durationMs: number | null
  responseSize: number | null
  environmentId: number | null
  environmentName: string | null
  variableSetId: number | null
  variableSetName: string | null
  operator: string | null
  createdAt: string | null
}

export interface ApiRunHistoryDetail extends ApiRunHistoryItem {
  stepResults: ApiRunStepResult[]
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
