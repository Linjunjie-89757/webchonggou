import type {
  WebUiElementCollectCandidate,
  WebUiLocatorType,
} from '../model/types'

export const LOCAL_RUNNER_BASE_URL = 'http://127.0.0.1:39118'

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
  } = {},
): Promise<T> {
  const response = await fetch(`${LOCAL_RUNNER_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

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

function clampConfidence(value?: number | null) {
  const numeric = Number(value || 0)
  if (Number.isNaN(numeric)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(numeric)))
}
