import type {
  WebUiElementCollectCandidate,
  WebUiElementCollectValidationResult,
  WebUiLocatorType,
} from '../model/types'

export const LOCAL_RUNNER_BASE_URL = 'http://127.0.0.1:39118'
export const LOCAL_RUNNER_VALIDATION_TIMEOUT_MS = 30000
const LOCAL_RUNNER_VALIDATION_BATCH_SIZE = 10

export interface LocalRunnerHealthView {
  online: boolean
  runnerVersion: string
  playwrightAvailable: boolean
  chromiumInstalled: boolean
  currentUrl: string | null
}

export interface LocalRunnerOpenPayload {
  url?: string
  workspaceId?: string | null
  environmentId?: string | number | null
}

export interface LocalRunnerOpenResult {
  success: boolean
  session?: {
    sessionId: string
    currentUrl: string
    authStateExists: boolean
  }
  page?: {
    url: string
    title: string
    isProbablyLoginPage: boolean
  }
}

export interface LocalRunnerCaptureResult {
  success: boolean
  session?: {
    sessionId: string
    currentUrl: string
    authStateExists: boolean
  }
  page?: {
    url: string
    title: string
    isProbablyLoginPage: boolean
  }
  candidates: LocalRunnerCandidate[]
  rawCount: number
  screenshotBase64?: string | null
}

export interface LocalRunnerCandidate {
  name: string
  elementType: string | null
  locator: {
    strategy: string
    value: string
  }
  text?: string | null
  placeholder?: string | null
  tagName?: string | null
  stabilityScore?: number | null
  source?: string | null
}

export interface LocalRunnerValidateLocatorInput {
  locatorType: WebUiLocatorType
  locatorValue: string
}

export interface LocalRunnerValidationProgress {
  done: number
  total: number
  batchFailed: number
}

export function normalizeRunnerHealth(payload: any): LocalRunnerHealthView {
  return {
    online: Boolean(payload?.success),
    runnerVersion: String(payload?.runner?.version || '-'),
    playwrightAvailable: Boolean(payload?.playwright?.available),
    chromiumInstalled: Boolean(payload?.browsers?.chromium?.installed),
    currentUrl: payload?.session?.currentUrl || null,
  }
}

export async function checkLocalRunnerHealth() {
  const payload = await requestLocalRunner('/health')
  return normalizeRunnerHealth(payload)
}

export async function openLocalRunnerPage(payload: LocalRunnerOpenPayload) {
  return requestLocalRunner<LocalRunnerOpenResult>('/collect/open', {
    method: 'POST',
    body: payload,
  })
}

export async function captureLocalRunnerPage(waitMs = 300) {
  return requestLocalRunner<LocalRunnerCaptureResult>('/collect/capture', {
    method: 'POST',
    body: { waitMs },
  })
}

export async function validateLocalRunnerLocators(
  locators: LocalRunnerValidateLocatorInput[],
  options: {
    onProgress?: (progress: LocalRunnerValidationProgress) => void
  } = {},
) {
  const normalizedLocators = locators
    .filter(item => item.locatorValue?.trim())
    .map(item => ({
      locatorType: normalizeLocatorType(item.locatorType),
      locatorValue: item.locatorValue.trim(),
    }))
  const results: WebUiElementCollectValidationResult[] = []
  let batchFailed = 0
  let lastError: unknown = null

  for (let index = 0; index < normalizedLocators.length; index += LOCAL_RUNNER_VALIDATION_BATCH_SIZE) {
    const batch = normalizedLocators.slice(index, index + LOCAL_RUNNER_VALIDATION_BATCH_SIZE)
    try {
      const payload = await requestLocalRunner<{ results?: WebUiElementCollectValidationResult[] }>('/collect/validate', {
        method: 'POST',
        timeoutMs: LOCAL_RUNNER_VALIDATION_TIMEOUT_MS,
        body: {
          locators: batch,
        },
      })
      if (Array.isArray(payload.results)) {
        results.push(...payload.results.map(normalizeLocalRunnerValidationResult))
      }
    } catch (error) {
      batchFailed += 1
      lastError = error
      results.push(...batch.map(item => ({
        locatorType: item.locatorType,
        locatorValue: item.locatorValue,
        validationStatus: 'FAILED',
        matchCount: 0,
        validationMessage: `本批真机验证失败：${getLocalRunnerErrorMessage(error)}`,
        screenshotBase64: null,
      })))
    }
    options.onProgress?.({
      done: Math.min(index + batch.length, normalizedLocators.length),
      total: normalizedLocators.length,
      batchFailed,
    })
  }

  if (normalizedLocators.length > 0 && batchFailed === Math.ceil(normalizedLocators.length / LOCAL_RUNNER_VALIDATION_BATCH_SIZE)) {
    throw lastError instanceof Error ? lastError : new Error('本地 Runner 所有验证批次均失败')
  }

  return results
}

export async function saveLocalRunnerAuth(payload: Omit<LocalRunnerOpenPayload, 'url'>) {
  return requestLocalRunner('/auth/save', {
    method: 'POST',
    body: payload,
  })
}

export function mapRunnerCandidateToCollectCandidate(input: {
  candidate: LocalRunnerCandidate
  groupName: string
  screenshotBase64?: string | null
}): WebUiElementCollectCandidate {
  const locatorType = normalizeLocatorType(input.candidate.locator?.strategy)
  const confidence = clampConfidence(input.candidate.stabilityScore)
  const hasLocator = Boolean(input.candidate.locator?.value)

  return {
    groupName: input.groupName || '页面元素',
    candidateSource: 'STATIC_RULE',
    elementName: input.candidate.name || '页面元素',
    locatorType,
    locatorValue: input.candidate.locator?.value || '',
    confidence,
    reason: '本地 Runner 静态规则采集',
    tagName: input.candidate.tagName || null,
    elementType: input.candidate.elementType || null,
    text: input.candidate.text || null,
    placeholder: input.candidate.placeholder || null,
    ariaLabel: null,
    labelText: null,
    nearbyHeading: null,
    businessMeaning: input.candidate.text || input.candidate.placeholder || null,
    recommendedToSave: hasLocator,
    notRecommendedReason: hasLocator ? null : '未生成可用定位器',
    maintenanceSuggestion: '来自本地 Runner 静态采集，当前阶段尚未接入真机验证，保存前请确认名称、分组和定位器。',
    stabilityNote: `定位器稳定性评分 ${confidence}%`,
    validationStatus: 'UNVERIFIED',
    matchCount: null,
    validationMessage: '静态生成，尚未经过 Runner 真机验证',
    screenshotBase64: input.screenshotBase64 || null,
    saveBlockedReason: hasLocator ? null : '缺少定位器',
  }
}

async function requestLocalRunner<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    body?: unknown
    timeoutMs?: number
  } = {},
): Promise<T> {
  const controller = options.timeoutMs ? new AbortController() : null
  const timeoutId = controller
    ? globalThis.setTimeout(() => controller.abort(), options.timeoutMs)
    : null
  let response: Response
  try {
    response = await fetch(`${LOCAL_RUNNER_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller?.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('本地执行器请求超时')
    }
    throw error
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId)
    }
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || '本地执行器请求失败')
  }

  return payload as T
}

function normalizeLocatorType(value?: string | null): WebUiLocatorType {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'TEXT'
    || normalized === 'ROLE'
    || normalized === 'PLACEHOLDER'
    || normalized === 'LABEL'
    || normalized === 'TEST_ID'
    || normalized === 'XPATH'
  ) {
    return normalized
  }

  return 'CSS'
}

function normalizeLocalRunnerValidationResult(item: WebUiElementCollectValidationResult): WebUiElementCollectValidationResult {
  return {
    locatorType: normalizeLocatorType(item.locatorType),
    locatorValue: item.locatorValue || '',
    validationStatus: item.validationStatus || 'UNVERIFIED',
    matchCount: Number(item.matchCount || 0),
    validationMessage: item.validationMessage || null,
    screenshotBase64: item.screenshotBase64 || null,
  }
}

function getLocalRunnerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function clampConfidence(value?: number | null) {
  const numeric = Number(value || 0)
  if (Number.isNaN(numeric)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(numeric)))
}
