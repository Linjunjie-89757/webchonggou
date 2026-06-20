export type WebUiBrowserType = 'CHROMIUM' | 'FIREFOX' | 'WEBKIT'

export type WebUiCaseStatus = 'ENABLED' | 'DISABLED'

export type WebUiStepType =
  | 'OPEN'
  | 'CLICK'
  | 'FILL'
  | 'CLEAR'
  | 'HOVER'
  | 'DOUBLE_CLICK'
  | 'RIGHT_CLICK'
  | 'PRESS_KEY'
  | 'SELECT'
  | 'FILE_UPLOAD'
  | 'WAIT_FOR'
  | 'ASSERT_VISIBLE'
  | 'ASSERT_TEXT'
  | 'ASSERT_URL'
  | 'ASSERT_TITLE'
  | 'ASSERT_ATTRIBUTE'
  | 'ASSERT_COUNT'
  | 'SCREENSHOT'

export type WebUiLocatorType =
  | 'CSS'
  | 'TEXT'
  | 'ROLE'
  | 'PLACEHOLDER'
  | 'LABEL'
  | 'TEST_ID'
  | 'XPATH'

export type WebUiScreenshotPolicy = 'NONE' | 'ON_FAILURE' | 'ALWAYS'

export type WebUiEnvironmentStatus = 0 | 1

export type WebUiRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELED'

export type WebUiRunStepStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED'

export interface PageResponse<T> {
  items: T[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface WebUiCaseStepItem {
  id?: number | null
  name?: string | null
  type: WebUiStepType
  locatorType?: WebUiLocatorType | null
  locatorValue?: string | null
  inputValue?: string | null
  timeoutMs?: number | null
  continueOnFailure: boolean
  screenshotPolicy: WebUiScreenshotPolicy
  enabled: boolean
  sortOrder: number
}

export interface WebUiCaseItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  moduleName: string | null
  status: WebUiCaseStatus
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  baseUrl?: string | null
  description: string | null
  stepCount: number
  lastRunResult: string | null
  lastRunAt: string | null
  updatedAt: string | null
}

export interface WebUiCaseDetail extends WebUiCaseItem {
  steps: WebUiCaseStepItem[]
  createdAt: string | null
}

export interface WebUiCaseTemplateStepItem extends WebUiCaseStepItem {
  templateId?: number | null
}

export interface WebUiCaseTemplateItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  moduleName: string | null
  status: WebUiCaseStatus
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  baseUrl?: string | null
  description: string | null
  stepCount: number
  updatedAt: string | null
}

export interface WebUiCaseTemplateDetail extends WebUiCaseTemplateItem {
  steps: WebUiCaseTemplateStepItem[]
  createdAt: string | null
}

export interface SaveWebUiCasePayload {
  workspaceCode?: string
  name: string
  moduleName?: string | null
  status?: WebUiCaseStatus
  browserType?: WebUiBrowserType
  headless?: boolean
  defaultTimeoutMs?: number
  baseUrl?: string | null
  description?: string | null
  steps: WebUiCaseStepItem[]
}

export interface WebUiCaseListQuery {
  keyword?: string
  moduleName?: string
  status?: WebUiCaseStatus | ''
  pageNo?: number
  pageSize?: number
}

export type WebUiCaseTemplateListQuery = WebUiCaseListQuery

export interface SaveWebUiCaseTemplatePayload {
  workspaceCode?: string
  name: string
  moduleName?: string | null
  status?: WebUiCaseStatus
  browserType?: WebUiBrowserType
  headless?: boolean
  defaultTimeoutMs?: number
  baseUrl?: string | null
  description?: string | null
  steps: WebUiCaseStepItem[]
}

export interface SaveWebUiTemplateFromCasePayload {
  workspaceCode?: string
  templateName: string
  description?: string | null
}

export interface WebUiEnvironmentItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  baseUrl: string
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  status: number
  source: 'WEB_UI' | 'CONFIG_CENTER' | string
  defaultVariableSetId: number | null
  defaultVariableSetName: string | null
  updatedAt: string | null
}

export interface SaveWebUiEnvironmentPayload {
  workspaceCode?: string
  name: string
  baseUrl: string
  browserType?: WebUiBrowserType
  headless?: boolean
  defaultTimeoutMs?: number
  status?: WebUiEnvironmentStatus
}

export interface ValidateWebUiLocatorPayload {
  baseUrl: string
  browserType?: WebUiBrowserType
  headless?: boolean
  locatorType: WebUiLocatorType
  locatorValue: string
  timeoutMs?: number | null
}

export interface ValidateWebUiLocatorResponse {
  matched: boolean
  matchCount: number
  errorMessage: string | null
  screenshotBase64: string | null
}

export interface SaveWebUiCiTokenPayload {
  workspaceCode?: string
  tokenName: string
}

export interface WebUiCiTokenSummary {
  id: number
  workspaceCode: string
  workspaceName: string | null
  tokenName: string
  status: number
  createdBy: string | null
  lastUsedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface WebUiCiTokenCreated extends WebUiCiTokenSummary {
  token: string
}

export interface WebUiRunRequest {
  environmentId?: number | null
  headless?: boolean | null
  variableSetId?: number | null
  runtimeVariables?: Record<string, string> | null
}

export interface WebUiRunStepResult {
  id: number
  caseStepId: number | null
  stepName: string
  stepType: WebUiStepType
  status: WebUiRunStepStatus
  locatorType: WebUiLocatorType | null
  locatorValue: string | null
  inputValueSnapshot: string | null
  durationMs: number | null
  errorMessage: string | null
  screenshotArtifactId: number | null
  screenshotUrl: string | null
  sortOrder: number
  startedAt: string | null
  finishedAt: string | null
}

export interface WebUiRunSummary {
  id: number
  workspaceCode: string
  workspaceName: string | null
  batchId?: number | null
  batchSortOrder?: number | null
  caseId: number | null
  caseName: string
  environmentId: number | null
  environmentName: string | null
  status: WebUiRunStatus
  browserType: WebUiBrowserType
  headless: boolean
  baseUrl: string | null
  durationMs: number | null
  failureSummary: string | null
  totalSteps: number
  passedSteps: number
  failedSteps: number
  skippedSteps: number
  operatorName: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string | null
}

export interface WebUiExecutionContextSnapshot {
  environment: {
    id: number | null
    name: string | null
    baseUrl: string | null
    browserType: WebUiBrowserType | string | null
    headless: boolean | null
    defaultTimeoutMs: number | null
  } | null
  variableSetId: number | null
  variableSetName: string | null
  variables: Record<string, string>
}

export interface WebUiRunDetail {
  summary: WebUiRunSummary
  context: WebUiExecutionContextSnapshot | null
  steps: WebUiRunStepResult[]
}

export interface WebUiRunResponse {
  runId: number
  batchId?: number | null
  caseId: number | null
  caseName: string
  status: WebUiRunStatus
  durationMs: number | null
  failureSummary: string | null
  totalSteps: number
  passedSteps: number
  failedSteps: number
  skippedSteps: number
  stepResults: WebUiRunStepResult[]
}

export interface WebUiRunListQuery {
  caseId?: number | null
  keyword?: string
  status?: WebUiRunStatus | ''
  pageNo?: number
  pageSize?: number
}

export interface WebUiBatchRunRequest {
  batchName?: string | null
  caseIds: number[]
  environmentId?: number | null
  headless?: boolean | null
  stopOnFailure?: boolean | null
  variableSetId?: number | null
  runtimeVariables?: Record<string, string> | null
}

export interface WebUiRunBatchSummary {
  id: number
  workspaceCode: string
  workspaceName: string | null
  batchName: string
  source: 'MANUAL' | 'CI' | string
  environmentId: number | null
  environmentName: string | null
  status: WebUiRunStatus
  totalCases: number
  successCases: number
  failedCases: number
  durationMs: number | null
  failureSummary: string | null
  operatorName: string | null
  ciTokenId: number | null
  externalBuildId: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string | null
}

export interface WebUiRunBatchDetail {
  summary: WebUiRunBatchSummary
  runs: WebUiRunSummary[]
}

export interface WebUiBatchRunResponse {
  batchId: number
  batchName: string
  status: WebUiRunStatus
  passed?: boolean
  totalCases: number
  successCases: number
  failedCases: number
  durationMs: number | null
  failureSummary: string | null
  externalBuildId?: string | null
  reportUrl?: string | null
  summaryText?: string | null
  failedRuns?: WebUiCiFailedRunSummary[]
  runs: WebUiRunSummary[]
}

export interface WebUiCiFailedRunSummary {
  runId: number
  caseId: number | null
  caseName: string
  status: WebUiRunStatus
  failureSummary: string | null
  reportUrl: string | null
}

export interface WebUiRunBatchListQuery {
  keyword?: string
  status?: WebUiRunStatus | ''
  pageNo?: number
  pageSize?: number
}

export type WebUiReportShareType = 'RUN' | 'BATCH'

export interface SaveWebUiReportSharePayload {
  shareType: WebUiReportShareType
  targetId: number
  expiresInDays?: number | null
}

export interface WebUiReportShareSummary {
  id: number
  workspaceCode: string
  workspaceName: string | null
  shareType: WebUiReportShareType
  targetId: number
  status: number
  expiresAt: string | null
  createdBy: string | null
  lastAccessedAt: string | null
  accessCount: number
  createdAt: string | null
  updatedAt: string | null
}

export interface WebUiReportShareCreated extends WebUiReportShareSummary {
  token: string
  shareUrl: string
}

export interface WebUiSharedReport {
  shareType: WebUiReportShareType
  run: WebUiRunDetail | null
  batch: WebUiRunBatchDetail | null
  expiresAt: string | null
  generatedAt: string | null
}
