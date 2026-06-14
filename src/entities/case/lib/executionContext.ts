import type { CaseSummaryItem } from '../model/types'

const CASE_EXECUTION_CONTEXT_KEY = 'case-execution-context-v1'

export interface CaseExecutionContext {
  workspaceCode: string
  returnQuery: Record<string, string>
  selectedDirectoryId: number | null
  selectedNodeId: string | null
  sourceLabel: string
  items: CaseSummaryItem[]
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && Object.values(value).every(item => typeof item === 'string')
}

function isCaseSummaryItem(value: unknown): value is CaseSummaryItem {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<CaseSummaryItem>
  return typeof candidate.id === 'number'
    && typeof candidate.caseNo === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.workspaceCode === 'string'
}

export function saveCaseExecutionContext(context: CaseExecutionContext) {
  sessionStorage.setItem(CASE_EXECUTION_CONTEXT_KEY, JSON.stringify(context))
}

export function loadCaseExecutionContext(): CaseExecutionContext | null {
  const raw = sessionStorage.getItem(CASE_EXECUTION_CONTEXT_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CaseExecutionContext>
    if (
      typeof parsed.workspaceCode !== 'string'
      || !isStringRecord(parsed.returnQuery)
      || !Array.isArray(parsed.items)
      || !parsed.items.every(isCaseSummaryItem)
    ) {
      sessionStorage.removeItem(CASE_EXECUTION_CONTEXT_KEY)
      return null
    }

    return {
      workspaceCode: parsed.workspaceCode,
      returnQuery: parsed.returnQuery,
      selectedDirectoryId: typeof parsed.selectedDirectoryId === 'number' ? parsed.selectedDirectoryId : null,
      selectedNodeId: typeof parsed.selectedNodeId === 'string' ? parsed.selectedNodeId : null,
      sourceLabel: typeof parsed.sourceLabel === 'string' ? parsed.sourceLabel : '',
      items: parsed.items,
    }
  } catch {
    sessionStorage.removeItem(CASE_EXECUTION_CONTEXT_KEY)
    return null
  }
}
